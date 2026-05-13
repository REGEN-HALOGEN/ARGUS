# 08 - Upgrade: Multi-Tenant RBAC & User Onboarding

## 1. Architectural Overview

To transform ARGUS from a single-environment deployment into a B2B SaaS platform where organizations can self-register, undergo onboarding, and view isolated metrics, the platform must adopt a **Multi-Tenant Architecture**.

This upgrade introduces:
- **Tenant Isolation**: Ensuring data (Assets, CVE mappings, Attack Paths) in Neo4j and Qdrant is strictly partitioned by `tenantId`.
- **Dynamic Onboarding**: A multi-step workflow capturing organizational context to tailor the dashboard.
- **Role-Based Access Control (RBAC)**: Distinguishing between standard users (tenant members), tenant admins, and global platform super-admins.
- **Super Admin Dashboard**: A central interface for platform owners to monitor all registered tenants and their high-level risk metrics.

---

## 2. Phase 1: Authentication & RBAC Foundation

We will leverage **Better Auth's Organization Plugin** to handle multi-tenancy and roles natively.

### 2.1 Backend Configuration (`apps/api/src/auth.ts`)

Enable the organization and admin plugins in Better Auth.

```typescript
import { betterAuth } from 'better-auth';
import { organization, admin } from 'better-auth/plugins';

export const auth = betterAuth({
  database: db, // SQLite
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      async onOrganizationCreate(org) {
        // Trigger default asset scaffolding for new orgs via webhook/event
      }
    }),
    admin({
      // Defines super-admins who can access the global platform admin panel
      adminRole: "super_admin" 
    })
  ]
});
```

### 2.2 Schema Updates
Better Auth will automatically scaffold tables for `organization`, `member`, and `invitation`. We will add custom fields to the `organization` metadata to store onboarding responses (e.g., industry, expected asset types).

---

## 3. Phase 2: Registration & Onboarding Flow

### 3.1 Self-Registration UI (`apps/web/src/app/register/page.tsx`)
A standard sign-up form capturing `email`, `password`, and `fullName`. Upon successful creation, the user is redirected to `/onboarding`.

### 3.2 Multi-Step Onboarding (`apps/web/src/app/onboarding/page.tsx`)
A state-driven interactive form that captures context:

1. **Step 1: Organization Details**
   - Organization Name
   - Industry (e.g., Finance, Healthcare, Tech) - Used later for AI context weighting.
2. **Step 2: Asset Infrastructure**
   - Cloud Providers (AWS, GCP, Azure)
   - On-Premises configurations
   - Number of estimated assets
3. **Step 3: Initial Integration Setup** (Optional)
   - Uploading a CSV of assets or connecting cloud credentials.

**API Action on Completion:**
The frontend calls a new endpoint `POST /api/v1/onboarding` which:
1. Creates the Organization in Better Auth.
2. Sets the user as the `owner`/`admin` of that Organization.
3. Saves the metadata (Industry, Asset Types).
4. Seeds an initial set of sample nodes in Neo4j tagged with the new `tenantId` to populate their immediate dashboard.

---

## 4. Phase 3: Data Isolation (Neo4j & Qdrant)

The most critical security requirement is ensuring no cross-tenant data leakage.

### 4.1 Neo4j Graph Isolation
Every node specific to an organization (Assets, custom Vulnerability instances, specific Attack Paths) must have a `tenantId` property.

**Updated Cypher Queries (`apps/api/src/routes/v1/dashboard.ts`):**
Whenever querying the dashboard, inject the tenant ID from the authenticated user's session.

```typescript
// Example: Getting total assets safely
const session = getNeo4jDriver().session();
const result = await session.run(
  'MATCH (a:Asset {tenantId: $tenantId}) RETURN count(a) AS count',
  { tenantId: currentOrganization.id }
);
```

### 4.2 Qdrant Vector Isolation
For the AI Analyst's RAG system, all embedded documents (logs, reports) must include the `tenantId` in their payload.

```typescript
// When querying Qdrant for context
const searchResult = await qdrantClient.search('argus-knowledge', {
  vector: queryEmbedding,
  filter: {
    must: [{ key: 'tenantId', match: { value: currentOrganization.id } }]
  },
  limit: 5
});
```

### 4.3 Global vs. Local Nodes
- **Global Nodes**: Threat Actors (`:ThreatActor`) and global vulnerabilities (`:CVE`) are shared across all tenants to save space and compute.
- **Local Nodes**: `:Asset`, `:Alert`, and relationships like `(:Asset)-[:HAS_VULNERABILITY]->(:CVE)` are strictly local and tagged with `tenantId`.

---

## 5. Phase 4: Tenant Dashboard Scoping

The primary dashboard (`/dashboard`) will remain largely the same visually but will be fueled by tenant-scoped API routes.

1. **Active Organization Context**: The frontend will use Better Auth's `useActiveOrganization()` hook to pass the active `organizationId` in API headers (e.g., `x-tenant-id`).
2. **Hono Middleware**: Create an `authMiddleware` that intercepts requests, validates the session, reads the `x-tenant-id`, verifies the user belongs to that tenant, and attaches `c.set('tenantId', id)` for downstream routes.
3. **Dynamic Threat Briefings**: The AI analyst will use the tenant's `Industry` metadata to tailor threat intelligence (e.g., highlighting healthcare-specific ransomware if the industry is Healthcare).

---

## 6. Phase 5: Super Admin Global Panel

The platform owners need a God-view of the system. 

### 6.1 Admin Routes (`apps/web/src/app/admin/layout.tsx`)
Protected by checking if `session.user.role === 'super_admin'`.

### 6.2 Admin API Endpoints
Endpoints under `apps/api/src/routes/v1/admin.ts` that bypass the `tenantId` filters to aggregate data.

### 6.3 Features of the Super Admin Panel
1. **Tenant Directory**: A data table listing all registered organizations, the date they joined, their active member count, and their chosen industry.
2. **Aggregated Platform Risk**: A macro-view showing the average risk score across all tenants.
3. **Tenant Impersonation (Optional)**: A feature allowing super-admins to "view as" a specific tenant for support and debugging purposes (requires strict auditing).
4. **Usage Metrics**: Tracking the number of assets ingested per tenant to assist with billing/quota enforcement.

---

## 7. Execution Roadmap

1. **Dependency Update**: Install `@better-auth/plugins` and configure the SQLite database schema to accept organization tables.
2. **API Middleware**: Build the `tenantAuth` middleware in Hono to secure all `/api/v1/*` routes.
3. **Graph Refactor**: Write a migration script to attach a generic `tenantId` to existing dummy data, and update all `dashboard.ts` Cypher queries to require it.
4. **Frontend Onboarding**: Build the `/register` and `/onboarding` UI screens.
5. **Admin Panel**: Scaffold the `/admin` view to list organizations directly from the Better Auth database.

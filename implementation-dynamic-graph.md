# ARGUS Dynamic Graph & Contextual Risk Implementation Plan

This document outlines the transition from a static mock-data seeding approach to an intelligent, questionnaire-driven architecture. This shift allows ARGUS to immediately provide a tailored, context-aware security graph and accurate risk ratings the moment a user completes onboarding.

---

## 1. Frontend: Multi-Step "Architect" Questionnaire

The current `/onboarding/organization` page will be transformed into a multi-step wizard.

### Step 1: Organization Profile
*   **Fields:** Organization Name, Industry, Cloud Providers (AWS, GCP, Azure), Compliance Frameworks (SOC2, HIPAA, PCI).
*   **Purpose:** Sets the baseline for reporting and compliance tracking.

### Step 2: Infrastructure & Compute (The Assets)
*   **Mechanism:** Dynamic list where users can add groups of servers.
*   **Fields per group:**
    *   Server Role (e.g., Web Server, Application Server, Internal Tool).
    *   Operating System (e.g., Ubuntu, Windows Server, RHEL).
    *   OS Version (e.g., 22.04, 2022).
    *   Quantity (e.g., 5).
    *   Internet Facing? (Yes/No).

### Step 3: Data & Storage
*   **Mechanism:** Dynamic list for databases and storage.
*   **Fields per group:**
    *   Type (e.g., PostgreSQL, MongoDB, S3 Bucket).
    *   Purpose (e.g., Customer Data, Logs).

### Step 4: Crown Jewels
*   **Mechanism:** Checkboxes/Toggles mapping back to the defined infrastructure.
*   **Fields:** "Which of the databases/servers above contain your most critical business data?"

---

## 2. Backend: Graph Generation Factory

The `apps/api/src/routes/v1/onboarding.ts` endpoint will receive this structured JSON payload. We will build a **Graph Factory** to translate this into Neo4j nodes and edges.

### Multi-Tenant Isolation (Crucial)
*   **Strict Segregation:** Every single node created by the Graph Factory **must** have a `tenantId` property matching the organization's ID.
*   **Data Privacy:** This ensures that when the Graph Explorer runs, it exclusively queries `WHERE n.tenantId = $tenantId`. Organizations will only ever see the tailored graph representing their own infrastructure, ensuring complete data privacy and preventing cross-tenant leakage.

### Node Generation
1.  **Iterate Compute:** For every server group defined, generate `N` `(:Asset)` nodes.
    *   *Properties:* `tenantId`, `os`, `version`, `internetFacing`, `criticality` (default medium).
2.  **Iterate Data:** Generate `(:Asset {type: 'database', tenantId: $tenantId})` nodes.
3.  **Crown Jewels:** Mark the user-selected assets with an additional `(:CrownJewel)` label or link them to a specific `CrownJewel` node, ensuring the `tenantId` is stamped.

### Edge Generation (Intelligent Linking)
Instead of random links, the factory applies logical topology rules:
*   **Rule 1:** Create an `(:Asset {name: 'Internet'})` node.
*   **Rule 2:** Draw `[:CAN_ACCESS]` edges from 'Internet' to all assets marked `internetFacing: true`.
*   **Rule 3:** Draw `[:CAN_ACCESS]` edges from internet-facing web servers to internal application servers.
*   **Rule 4:** Draw `[:CAN_ACCESS]` edges from application servers to databases.

---

## 3. Contextual Vulnerability & Risk Engine

Once the basic topology is built, the system enriches it with threat intelligence.

### CVE Assignment
*   Create a mapping utility (or query an external DB/local cache like Valkey) that maps OS/Versions to known high-impact CVEs.
*   *Example:* If the user specified `Ubuntu 20.04`, the engine automatically creates `(:CVE)` nodes for known Ubuntu 20.04 exploits and draws `[:HAS_VULNERABILITY]` edges to those specific Ubuntu assets.

### Contextual Risk Scoring
A vulnerability's raw CVSS score is not enough. We calculate a **Contextual Risk Score (0-100)** for every vulnerability and attack path.

*   **Formula Component 1: Exploitability (CVE Base Score)** - How easy is it to exploit?
*   **Formula Component 2: Exposure** - Is the asset internet-facing? (+Multiplier)
*   **Formula Component 3: Blast Radius** - How many hops away is this asset from a Crown Jewel? (Fewer hops = Higher multiplier).

*Output:* The graph assigns a specific `Risk Rating` (Critical, High, Moderate, Low) to the paths, which is what the Dashboard will query and display.

---

## 4. Visualization Upgrade: The Graph Explorer

The current Dagre (Left-to-Right tree) layout will be replaced, as it is unsuitable for complex cyber topologies.

### Action Items:
1.  **Replace Layout Engine:** Migrate from `dagre` to `d3-force` (via `react-force-graph` or custom layout logic within React Flow) to allow organic, interconnected webs.
2.  **Tiered Layout (Optional):** Implement a "swimlane" layout where nodes naturally organize into DMZ (Internet-facing), Internal Network, and Secure Enclave (Databases/Crown Jewels).
3.  **Interactivity:**
    *   Clicking an Asset opens a side panel showing its OS, assigned CVEs, and contextual risk.
    *   Clicking a path highlights the entire route from the Internet to the Crown Jewel.

---

## 5. Execution Steps (Next Actions)

If approved, we will execute this in the following order:

1.  **[UI/UX]** Build the new multi-step React components for `/onboarding/organization`.
2.  **[API]** Update the Zod validation schemas to accept the new complex payload.
3.  **[Graph]** Write the `GraphFactory` class to handle dynamic Node/Edge creation based on the topological rules.
4.  **[Risk Engine]** Implement the mock CVE matcher and the Contextual Risk math.
5.  **[Visualization]** Swap the layout engine on the Graph Explorer page.

# Hosting ARGUS (Hybrid Cloud Deployment)

ARGUS is designed to be cloud-native. While Docker is used for local development, it is not required for production. However, because the backend API relies on long-running processes (like the background data ingestion scheduler), we recommend a hybrid deployment strategy:

1.  **Frontend**: Vercel (Next.js)
2.  **Backend**: Railway or Render (Docker/Bun)

## 1. Cloud Infrastructure Requirement
Replace the local Docker containers with these serverless-compatible cloud services:

* **PostgreSQL**: [Supabase](https://supabase.com) (Auth & Core Data)
  * *Note: Use the Supabase Connection Pooler URL (e.g., `aws-1-ap-southeast-2.pooler.supabase.com:5432`) in your `.env` to avoid connection limits and IPv6 resolution issues.*
* **Graph DB**: [Neo4j AuraDB](https://neo4j.com/cloud/aura/) (Relationship Graph)
* **Vector DB**: [Qdrant Cloud](https://qdrant.tech/cloud/) (Semantic Search)
* **Cache**: [Upstash Redis](https://upstash.com) (Session & API Cache)

## 2. API Deployment (Railway / Render)
The Hono backend (`apps/api`) should be deployed to a platform that supports Docker or native Bun runtimes to keep background schedulers alive.

1. Create a new service on **Railway** (or Render).
2. Connect your GitHub repository.
3. Configure the Build settings:
   * **Builder**: Docker
   * **Dockerfile Path**: `Dockerfile.api`
4. Set the necessary environment variables (`DATABASE_URL`, `NEO4J_URI`, `QDRANT_URL`, etc.).
5. Make sure to expose the `PORT` (default `4000`) and map it appropriately.

## 3. Web Deployment (Vercel)
Deploy the Next.js frontend to **Vercel** for the best edge performance.

1. Import your GitHub repository into Vercel.
2. Configure the project settings:
   * **Root Directory**: `apps/web`
   * **Framework Preset**: Next.js
   * **Build Command**: `bun run build`
3. Set the environment variables. Most importantly, ensure `API_URL` points to your newly deployed Railway/Render backend domain.

## 4. Local Development (No Docker)
To run locally without Docker, simply ensure your `.env` file points to the cloud URIs listed above. Then run:
```bash
.\run.bat
```
The script will now detect if Docker is missing and fallback to your cloud configuration automatically.

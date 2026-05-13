# Optional local infrastructure (Docker)

Neo4j, Qdrant, and Valkey can still be run locally for offline development:

```bash
bun run infra:docker:up
```

Defaults match `packages/config` (`NEO4J_*`, `QDRANT_URL`, `VALKEY_URL` in `.env.example`).

For a **Docker-free** workflow, use hosted services instead (Neo4j Aura, Qdrant Cloud, Upstash Redis) and point environment variables at those URLs. See `implementation2.md`.

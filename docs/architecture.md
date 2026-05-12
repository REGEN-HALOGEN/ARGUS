# ARGUS Architecture

## Overview

ARGUS is built as a Bun monorepo with two applications and five shared packages.

## Data Flow

```
User → Next.js Frontend → Hono API → Neo4j Graph DB
                                   → Qdrant Vector DB
                                   → Anthropic Claude AI
                                   → Valkey Cache
```

## Key Decisions

1. **Bun Monorepo**: Single lockfile, workspace linking, fast installs
2. **Hono**: Lightweight, Edge-ready, perfect for streaming AI responses
3. **Neo4j**: Native graph database for relationship queries and traversal
4. **Qdrant**: Vector search for semantic CVE/threat matching
5. **Valkey**: Redis-compatible cache for query results and sessions

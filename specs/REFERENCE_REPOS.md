# Reference Repositories

This project includes reference repositories as git subtrees in `reference/` for pattern discovery and API lookup.

## Effect (`reference/effect/`)

The core Effect library for functional TypeScript.

### Core Package (`reference/effect/packages/effect/src/`)

Essential modules for this project:

| Module | Path | Use For |
|--------|------|---------|
| **Effect** | `Effect.ts` | Core effect type, operations |
| **Schema** | `Schema.ts` | Validation, encoding/decoding |
| **Context** | `Context.ts` | Dependency injection |
| **Layer** | `Layer.ts` | Service composition |
| **Data** | `Data.ts` | Value objects, tagged unions |
| **Brand** | `Brand.ts` | Branded types (AccountId, etc.) |
| **Either** | `Either.ts` | Error handling |
| **Option** | `Option.ts` | Optional values |
| **Match** | `Match.ts` | Pattern matching |
| **BigDecimal** | `BigDecimal.ts` | Monetary calculations |
| **DateTime** | `DateTime.ts` | Date/time handling |
| **Duration** | `Duration.ts` | Time durations |
| **Struct** | `Struct.ts` | Object operations |
| **Record** | `Record.ts` | Record utilities |
| **Array** | `Array.ts` | Array utilities |
| **Stream** | `Stream.ts` | Streaming data |
| **Ref** | `Ref.ts` | Mutable references |
| **Queue** | `Queue.ts` | Async queues |
| **Config** | `Config.ts` | Configuration |
| **Fiber** | `Fiber.ts` | Concurrent execution |

**Search patterns in Effect:**
```bash
# Find service definitions
grep -r "Context.Tag" reference/effect/packages/effect/src/

# Find schema examples
grep -r "Schema.Struct" reference/effect/packages/effect/src/

# Find branded type examples
grep -r "Brand.nominal" reference/effect/packages/effect/src/

# Find Layer patterns
grep -r "Layer.succeed" reference/effect/packages/effect/src/
```

### SQL Packages (`reference/effect/packages/sql*/`)

Database integration for Effect:

| Package | Path | Description |
|---------|------|-------------|
| **sql** | `reference/effect/packages/sql/` | Core SQL abstractions |
| **sql-pg** | `reference/effect/packages/sql-pg/` | PostgreSQL client |
| **sql-drizzle** | `reference/effect/packages/sql-drizzle/` | Drizzle ORM integration (not used) |

**Search patterns for SQL:**
```bash
# Find repository patterns
grep -r "SqlClient" reference/effect/packages/sql/src/

# Find transaction patterns
grep -r "Effect.acquireRelease" reference/effect/packages/sql*/src/

# Find query patterns
grep -rn "sql\`" reference/effect/packages/sql*/src/
```

### Platform Packages (`reference/effect/packages/platform*/`)

Runtime platform abstractions:

| Package | Path | Description |
|---------|------|-------------|
| **platform** | `reference/effect/packages/platform/` | Core platform abstractions |
| **platform-node** | `reference/effect/packages/platform-node/` | Node.js runtime |
| **platform-browser** | `reference/effect/packages/platform-browser/` | Browser runtime |

**Key modules:**
- `HttpClient.ts` - HTTP client
- `HttpServer.ts` - HTTP server
- `FileSystem.ts` - File operations
- `Terminal.ts` - CLI utilities

### Other Effect Packages

| Package | Path | Description |
|---------|------|-------------|
| **vitest** | `reference/effect/packages/vitest/` | Testing utilities |
| **cli** | `reference/effect/packages/cli/` | CLI framework |
| **rpc** | `reference/effect/packages/rpc/` | RPC framework |
| **cluster** | `reference/effect/packages/cluster/` | Distributed systems |
| **workflow** | `reference/effect/packages/workflow/` | Workflow engine |
| **experimental** | `reference/effect/packages/experimental/` | Experimental features |

---

## Drizzle ORM (`reference/drizzle-orm/`)

Typescript ORM

We will be using the new drizzle-orm/effect-postgres package in pair with @effect/sql-pg


### Key Packages

| Package | Path | Description |
|---------|------|-------------|
| **pg-core** | `reference/drizzle-orm/drizzle-orm/src/pg-core/` | Main Start framework |
| **effect-core** | `reference/drizzle-orm/drizzle-orm/src/effect-core/` | Main Start framework |
| **effect-postgres** | `reference/drizzle-orm/drizzle-orm/src/effect-postgres/` | Main Start framework |


---

## TanStack Router/Start (`reference/tanstack-router/`)

Full-stack React framework.

### Key Packages

| Package | Path | Description |
|---------|------|-------------|
| **react-start** | `reference/tanstack-router/packages/react-start/` | Main Start framework |
| **react-router** | `reference/tanstack-router/packages/react-router/` | Router for React |
| **router-core** | `reference/tanstack-router/packages/router-core/` | Core router logic |
| **start-server-core** | `reference/tanstack-router/packages/start-server-core/` | Server-side core |
| **start-client-core** | `reference/tanstack-router/packages/start-client-core/` | Client-side core |

### Server Functions (`reference/tanstack-router/packages/react-start/src/`)

| File | Purpose |
|------|---------|
| `server.tsx` | Server-side rendering |
| `client.tsx` | Client hydration |
| `useServerFn.ts` | Server function hook |
| `server-rpc.ts` | Server RPC handling |
| `client-rpc.ts` | Client RPC calls |

**Search patterns for TanStack:**
```bash
# Find server function patterns
grep -r "createServerFn" reference/tanstack-router/packages/react-start/

# Find route definitions
grep -r "createRoute" reference/tanstack-router/packages/react-router/src/

# Find loader patterns
grep -r "loader:" reference/tanstack-router/packages/*/src/

# Find middleware patterns
grep -r "middleware" reference/tanstack-router/packages/start-server-core/src/
```

### Examples (`reference/tanstack-router/examples/`)

Real-world usage examples:

```bash
# List available examples
ls reference/tanstack-router/examples/

# Find Start examples
ls reference/tanstack-router/examples/ | grep start
```

---

## Common Search Patterns

### Finding Effect Patterns

```bash
# Schema definitions
grep -rn "Schema\." reference/effect/packages/effect/src/Schema.ts | head -50

# Service pattern (Context.Tag + Layer)
grep -rn "extends Context.Tag" reference/effect/packages/*/src/

# Error handling (tagged errors)
grep -rn "TaggedError" reference/effect/packages/effect/src/

# Branded types
grep -rn "Brand\." reference/effect/packages/effect/src/Brand.ts

# Effect.gen pattern
grep -rn "Effect.gen" reference/effect/packages/*/src/ | head -20

# BigDecimal operations (for monetary amounts)
grep -rn "BigDecimal\." reference/effect/packages/effect/src/BigDecimal.ts
```

### Finding Tests

```bash
# Effect tests
ls reference/effect/packages/effect/test/

# Find specific test patterns
grep -rn "it\(" reference/effect/packages/effect/test/ | head -20

# Find vitest patterns
grep -rn "describe\(" reference/effect/packages/vitest/test/
```

### Finding Type Definitions

```bash
# Find interface definitions
grep -rn "^export interface" reference/effect/packages/effect/src/

# Find type aliases
grep -rn "^export type" reference/effect/packages/effect/src/ | head -30
```

---

## Package Versions

To check package versions in the reference reference:

```bash
# Effect version
jq '.version' reference/effect/packages/effect/package.json

# TanStack Start version
jq '.version' reference/tanstack-router/packages/react-start/package.json

# Effect Atom version
jq '.version' reference/effect-atom/packages/atom/package.json
```



# Effect Testing

This document covers testing patterns using `@effect/vitest` and testcontainers.

> **See also**: [EFFECT_LAYERS.md](./EFFECT_LAYERS.md) for layer memoization semantics.

## Testing with @effect/vitest

Import from `@effect/vitest` for Effect-aware testing:

```typescript
import { describe, expect, it, layer } from "@effect/vitest"
import { Effect, TestClock, Fiber, Duration } from "effect"
```

## Test Variants

| Method | TestServices | Scope | Use Case |
|--------|--------------|-------|----------|
| `it.effect` | TestClock | No | Most tests - deterministic time |
| `it.live` | Real clock | No | Tests needing real time/IO |
| `it.scoped` | TestClock | Yes | Tests with resources (acquireRelease) |
| `it.scopedLive` | Real clock | Yes | Real time + resources |

### it.effect - Use for Most Tests (with TestClock)

```typescript
it.effect("processes after delay", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.fork(
      Effect.sleep(Duration.minutes(5)).pipe(Effect.map(() => "done"))
    )
    yield* TestClock.adjust(Duration.minutes(5))
    const result = yield* Fiber.join(fiber)
    expect(result).toBe("done")
  })
)
```

### it.live - Use When You Need Real Time/External IO

```typescript
it.live("calls external API", () =>
  Effect.gen(function* () {
    yield* Effect.sleep(Duration.millis(100)) // Actually waits
  })
)
```

## Sharing Layers Between Tests

```typescript
import { layer } from "@effect/vitest"

layer(MyServiceLive)("MyService", (it) => {
  it.effect("does something", () =>
    Effect.gen(function* () {
      const service = yield* MyService
      // ...
    })
  )

  // Nested layers
  it.layer(AnotherServiceLive)("with another", (it) => {
    it.effect("uses both", () =>
      Effect.gen(function* () {
        const my = yield* MyService
        const another = yield* AnotherService
      })
    )
  })
})
```

## Property-Based Testing

FastCheck is re-exported from `effect/FastCheck`. Use `it.prop` and `it.effect.prop` for property testing.

```typescript
import { it } from "@effect/vitest"
import { Effect, FastCheck, Schema, Arbitrary } from "effect"

it.prop("symmetry", [Schema.Number, FastCheck.integer()], ([a, b]) =>
  a + b === b + a
)

it.effect.prop("effectful prop", [Schema.String], ([s]) =>
  Effect.succeed(s.length >= 0)
)
```

## Testing Database-Dependent Code

Use `@testcontainers/postgresql` to run integration tests against a real PostgreSQL instance.

### Container Layer Pattern

Wrap the container lifecycle in an `Effect.Service` with scoped acquisition:

```typescript
import { PgClient } from "@effect/sql-pg"
import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { Data, Effect, Layer, Redacted } from "effect"

class ContainerError extends Data.TaggedError("ContainerError")<{ cause: unknown }> {}

class PgContainer extends Effect.Service<PgContainer>()("test/PgContainer", {
  scoped: Effect.acquireRelease(
    Effect.tryPromise({
      try: () => new PostgreSqlContainer("postgres:17-alpine").start(),
      catch: (cause) => new ContainerError({ cause })
    }),
    (container) => Effect.promise(() => container.stop())
  )
}) {
  static readonly ClientLive = Layer.unwrapEffect(
    Effect.gen(function* () {
      const container = yield* PgContainer
      return PgClient.layer({ url: Redacted.make(container.getConnectionUri()) })
    })
  ).pipe(Layer.provide(this.Default))
}
```

### Running Migrations

Use Drizzle's Effect-native migrator:

```typescript
import { migrate } from "drizzle-orm/effect-postgres/migrator"

const MigrationLive = Layer.effectDiscard(
  Effect.gen(function* () {
    const db = yield* Database
    yield* migrate(db, { migrationsFolder: "./drizzle" })
  })
)
```

### Composing Test Layers

Use `DefaultWithoutDependencies` to inject test infrastructure:

```typescript
const TestDatabaseLive = MigrationLive.pipe(
  Layer.provideMerge(Database.DefaultWithoutDependencies),
  Layer.provideMerge(PgContainer.ClientLive)
)

const TestLayer = MyRepository.DefaultWithoutDependencies.pipe(
  Layer.provideMerge(TestDatabaseLive)
)
```

### Writing Tests

```typescript
it.layer(TestLayer, { timeout: "30 seconds" })("MyRepository", (it) => {
  it.effect("creates and retrieves", () =>
    Effect.gen(function* () {
      const repo = yield* MyRepository
      const created = yield* repo.create({ name: "test" })
      const found = yield* repo.findById(created.id)
      expect(found?.name).toBe("test")
    })
  )
})
```

### Key Points

- **Container per `it.layer` block**: Each block gets its own PostgreSQL container (isolated but slower)
- **Use `DefaultWithoutDependencies`**: Inject test dependencies instead of production ones
- **Timeout for container startup**: Use `{ timeout: "30 seconds" }` to avoid test timeouts
- **Drizzle migrator for schema**: Use `migrate()` instead of raw SQL to match production schema

## DefaultWithoutDependencies Pattern

Services defined with `Effect.Service` provide two layer variants:

| Layer | Description | Use Case |
|-------|-------------|----------|
| `Foo.Default` | Includes all dependencies | Production |
| `Foo.DefaultWithoutDependencies` | Requires dependencies to be provided | Testing |

This lets you swap production dependencies (like a real database) for test ones (like a container) without changing service implementations.

## Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
  }
})
```

## Future: Shared Container

For faster tests, you can use vitest's `globalSetup` to start ONE container before all tests. Start with per-block containers; switch to shared when test runtime becomes a problem.


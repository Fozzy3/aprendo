# TypeScript Conventions

This document describes TypeScript configuration and module conventions for this project.

## TypeScript Configuration

This monorepo uses **bundler mode** with `noEmit: true`. TypeScript only performs type checking - bundlers (Vite, Bun) handle the actual compilation.

Each package has a simple `tsconfig.json` that extends the base config:

```json
// packages/*/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

The base config at `tsconfig.base.json` configures:
- `moduleResolution: "bundler"` - Modern bundler-friendly resolution
- `noEmit: true` - TypeScript only typechecks, no output files
- `verbatimModuleSyntax: true` - Explicit import/export type annotations
- `strict: true` - All strict type checking options enabled

**Why bundler mode instead of project references with emit?**
- Simpler configuration (one tsconfig per package)
- Works seamlessly with Vite/Bun which handle imports directly
- No build artifacts to manage
- Faster iteration during development

## Module Resolution and Imports

This project uses `moduleResolution: "bundler"` with direct `.ts` imports:

```json
// tsconfig.base.json (relevant options)
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "noEmit": true
  }
}
```

Since we use `noEmit: true`, there's no compiled output - bundlers import `.ts` files directly via package.json exports.

### Relative Imports: Always Use `.ts` Extension

```typescript
// CORRECT - relative imports use .ts extension
import { Account } from "./domain/Account.ts"
import { MonetaryAmount } from "./domain/MonetaryAmount.ts"
import { AccountService } from "./services/AccountService.ts"

// WRONG - don't use .js extension for relative imports
import { Account } from "./domain/Account.js"
```

### Package Imports: Never Use Extensions

```typescript
// CORRECT - package imports are extensionless
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import { PgClient } from "@effect/sql-pg"

// WRONG - don't use extensions for package imports
import * as Effect from "effect/Effect.js"
import * as Schema from "effect/Schema.ts"
```

Package resolution relies on properly configured `package.json` exports - no extensions needed.

### NEVER Include `/src/` in Package Imports

```typescript
// CORRECT - no /src/ in path
import { CompanyRepository } from "@accountability/persistence/CompanyRepository"
import { Account } from "@accountability/core/Account"

// WRONG - NEVER include /src/ in imports
import { CompanyRepository } from "@accountability/persistence/src/CompanyRepository"
import { CompanyRepository } from "@accountability/persistence/src/CompanyRepository.ts"
```

The `package.json` exports field maps the public API - `/src/` is an implementation detail that should never appear in imports.

## NEVER Use index.ts Barrel Files

**This is a strict rule: NEVER create index.ts files.** Barrel files cause:
- Circular dependency issues
- Slower build times (importing everything when you need one thing)
- Harder to trace imports
- Bundle size bloat

```typescript
// CORRECT - import from specific module
import { Account, AccountId } from "./domain/Account.ts"
import { MonetaryAmount } from "./domain/MonetaryAmount.ts"

// WRONG - NEVER do this
import { Account, MonetaryAmount } from "./domain/index.ts"

// WRONG - NEVER create files like this
// index.ts
export * from "./Account.ts"
export * from "./MonetaryAmount.ts"
```

If you see an index.ts file, delete it and update imports to point to specific modules.

## Module Structure - Flat Modules, No Barrel Files

**Avoid barrel files** (index.ts re-exports). Create flat, focused modules:

```
packages/core/src/
├── CurrencyCode.ts      # NOT domain/currency/CurrencyCode.ts + index.ts
├── AccountId.ts
├── Account.ts
├── AccountError.ts
├── AccountService.ts
└── Money.ts
```

**Each module should be self-contained:**

```typescript
// CurrencyCode.ts - everything related to CurrencyCode in one file
import * as Schema from "effect/Schema"

export class CurrencyCode extends Schema.Class<CurrencyCode>("CurrencyCode")({
  code: Schema.String.pipe(Schema.length(3)),
  name: Schema.String,
  symbol: Schema.String,
  decimalPlaces: Schema.Number
}) {}

export const isoCurrencies = {
  USD: CurrencyCode.make({ code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 }),
  EUR: CurrencyCode.make({ code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2 }),
  // ...
}
```



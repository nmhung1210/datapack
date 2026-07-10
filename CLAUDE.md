# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`datapack` is a high-performance binary serialization library for JavaScript/TypeScript. It provides `pack` and `unpack` functions that serialize/deserialize data using schema definitions. Works in both Node.js and browser environments.

## Commands

- **Build:** `npm run build` (Rollup → CJS, ESM, UMD outputs in `dist/`)
- **Test:** `npm test` (ts-mocha with all `src/**/*.spec.ts` files)
- **Single test:** `npx ts-mocha -p tsconfig.test.json src/index.spec.ts`
- **Coverage:** `npm run coverage` (nyc)
- **Benchmark:** `npm run benchmark`

## Architecture

The library is 4 source files in `src/`:

- **`utils.ts`** — `DataTypes` enum (UINT8, INT8, UINT16, INT16, INT32, UINT32, UINT64, INT64, BOOL, FLOAT, BINARY, STRING, OBJECT, plus a computed `_TYPE` member per type for the optional variant `TYPE | UNDEFINED`). The `UNDEFINED = 0x100` marker bit is a standalone exported const (not an enum member). Also holds the `Schema` type definition, `IPackConfig` interface, and the `SchemaToType` conditional type that infers TypeScript types from schemas.
- **`packer.ts`** — `pack(data, schema, options?)` function. Uses a shared growable Buffer with offset tracking. Handles primitive types, arrays (length-prefixed with UINT32), and nested objects. After packing, optionally applies XOR-style encryption and appends a checksum.
- **`unpacker.ts`** — `unpack(data, schema, options?)` function. Reverses encryption/checksum, then reads values using a dispatch table (`unpackerFunctions`) keyed by `DataTypes`. Returns fully typed result via `SchemaToType<S>`.
- **`index.ts`** — Re-exports everything from the other three modules.

### Key design patterns

- **Schema-driven:** Schemas are plain objects/arrays/DataTypes enums. Array schemas use modulo indexing (`schema[i % schema.length]`) to support repeating patterns.
- **Optional values:** a schema tag with the `UNDEFINED` (`0x100`) bit set (e.g. `UINT8 | UNDEFINED` or the `_UINT8` alias) is detected at runtime via `schema & UNDEFINED`; the base type is `schema & ~UNDEFINED`. On the wire it's a presence byte (1/0) followed by the value only when present. Handled in all four traversals: `doPackCtx`, `doUnpackDec` (encrypted path), `doUnpack` (plain path), and `skipSchema` (parallel split).
- **Big-endian byte order** for all numeric types.
- **Options:** `useCheckSum` (2-byte checksum appended), `useEncrypt` (byte-level XOR with position + secret), `chunkSize`, `secret`.
- **TypeScript type inference:** `SchemaToType<S>` recursively maps schema structures to their corresponding TS types, giving full type safety on `unpack` return values.

### Build outputs

Rollup produces three formats: `dist/index.js` (CJS), `dist/index.mjs` (ESM), `dist/index.umd.js` (UMD, minified). Browser polyfill for Node's Buffer is included via `rollup-plugin-polyfill-node`.


## Working Style

- Minimize token usage — be concise, no fluff
- Solve requests with minimum diff — don't refactor unrelated code
- Always run `/simplify` after making changes
- Don't explain changes unless asked
- Skip extra verification steps (tests, lint, etc.) unless the task requires them

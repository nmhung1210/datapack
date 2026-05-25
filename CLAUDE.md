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

- **`utils.ts`** — `DataTypes` enum (UINT8, INT8, UINT16, INT16, INT32, UINT32, UINT64, INT64, BOOL, FLOAT, BINARY, STRING, OBJECT), `Schema` type definition, `IPackConfig` interface, and the `SchemaToType` conditional type that infers TypeScript types from schemas.
- **`packer.ts`** — `pack(data, schema, options?)` function. Uses a shared growable Buffer with offset tracking. Handles primitive types, arrays (length-prefixed with UINT32), and nested objects. After packing, optionally applies XOR-style encryption and appends a checksum.
- **`unpacker.ts`** — `unpack(data, schema, options?)` function. Reverses encryption/checksum, then reads values using a dispatch table (`unpackerFunctions`) keyed by `DataTypes`. Returns fully typed result via `SchemaToType<S>`.
- **`index.ts`** — Re-exports everything from the other three modules.

### Key design patterns

- **Schema-driven:** Schemas are plain objects/arrays/DataTypes enums. Array schemas use modulo indexing (`schema[i % schema.length]`) to support repeating patterns.
- **Big-endian byte order** for all numeric types.
- **Options:** `useCheckSum` (2-byte checksum appended), `useEncrypt` (byte-level XOR with position + secret), `chunkSize`, `secret`.
- **TypeScript type inference:** `SchemaToType<S>` recursively maps schema structures to their corresponding TS types, giving full type safety on `unpack` return values.

### Build outputs

Rollup produces three formats: `dist/index.js` (CJS), `dist/index.mjs` (ESM), `dist/index.umd.js` (UMD, minified). Browser polyfill for Node's Buffer is included via `rollup-plugin-polyfill-node`.

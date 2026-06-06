# datapack

[![npm version](https://badge.fury.io/js/datapack.svg)](https://badge.fury.io/js/datapack)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/datapack.svg)](https://www.npmjs.com/package/datapack)

A high-performance JavaScript library for packing and unpacking binary data with a schema-based approach. Optimized for both Node.js and browser environments, datapack provides a simple and efficient way to serialize and deserialize complex data structures.

## Features

- **Compact binary format** — 3–4.5× smaller than JSON, and faster to pack/unpack (see [Benchmark](#benchmark)).
- **Schema-driven** — describe your data once with plain objects, arrays, and `DataTypes` constants.
- **Full TypeScript inference** — `unpack` returns a type derived from your schema, no manual annotations needed.
- **14 data types** — fixed-width integers (8/16/32/64-bit, signed and unsigned), 32- and 64-bit floats, booleans, UTF-8 strings, raw binary, and arbitrary JSON objects.
- **Optional integrity & obfuscation** — a position-weighted checksum to detect corruption and a keystream byte cipher, both opt-out.
- **Range validation** — out-of-range or non-integer values are rejected at pack time with a `RangeError` instead of silently truncating.
- **Parallel-friendly** — pack/unpack object fields independently for use with Web Workers or `worker_threads`.
- **Zero dependencies** — built on native `Uint8Array`, `DataView`, `TextEncoder`, and `TextDecoder`.

## Installation

```
npm install datapack
```

## Usage

### Simple value

```javascript
import { pack, unpack, UINT8 } from "datapack";

const packed = pack(100, UINT8);
const unpacked = unpack(packed, UINT8);

console.log(unpacked); // 100
```

### Array

```javascript
import { pack, unpack, UINT8, INT16 } from "datapack";

const schema = [UINT8, INT16];
const value = [100, 200, 50];
const packed = pack(value, schema);
const unpacked = unpack(packed, schema);

console.log(unpacked); // [100, 200, 50]
```

### Object

```javascript
import { pack, unpack, UINT16, INT8 } from "datapack";

const schema = {
  aaa: [UINT16],
  obj1: {
    obj11: UINT16,
    obj4: [INT8],
  },
};
const value = {
  aaa: [1],
  obj1: {
    obj11: 2,
    obj4: [2],
  },
};
const packed = pack(value, schema);
const unpacked = unpack(packed, schema);

console.log(unpacked);
```

## TypeScript Support

`datapack` is written in TypeScript and comes with first-class type support.

### Dynamic Type Generation

One of the most powerful features of `datapack` is its ability to generate TypeScript types dynamically from your schema. When you use the `unpack` function, the return type is automatically inferred from the schema you provide. This gives you full type safety and autocompletion for your unpacked data, eliminating guesswork and reducing runtime errors.

Here's an example of how it works:

```typescript
import { pack, unpack, UINT32, STRING, BOOL, UINT8 } from "datapack";

const profileSchema = {
  userId: UINT32,
  nickName: STRING,
  isVip: BOOL,
  age: UINT8,
};

const profileData = {
  userId: 101,
  nickName: "Alice",
  isVip: true,
  age: 34,
};

const packedProfile = pack(profileData, profileSchema);

// The 'unpackedProfile' variable will have a fully typed structure:
// {
//   userId: number;
//   nickName: string;
//   isVip: boolean;
//   age: number;
// }
const unpackedProfile = unpack(packedProfile, profileSchema);

// You get autocompletion and type checking!
console.log(unpackedProfile.nickName.toUpperCase()); // Works!
// console.log(unpackedProfile.invalidProperty); // TypeScript error!
```

### `defineSchema` helper

When you declare a schema as a standalone constant, use `defineSchema` to preserve the literal types so inference still works. It returns the schema unchanged at runtime — it exists purely to lock in the `const` types.

```typescript
import { defineSchema, pack, unpack, UINT32, STRING } from "datapack";

const userSchema = defineSchema({
  id: UINT32,
  name: STRING,
});

const packed = pack({ id: 1, name: "Alice" }, userSchema);
const user = unpack(packed, userSchema); // typed as { id: number; name: string }
```

### Complex data structures

```javascript
import { pack, unpack, UINT32, STRING, BOOL, UINT8, UINT16 } from "datapack";

const profileSchema = {
  userId: UINT32,
  nickName: STRING,
  isVip: BOOL,
  age: UINT8,
};

const stateDataSchema = {
  users: [profileSchema],
  posts: [
    {
      postId: UINT32,
      title: STRING,
      score: UINT16,
      authors: [profileSchema],
    },
  ],
};

const stateData = {
  users: [
    {
      userId: 101,
      nickName: "ABC",
      isVip: true,
      age: 34,
    },
  ],
  posts: [
    {
      postId: 100,
      title: "Hello World!",
      score: 999,
      authors: [
        {
          userId: 102,
          nickName: "DEF",
          isVip: false,
          age: 28,
        },
      ],
    },
  ],
};

const packedState = pack(stateData, stateDataSchema);
const unpackedState = unpack(packedState, stateDataSchema);

console.log(unpackedState);
```

### Options

The `pack` and `unpack` functions accept an optional `options` object that allows you to enable checksum validation and encryption.

```javascript
import { pack, unpack, UINT8, STRING } from "datapack";

const schema = {
  a: UINT8,
  b: STRING,
};
const data = {
  a: 255,
  b: "test string",
};
const options = {
  useCheckSum: true,
  useEncrypt: true,
  secret: 123,
};

const packed = pack(data, schema, options);
const unpacked = unpack(packed, schema, options);

console.log(unpacked);
```

How the options behave on the wire:

- **`useCheckSum`** appends a 2-byte, big-endian checksum computed as a _position-weighted_ byte sum (`Σ byte[i] * (i + 1)`, mod 65536). Unlike a plain byte sum it is sensitive to byte transpositions and shifts, so reordered or moved bytes are detected. A mismatch throws `Data mismatch!` on unpack.
- **`useEncrypt`** shifts each byte by a position-keyed keystream byte derived from `secret` (`byte + keystream(secret, index)`, mod 256), reversed on unpack. The keystream uses an avalanche hash of the seed and position, so identical plaintext bytes encrypt to unrelated values and the shift isn't linearly predictable. It is still lightweight obfuscation, not cryptographically secure — use TLS or a real cipher for sensitive data. Pack and unpack must use the same `secret`.
- When both are enabled, the checksum is computed over the plaintext, then the bytes are encrypted; unpack decrypts first and then validates.

### Range Validation

Integer types are validated when packing. Passing a non-integer or an out-of-range value throws a `RangeError` rather than silently wrapping or truncating:

```javascript
pack(256, UINT8); // RangeError: Value out of range for UINT8 (0..255).
pack(-1, UINT8); // RangeError
pack(1.5, INT32); // RangeError: non-integer
```

### Default Configuration

You can set global defaults so you don't need to pass options on every call:

```javascript
import { setDefaultConfig, pack, unpack, UINT8 } from "datapack";

// Disable encryption and checksum globally
setDefaultConfig({ useEncrypt: false, useCheckSum: false });

// Now all pack/unpack calls use these defaults
const packed = pack(42, UINT8);
const unpacked = unpack(packed, UINT8);

// You can still override per-call
const encrypted = pack(42, UINT8, { useEncrypt: true, secret: 999 });
```

### Parallel Pack/Unpack

For large object schemas, you can pack and unpack each field independently. This enables parallelism when using Web Workers or `worker_threads`.

```javascript
import {
  packParts,
  combinePackedParts,
  packParallel,
  splitPackedParts,
  unpackPart,
  unpackParallel,
  UINT32,
  STRING,
  UINT8,
  BOOL,
} from "datapack";

const schema = {
  users: [{ userId: UINT32, name: STRING }],
  count: UINT8,
  active: BOOL,
};

const data = {
  users: [
    { userId: 1, name: "Alice" },
    { userId: 2, name: "Bob" },
  ],
  count: 2,
  active: true,
};

// Pack each field separately (can be distributed to workers)
const parts = packParts(data, schema);
const packed = combinePackedParts(parts, Object.keys(schema));

// Or use the convenience async wrapper
const packed2 = await packParallel(data, schema);

// Split packed buffer into per-field slices (for parallel unpack)
const fieldSlices = splitPackedParts(packed, schema, {
  useCheckSum: false,
  useEncrypt: false,
});

// Unpack individual fields
const users = unpackPart(fieldSlices.users, schema.users);

// Or use the convenience async wrapper
const result = await unpackParallel(packed, schema);
```

### All Data Types

```javascript
import {
  pack,
  unpack,
  UINT8,
  INT8,
  UINT16,
  INT16,
  INT32,
  BOOL,
  STRING,
  OBJECT,
  UINT64,
  INT64,
  BINARY,
  UINT32,
  FLOAT,
  FLOAT64,
} from "datapack";

// UINT8
const packed_UINT8 = pack(100, UINT8);
const unpacked_UINT8 = unpack(packed_UINT8, UINT8);
console.log(unpacked_UINT8); // 100

// INT8
const packed_INT8 = pack(100, INT8);
const unpacked_INT8 = unpack(packed_INT8, INT8);
console.log(unpacked_INT8); // 100

// UINT16
const packed_UINT16 = pack(10000, UINT16);
const unpacked_UINT16 = unpack(packed_UINT16, UINT16);
console.log(unpacked_UINT16); // 10000

// INT16
const packed_INT16 = pack(4000, INT16);
const unpacked_INT16 = unpack(packed_INT16, INT16);
console.log(unpacked_INT16); // 4000

// INT32
const packed_INT32 = pack(2000000000, INT32);
const unpacked_INT32 = unpack(packed_INT32, INT32);
console.log(unpacked_INT32); // 2000000000

// FLOAT (32-bit, single precision)
const packed_FLOAT = pack(123.456, FLOAT);
const unpacked_FLOAT = unpack(packed_FLOAT, FLOAT);
console.log(unpacked_FLOAT); // 123.456 (32-bit precision)

// FLOAT64 (64-bit, double precision)
const packed_FLOAT64 = pack(123.456789012345, FLOAT64);
const unpacked_FLOAT64 = unpack(packed_FLOAT64, FLOAT64);
console.log(unpacked_FLOAT64); // 123.456789012345 (full double precision)

// BOOL
const packed_BOOL_true = pack(true, BOOL);
const unpacked_BOOL_true = unpack(packed_BOOL_true, BOOL);
console.log(unpacked_BOOL_true); // true

// STRING
const packed_STRING = pack("abc", STRING);
const unpacked_STRING = unpack(packed_STRING, STRING);
console.log(unpacked_STRING); // "abc"

// OBJECT (arbitrary JSON-serializable data)
const packed_OBJECT = pack({ abc: 100 }, OBJECT);
const unpacked_OBJECT = unpack(packed_OBJECT, OBJECT);
console.log(unpacked_OBJECT); // { abc: 100 }

// UINT64
const packed_UINT64 = pack(BigInt("10000000000"), UINT64);
const unpacked_UINT64 = unpack(packed_UINT64, UINT64);
console.log(unpacked_UINT64); // 10000000000n

// INT64
const packed_INT64 = pack(BigInt("-10000000000"), INT64);
const unpacked_INT64 = unpack(packed_INT64, INT64);
console.log(unpacked_INT64); // -10000000000n

// BINARY (Uint8Array)
const packed_BINARY = pack(new Uint8Array([0x61, 0x62, 0x63]), BINARY);
const unpacked_BINARY = unpack(packed_BINARY, BINARY);
console.log(unpacked_BINARY); // Uint8Array [97, 98, 99]
```

## Benchmark

**Host Specs:**

- **CPU:** 10 cores
- **OS:** Linux
- **Node.js:** v24

**Results (datapack with no checksum/encryption vs. native JSON — the fairest head-to-head, since JSON provides neither):**

| Scenario                      | Datapack (pack)     | JSON (stringify)   | Datapack (unpack)  | JSON (parse)       |
| ----------------------------- | ------------------- | ------------------ | ------------------ | ------------------ |
| Simple object (number fields) | ~11,650,000 ops/sec | ~4,519,000 ops/sec | ~6,974,000 ops/sec | ~3,399,000 ops/sec |
| Complex object (10x nested)   | ~470,000 ops/sec    | ~448,000 ops/sec   | ~332,000 ops/sec   | ~173,000 ops/sec   |
| Big object (~1MB)             | ~313 ops/sec        | ~174 ops/sec       | ~130 ops/sec       | ~89 ops/sec        |

**Key takeaways:**

- **Simple objects:** pack is ~2.6x faster than JSON.stringify, unpack is ~2.1x faster than JSON.parse
- **Complex objects:** unpack is ~1.9x faster than JSON.parse, pack roughly matches JSON.stringify
- **Large objects (~1MB):** pack is ~1.8x faster than JSON.stringify, unpack is ~1.5x faster than JSON.parse
- **Binary size:** 3-4.5x smaller than JSON for equivalent data

**Cost of the optional layers** (relative to bare pack/unpack, measured on the same scenarios):

- **Checksum** (position-weighted byte sum) adds ~5% on small payloads, scaling to ~20-25% on a 1MB object — one extra O(n) arithmetic pass.
- **Encryption** (position-keyed keystream byte shift) is nearly free on pack and, on unpack, often _faster_ than the plain path thanks to the fused inline-decrypt parser.

### Packed Size Comparison

| Scenario                      | Datapack Size   | JSON Size       | Reduction   |
| ----------------------------- | --------------- | --------------- | ----------- |
| Simple object (number fields) | 18 bytes        | 82 bytes        | 78% smaller |
| Complex object                | 528 bytes       | 1,731 bytes     | 70% smaller |
| Big object (~1MB)             | 1,300,008 bytes | 4,275,021 bytes | 70% smaller |

## API Reference

### Core Functions

| Function                         | Description                                                       |
| -------------------------------- | ----------------------------------------------------------------- |
| `pack(data, schema, options?)`   | Pack data into binary format                                      |
| `unpack(data, schema, options?)` | Unpack binary data back to JS values                              |
| `setDefaultConfig(options)`      | Set global default options for all pack/unpack calls              |
| `defineSchema(schema)`           | Identity helper that preserves literal schema types for inference |

### Parallel API

| Function                                    | Description                               |
| ------------------------------------------- | ----------------------------------------- |
| `packParts(data, schema)`                   | Pack each object field separately         |
| `combinePackedParts(parts, keys, options?)` | Combine field parts into final buffer     |
| `packParallel(data, schema, options?)`      | Convenience async pack with auto-split    |
| `splitPackedParts(data, schema, options?)`  | Split packed buffer into per-field slices |
| `unpackPart(part, schema)`                  | Unpack a single field slice               |
| `unpackParallel(data, schema, options?)`    | Convenience async unpack with auto-split  |

### Options

| Option        | Type    | Default | Description                                                           |
| ------------- | ------- | ------- | --------------------------------------------------------------------- |
| `useCheckSum` | boolean | `true`  | Append a 2-byte position-weighted checksum for integrity validation   |
| `useEncrypt`  | boolean | `true`  | Apply a position-keyed keystream byte-shift cipher                    |
| `secret`      | number  | `1210`  | Encryption key — must be an integer and match between pack and unpack |
| `chunkSize`   | number  | `10240` | Initial pack buffer size in bytes; grows automatically as needed      |

### Data Types

| Type      | Size        | Range                              |
| --------- | ----------- | ---------------------------------- |
| `UINT8`   | 1 byte      | 0 to 255                           |
| `INT8`    | 1 byte      | -128 to 127                        |
| `UINT16`  | 2 bytes     | 0 to 65,535                        |
| `INT16`   | 2 bytes     | -32,768 to 32,767                  |
| `UINT32`  | 4 bytes     | 0 to 4,294,967,295                 |
| `INT32`   | 4 bytes     | -2,147,483,648 to 2,147,483,647    |
| `UINT64`  | 8 bytes     | 0 to 2^64-1 (BigInt)               |
| `INT64`   | 8 bytes     | -2^63 to 2^63-1 (BigInt)           |
| `FLOAT`   | 4 bytes     | 32-bit IEEE 754 (single precision) |
| `FLOAT64` | 8 bytes     | 64-bit IEEE 754 (double precision) |
| `BOOL`    | 1 byte      | true/false                         |
| `STRING`  | 4 + n bytes | UTF-8 encoded string               |
| `BINARY`  | 4 + n bytes | Raw Uint8Array                     |
| `OBJECT`  | 4 + n bytes | JSON-serialized object             |

All multi-byte numeric values use **big-endian** byte order. Variable-length types (`STRING`, `BINARY`, `OBJECT`) are prefixed with a 4-byte unsigned length. Array schemas are length-prefixed with a `UINT32` count, and the schema entries repeat (via modulo indexing) to cover every element — so `[UINT8, INT16]` describes a sequence that alternates `UINT8`, `INT16`, `UINT8`, …

## Compatibility

Works in both Node.js and browser environments. No external dependencies — uses native `Uint8Array`, `DataView`, `TextEncoder`, and `TextDecoder` APIs.

## License

MIT

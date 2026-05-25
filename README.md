
# datapack

[![npm version](https://badge.fury.io/js/datapack.svg)](https://badge.fury.io/js/datapack)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/datapack.svg)](https://www.npmjs.com/package/datapack)

A high-performance JavaScript library for packing and unpacking binary data with a schema-based approach. Optimized for both Node.js and browser environments, datapack provides a simple and efficient way to serialize and deserialize complex data structures.

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

### Parallel Pack/Unpack

For large object schemas, you can pack and unpack each field independently. This enables parallelism when using Web Workers or `worker_threads`.

```javascript
import {
  packParts, combinePackedParts, packParallel,
  splitPackedParts, unpackPart, unpackParallel,
  UINT32, STRING, UINT8, BOOL
} from "datapack";

const schema = {
  users: [{ userId: UINT32, name: STRING }],
  count: UINT8,
  active: BOOL,
};

const data = {
  users: [{ userId: 1, name: "Alice" }, { userId: 2, name: "Bob" }],
  count: 2,
  active: true,
};

// Pack each field separately (can be distributed to workers)
const parts = packParts(data, schema);
const packed = combinePackedParts(parts, Object.keys(schema));

// Or use the convenience async wrapper
const packed2 = await packParallel(data, schema);

// Split packed buffer into per-field slices (for parallel unpack)
const fieldSlices = splitPackedParts(packed, schema, { useCheckSum: false, useEncrypt: false });

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

// FLOAT
const packed_FLOAT = pack(123.456, FLOAT);
const unpacked_FLOAT = unpack(packed_FLOAT, FLOAT);
console.log(unpacked_FLOAT); // 123.456 (32-bit precision)

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

*   **CPU:** Apple M1 Pro
*   **RAM:** 16GB
*   **OS:** macOS
*   **Node.js:** v22

**Results (with encryption + checksum enabled):**

| Scenario | Datapack (pack) | Datapack (unpack) | JSON (stringify) | JSON (parse) |
|---|---|---|---|---|
| Simple object (number fields) | ~4,310,000 ops/sec | ~3,519,000 ops/sec | ~3,302,000 ops/sec | ~3,484,000 ops/sec |
| Complex object (10x nested) | ~441,000 ops/sec | ~287,000 ops/sec | ~480,000 ops/sec | ~230,000 ops/sec |
| Big object (~1MB) | ~202 ops/sec | ~100 ops/sec | ~179 ops/sec | ~97 ops/sec |

**Key takeaways:**
- **Simple objects:** pack is 30% faster than JSON.stringify, unpack matches JSON.parse
- **Complex objects:** unpack is 25% faster than JSON.parse
- **Large objects (~1MB):** pack is 13% faster than JSON.stringify, unpack matches JSON.parse
- **Binary size:** 3-4x smaller than JSON for equivalent data

### Packed Size Comparison

| Scenario | Datapack Size | JSON Size | Reduction |
|---|---|---|---|
| Simple object (number fields) | 20 bytes | 82 bytes | 76% smaller |
| Complex object | 530 bytes | 1,731 bytes | 69% smaller |
| Big object (~1MB) | 1,300,010 bytes | 4,275,021 bytes | 70% smaller |

## API Reference

### Core Functions

| Function | Description |
|---|---|
| `pack(data, schema, options?)` | Pack data into binary format |
| `unpack(data, schema, options?)` | Unpack binary data back to JS values |

### Parallel API

| Function | Description |
|---|---|
| `packParts(data, schema)` | Pack each object field separately |
| `combinePackedParts(parts, keys, options?)` | Combine field parts into final buffer |
| `packParallel(data, schema, options?)` | Convenience async pack with auto-split |
| `splitPackedParts(data, schema, options?)` | Split packed buffer into per-field slices |
| `unpackPart(part, schema)` | Unpack a single field slice |
| `unpackParallel(data, schema, options?)` | Convenience async unpack with auto-split |

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `useCheckSum` | boolean | `true` | Append checksum for data integrity validation |
| `useEncrypt` | boolean | `true` | Apply byte-level encryption |
| `secret` | number | `1210` | Encryption key |

### Data Types

| Type | Size | Range |
|---|---|---|
| `UINT8` | 1 byte | 0 to 255 |
| `INT8` | 1 byte | -128 to 127 |
| `UINT16` | 2 bytes | 0 to 65,535 |
| `INT16` | 2 bytes | -32,768 to 32,767 |
| `UINT32` | 4 bytes | 0 to 4,294,967,295 |
| `INT32` | 4 bytes | -2,147,483,648 to 2,147,483,647 |
| `UINT64` | 8 bytes | 0 to 2^64-1 (BigInt) |
| `INT64` | 8 bytes | -2^63 to 2^63-1 (BigInt) |
| `FLOAT` | 4 bytes | 32-bit IEEE 754 |
| `BOOL` | 1 byte | true/false |
| `STRING` | 4 + n bytes | UTF-8 encoded string |
| `BINARY` | 4 + n bytes | Raw Uint8Array |
| `OBJECT` | 4 + n bytes | JSON-serialized object |

## Compatibility

Works in both Node.js and browser environments. No external dependencies — uses native `Uint8Array`, `DataView`, `TextEncoder`, and `TextDecoder` APIs.

## License

MIT

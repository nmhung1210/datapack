# datapack

[![npm version](https://badge.fury.io/js/datapack.svg)](https://badge.fury.io/js/datapack)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm downloads](https://img.shields.io/npm/dm/datapack.svg)](https://www.npmjs.com/package/datapack)

Datapack is a JS library that provide high performance methods `pack` and `unpack` binary data using schema of data model.
This library can be used in both NodeJS and Browser environtment.

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
import { Buffer } from "buffer";

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
console.log(unpacked_FLOAT); // 123.456

// BOOL
const packed_BOOL_true = pack(true, BOOL);
const unpacked_BOOL_true = unpack(packed_BOOL_true, BOOL);
console.log(unpacked_BOOL_true); // true

// STRING
const packed_STRING = pack("abc", STRING);
const unpacked_STRING = unpack(packed_STRING, STRING);
console.log(unpacked_STRING); // "abc"

// OBJECT
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

// BINARY
const packed_BINARY = pack(Buffer.from("abc"), BINARY);
const unpacked_BINARY = unpack(packed_BINARY, BINARY);
console.log(unpacked_BINARY); // <Buffer 61 62 63>
```

## Benchmark

**Host Specs:**

*   **CPU:** AMD EPYC 7B12 @ 2.25GHz (2 cores)
*   **RAM:** 8GB
*   **OS:** Linux

**Results:**

| Scenario | Datapack (pack) | Datapack (unpack) | JSON (stringify) | JSON (parse) |
|---|---|---|---|---|
| Simple object (number fields) | ~626,680 ops/sec | ~666,401 ops/sec | ~653,272 ops/sec | ~819,183 ops/sec |
| Complex object | ~39,577 ops/sec | ~44,942 ops/sec | ~57,491 ops/sec | ~55,389 ops/sec |
| Big object (~1MB) | ~18 ops/sec | ~16 ops/sec | ~25 ops/sec | ~22 ops/sec |

### Packed Size Comparison

| Scenario | Datapack Size | JSON Size |
|---|---|---|
| Simple object (number fields) | 20 bytes | 82 bytes |
| Complex object | 530 bytes | 1731 bytes |
| Big object (~1MB) | 1,300,010 bytes | 4,275,021 bytes |

## Test coverage

-------------|---------|----------|---------|---------|-------------------
File         | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------|---------|----------|---------|---------|-------------------
All files    |     100 |      100 |     100 |     100 |                   
 index.ts    |     100 |      100 |     100 |     100 |                   
 packer.ts   |     100 |      100 |     100 |     100 |                   
 unpacker.ts |     100 |      100 |     100 |     100 |                   
 utils.ts    |     100 |      100 |     100 |     100 |                   
-------------|---------|----------|---------|---------|-------------------

## Compatibility

This library can be used in both NodeJS and Browser environtment.

## License

MIT

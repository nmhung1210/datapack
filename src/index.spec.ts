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
  packParallel,
  packParts,
  combinePackedParts,
  splitPackedParts,
  unpackPart,
  unpackParallel,
  encodeUTF8,
  decodeUTF8,
  toUint8Array,
  PackerContext,
  doPackCtx,
  setDefaultConfig,
  defaultConfig,
} from "./index";
import expect from "expect";

const encoder = new TextEncoder();

describe("MetaPack test", () => {
  it("should return the same value that was unpacked from a packed", () => {
    const packed_UINT8 = pack(100, UINT8);
    const unpacked_UINT8 = unpack(packed_UINT8, UINT8);
    expect(unpacked_UINT8).toBe(100);

    const packed_INT8 = pack(100, INT8);
    const unpacked_INT8 = unpack(packed_INT8, INT8);
    expect(unpacked_INT8).toBe(100);

    const packed_UINT16 = pack(10000, UINT16);
    const unpacked_UINT16 = unpack(packed_UINT16, UINT16);
    expect(unpacked_UINT16).toBe(10000);

    const packed_INT16 = pack(4000, INT16);
    const unpacked_INT16 = unpack(packed_INT16, INT16);
    expect(unpacked_INT16).toBe(4000);

    const packed_INT32 = pack(2000000000, INT32);
    const unpacked_INT32 = unpack(packed_INT32, INT32);
    expect(unpacked_INT32).toBe(2000000000);

    const packed_FLOAT = pack(123.456, FLOAT);
    const unpacked_FLOAT = unpack(packed_FLOAT, FLOAT);
    expect(unpacked_FLOAT).toBeCloseTo(123.456, 3);

    const packed_FLOAT64 = pack(123.456, FLOAT64);
    const unpacked_FLOAT64 = unpack(packed_FLOAT64, FLOAT64);
    expect(unpacked_FLOAT64).toBe(123.456);

    const packed_BOOL_true = pack(true, BOOL);
    const unpacked_BOOL_true = unpack(packed_BOOL_true, BOOL);
    expect(unpacked_BOOL_true).toBe(true);

    const packed_BOOL_false = pack(false, BOOL);
    const unpacked_BOOL_false = unpack(packed_BOOL_false, BOOL);
    expect(unpacked_BOOL_false).toBe(false);

    const packed_STRING = pack("abc", STRING);
    const unpacked_STRING = unpack(packed_STRING, STRING);
    expect(unpacked_STRING).toBe("abc");

    const packed_OBJECT = pack({ abc: 100 }, OBJECT);
    const unpacked_OBJECT = unpack(packed_OBJECT, OBJECT);
    expect(unpacked_OBJECT).toEqual({ abc: 100 });

    const packed_UINT64 = pack(BigInt("10000000000"), UINT64);
    const unpacked_UINT64 = unpack(packed_UINT64, UINT64);
    expect(unpacked_UINT64.toString()).toBe("10000000000");

    const packed_INT64 = pack(BigInt("-10000000000"), INT64);
    const unpacked_INT64 = unpack(packed_INT64, INT64);
    expect(unpacked_INT64.toString()).toBe("-10000000000");

    const packed_BINARY = pack(encoder.encode("abc"), BINARY);
    const unpacked_BINARY = unpack(packed_BINARY, BINARY);
    expect(new TextDecoder().decode(unpacked_BINARY)).toBe("abc");
  });

  it("should return the same array value that was unpacked from a packed", () => {
    const schema = [UINT8, INT16];
    const value = [100, 200, 50];
    const packed = pack(value, schema);
    const unpacked = unpack(packed, schema);
    expect(unpacked).toEqual(value);
  });

  it("should return the same object that was unpacked from a packed", () => {
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
    expect(unpacked).toEqual(value);
  });

  it("should handle complex data structures", () => {
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
    expect(unpackedState).toEqual(stateData);
  });

  it("should handle numeric edge cases", () => {
    // UINT8
    expect(unpack(pack(0, UINT8), UINT8)).toBe(0);
    expect(unpack(pack(255, UINT8), UINT8)).toBe(255);

    // INT8
    expect(unpack(pack(-128, INT8), INT8)).toBe(-128);
    expect(unpack(pack(127, INT8), INT8)).toBe(127);

    // UINT16
    expect(unpack(pack(0, UINT16), UINT16)).toBe(0);
    expect(unpack(pack(65535, UINT16), UINT16)).toBe(65535);

    // INT16
    expect(unpack(pack(-32768, INT16), INT16)).toBe(-32768);
    expect(unpack(pack(32767, INT16), INT16)).toBe(32767);

    // UINT32
    expect(unpack(pack(0, UINT32), UINT32)).toBe(0);
    expect(unpack(pack(4294967295, UINT32), UINT32)).toBe(4294967295);

    // INT32
    expect(unpack(pack(-2147483648, INT32), INT32)).toBe(-2147483648);
    expect(unpack(pack(2147483647, INT32), INT32)).toBe(2147483647);

    // UINT64
    expect(unpack(pack(BigInt(0), UINT64), UINT64)).toEqual(BigInt(0));
    expect(unpack(pack(BigInt("18446744073709551615"), UINT64), UINT64)).toEqual(
      BigInt("18446744073709551615")
    );

    // INT64
    expect(
      unpack(pack(BigInt("-9223372036854775808"), INT64), INT64)
    ).toEqual(BigInt("-9223372036854775808"));
    expect(
      unpack(pack(BigInt("9223372036854775807"), INT64), INT64)
    ).toEqual(BigInt("9223372036854775807"));
  });

  it("should handle string edge cases", () => {
    expect(unpack(pack("", STRING), STRING)).toBe("");
    expect(unpack(pack("\n\t\r", STRING), STRING)).toBe("\n\t\r");
    expect(unpack(pack("hello world", STRING), STRING)).toBe("hello world");
  });

  it("should handle empty objects, arrays, and binary data", () => {
    // Empty Object
    expect(unpack(pack({}, OBJECT), OBJECT)).toEqual({});

    // Empty Array
    const emptyArraySchema = [UINT8];
    expect(unpack(pack([], emptyArraySchema), emptyArraySchema)).toEqual([]);

    // Empty Binary
    const emptyBinary = unpack(pack(new Uint8Array([]), BINARY), BINARY);
    expect(emptyBinary.length).toBe(0);
  });

  it("should correctly pack and unpack with all combinations of checksum and encryption", () => {
    const schema = {
      a: UINT8,
      b: STRING,
    };
    const data = {
      a: 255,
      b: "test string",
    };
    const secret = 123;

    const optionsCombinations = [
      { useCheckSum: false, useEncrypt: false },
      { useCheckSum: true, useEncrypt: false },
      { useCheckSum: false, useEncrypt: true },
      { useCheckSum: true, useEncrypt: true },
    ];

    for (const options of optionsCombinations) {
      const finalOptions = { ...options, secret };
      const packed = pack(data, schema, finalOptions);
      const unpacked = unpack(packed, schema, finalOptions);

      // Check if unpacked data is correct
      expect(unpacked).toEqual(data);
    }
  });

  it("should handle large data to trigger buffer reallocation", () => {
    const largeString = "a".repeat(20000);
    const packed = pack(largeString, STRING);
    const unpacked = unpack(packed, STRING);
    expect(unpacked).toEqual(largeString);
  });

  it("should handle all error scenarios", () => {
    // 1. Packer: Invalid data types
    expect(() => pack(123, STRING)).toThrow(
      "Invalid data type for STRING. Expected string."
    );
    expect(() => pack("hello", UINT8)).toThrow(
      "Invalid data type for UINT8. Expected number."
    );
    expect(() => pack(123, BOOL)).toThrow(
      "Invalid data type for BOOL. Expected boolean."
    );
    expect(() => pack("hello", INT8)).toThrow(
      "Invalid data type for INT8. Expected number."
    );
    expect(() => pack("hello", UINT16)).toThrow(
      "Invalid data type for UINT16. Expected number."
    );
    expect(() => pack("hello", INT16)).toThrow(
      "Invalid data type for INT16. Expected number."
    );
    expect(() => pack("hello", UINT32)).toThrow(
      "Invalid data type for UINT32. Expected number."
    );
    expect(() => pack("hello", INT32)).toThrow(
      "Invalid data type for INT32. Expected number."
    );
    expect(() => pack("hello", FLOAT)).toThrow(
      "Invalid data type for FLOAT. Expected number."
    );
    expect(() => pack(123, BINARY)).toThrow(
      "Invalid data type for BINARY. Expected Uint8Array."
    );

    // 2. Unpacker: Buffer Overflows (should throw RangeError)
    const packed8 = pack(123, UINT8);
    expect(() => unpack(packed8, UINT16)).toThrow(RangeError);

    const smallBuffer = new Uint8Array([0, 0, 0, 10]); // Length 10, but no data
    expect(() => unpack(smallBuffer, STRING, { useCheckSum: false, useEncrypt: false })).toThrow(RangeError);

    const packedArray = pack([1, 2], [UINT8]);
    const malformedArray = new Uint8Array(4 + packedArray.length - 4);
    // Write length of 5 elements
    new DataView(malformedArray.buffer).setUint32(0, 5, false);
    // Copy the actual data (only 2 elements)
    malformedArray.set(packedArray.subarray(4), 4);
    expect(() => unpack(malformedArray, [UINT8], { useCheckSum: false, useEncrypt: false })).toThrow(RangeError);

    // 3. Unpacker: Invalid Package (checksum)
    expect(() =>
      unpack(new Uint8Array([1]), UINT8, { useCheckSum: true })
    ).toThrow("Invalid package!");

    // 4. Unpacker: Data Mismatch (checksum)
    const checksumSchema = { a: UINT8, b: STRING };
    const checksumData = { a: 255, b: "test string" };
    const checksumOptions = { useCheckSum: true, secret: 123 };
    const packedWithChecksum = pack(
      checksumData,
      checksumSchema,
      checksumOptions
    );
    const corruptedPacked = new Uint8Array(packedWithChecksum);
    const corruptedView = new DataView(corruptedPacked.buffer, corruptedPacked.byteOffset);
    corruptedView.setInt16(corruptedPacked.length - 2, 999, false);
    expect(() =>
      unpack(corruptedPacked, checksumSchema, checksumOptions)
    ).toThrow(/Data mismatch!/);

    // 5. Unpacker: Graceful failures for empty/invalid schemas and data
    expect(() => unpack(new Uint8Array([]), UINT8)).toThrow("Invalid package!");
    expect(() => unpack(pack(1, UINT8), null as any)).toThrow("Invalid schema!");
    expect(() => unpack(pack(1, UINT8), undefined as any)).toThrow("Invalid schema!");
    expect(unpack(pack(1, UINT8), "abc" as any)).toBeUndefined();
  });
});

describe("FLOAT64 (double precision) coverage", () => {
  const opts = { useCheckSum: false, useEncrypt: false };

  it("should preserve full double precision (where FLOAT32 cannot)", () => {
    const value = 3.141592653589793; // more precision than a 32-bit float holds
    const packed = pack(value, FLOAT64);
    const unpacked = unpack(packed, FLOAT64);
    // Exact equality — no precision loss
    expect(unpacked).toBe(value);

    // FLOAT (32-bit) loses precision on the same value
    const float32 = unpack(pack(value, FLOAT), FLOAT);
    expect(float32).not.toBe(value);
  });

  it("should use 8 bytes on the wire", () => {
    const ctx = new PackerContext(0);
    doPackCtx(ctx, 1.5, FLOAT64);
    expect(ctx.getResult().length).toEqual(8);
  });

  it("should handle numeric edge cases", () => {
    const cases = [
      0,
      -0,
      1,
      -1,
      0.1,
      -0.000123456789,
      Number.MAX_SAFE_INTEGER + 0.5,
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      1e308,
      -1e308,
      Math.PI,
      Math.E,
    ];
    for (const value of cases) {
      const unpacked = unpack(pack(value, FLOAT64), FLOAT64);
      expect(unpacked).toBe(value);
    }
  });

  it("should handle Infinity, -Infinity and NaN", () => {
    expect(unpack(pack(Infinity, FLOAT64), FLOAT64)).toBe(Infinity);
    expect(unpack(pack(-Infinity, FLOAT64), FLOAT64)).toBe(-Infinity);
    expect(Number.isNaN(unpack(pack(NaN, FLOAT64), FLOAT64))).toBe(true);
  });

  it("should throw for non-number input", () => {
    expect(() => pack("x", FLOAT64)).toThrow(
      "Invalid data type for FLOAT64. Expected number."
    );
  });

  it("should work inside arrays", () => {
    const schema = [FLOAT64];
    const value = [1.1, 2.2, 3.3, 4.4];
    const packed = pack(value, schema, opts);
    const unpacked = unpack(packed, schema, opts);
    expect(unpacked).toEqual(value);
  });

  it("should work inside nested objects", () => {
    const schema = { lat: FLOAT64, lng: FLOAT64, meta: { alt: FLOAT64 } };
    const value = { lat: 51.50735090000001, lng: -0.12775829999998223, meta: { alt: 35.123456789 } };
    const packed = pack(value, schema, opts);
    const unpacked = unpack(packed, schema, opts);
    expect(unpacked).toEqual(value);
  });

  it("should round-trip with checksum and encryption", () => {
    const value = 9876.543210123456;
    const finalOpts = { useCheckSum: true, useEncrypt: true, secret: 42 };
    const packed = pack(value, FLOAT64, finalOpts);
    const unpacked = unpack(packed, FLOAT64, finalOpts);
    expect(unpacked).toBe(value);
  });

  it("should be skipped correctly by splitPackedParts", () => {
    const schema = { a: FLOAT64, b: STRING };
    const data = { a: 2.718281828459045, b: "after" };
    const packed = pack(data, schema, opts);
    const parts = splitPackedParts(packed, schema as any, opts);
    // The FLOAT64 field must consume exactly 8 bytes so the next field aligns
    expect(parts["a"].length).toEqual(8);
    expect(unpackPart(parts["a"], FLOAT64)).toBe(data.a);
    expect(unpackPart(parts["b"], STRING)).toBe(data.b);
  });

  it("should trigger buffer grow with a tiny context", () => {
    const ctx = new PackerContext(0);
    doPackCtx(ctx, 6.022e23, FLOAT64);
    expect(unpackPart(ctx.getResult(), FLOAT64)).toBe(6.022e23);
  });
});

describe("Parallel pack test", () => {
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
      { userId: 101, nickName: "ABC", isVip: true, age: 34 },
      { userId: 103, nickName: "GHI", isVip: true, age: 22 },
    ],
    posts: [
      {
        postId: 100,
        title: "Hello World!",
        score: 999,
        authors: [
          { userId: 102, nickName: "DEF", isVip: false, age: 28 },
        ],
      },
    ],
  };

  it("packParts + combinePackedParts should produce same result as pack", () => {
    const opts = { useCheckSum: false, useEncrypt: false };
    const sequential = pack(stateData, stateDataSchema, opts);
    const parts = packParts(stateData, stateDataSchema as any);
    const combined = combinePackedParts(parts, Object.keys(stateDataSchema), opts);
    expect(combined).toEqual(sequential);

    // Verify unpack works on combined result
    const unpacked = unpack(combined, stateDataSchema, opts);
    expect(unpacked).toEqual(stateData);
  });

  it("packParts + combinePackedParts should work with checksum and encryption", () => {
    const opts = { useCheckSum: true, useEncrypt: true, secret: 42 };
    const sequential = pack(stateData, stateDataSchema, opts);
    const parts = packParts(stateData, stateDataSchema as any);
    const combined = combinePackedParts(parts, Object.keys(stateDataSchema), opts);
    expect(combined).toEqual(sequential);

    const unpacked = unpack(combined, stateDataSchema, opts);
    expect(unpacked).toEqual(stateData);
  });

  it("packParallel should produce same result as pack", async () => {
    const opts = { useCheckSum: true, useEncrypt: true, secret: 42 };
    const sequential = pack(stateData, stateDataSchema, opts);
    const parallel = await packParallel(stateData, stateDataSchema, opts);
    expect(parallel).toEqual(sequential);

    const unpacked = unpack(parallel, stateDataSchema, opts);
    expect(unpacked).toEqual(stateData);
  });

  it("packParallel should fallback for non-object schemas", async () => {
    const result = await packParallel([1, 2, 3], [UINT8], { useCheckSum: false, useEncrypt: false });
    const expected = pack([1, 2, 3], [UINT8], { useCheckSum: false, useEncrypt: false });
    expect(result).toEqual(expected);
  });

  it("splitPackedParts should correctly split buffer into per-field slices", () => {
    const opts = { useCheckSum: false, useEncrypt: false };
    const packed = pack(stateData, stateDataSchema, opts);

    const parts = splitPackedParts(packed, stateDataSchema as any, opts);
    expect(Object.keys(parts)).toEqual(["users", "posts"]);

    // Each part should unpack independently
    const users = unpackPart(parts["users"], [profileSchema]);
    expect(users).toEqual(stateData.users);

    const posts = unpackPart(parts["posts"], [(stateDataSchema as any).posts[0]]);
    expect(posts).toEqual(stateData.posts);
  });

  it("splitPackedParts should work with checksum and encryption", () => {
    const opts = { useCheckSum: true, useEncrypt: true, secret: 42 };
    const packed = pack(stateData, stateDataSchema, opts);

    const parts = splitPackedParts(packed, stateDataSchema as any, opts);

    const users = unpackPart(parts["users"], [profileSchema]);
    expect(users).toEqual(stateData.users);
  });

  it("unpackParallel should produce same result as unpack", async () => {
    const opts = { useCheckSum: true, useEncrypt: true, secret: 42 };
    const packed = pack(stateData, stateDataSchema, opts);

    const sequential = unpack(packed, stateDataSchema, opts);
    const parallel = await unpackParallel(packed, stateDataSchema, opts);
    expect(parallel).toEqual(sequential);
    expect(parallel).toEqual(stateData);
  });

  it("unpackParallel should fallback for non-object schemas", async () => {
    const opts = { useCheckSum: false, useEncrypt: false };
    const packed = pack([1, 2, 3], [UINT8], opts);
    const result = await unpackParallel(packed, [UINT8], opts);
    expect(result).toEqual([1, 2, 3]);
  });

  it("packParallel should fallback for single-key schema", async () => {
    const schema = { only: UINT32 };
    const data = { only: 42 };
    const opts = { useCheckSum: false, useEncrypt: false };
    const result = await packParallel(data, schema, opts);
    const expected = pack(data, schema, opts);
    expect(result).toEqual(expected);
  });

  it("unpackParallel should fallback for single-key schema", async () => {
    const schema = { only: UINT32 };
    const data = { only: 42 };
    const opts = { useCheckSum: false, useEncrypt: false };
    const packed = pack(data, schema, opts);
    const result = await unpackParallel(packed, schema, opts);
    expect(result).toEqual(data);
  });

  it("combinePackedParts should work with checksum only (no encrypt)", () => {
    const schema = { a: UINT32, b: STRING };
    const data = { a: 123, b: "hello" };
    const opts = { useCheckSum: true, useEncrypt: false };
    const parts = packParts(data, schema as any);
    const combined = combinePackedParts(parts, Object.keys(schema), opts);
    const unpacked = unpack(combined, schema, opts);
    expect(unpacked).toEqual(data);
  });

  it("splitPackedParts should work with checksum only (no encrypt)", () => {
    const schema = { a: UINT32, b: STRING };
    const data = { a: 123, b: "hello" };
    const opts = { useCheckSum: true, useEncrypt: false };
    const packed = pack(data, schema, opts);
    const parts = splitPackedParts(packed, schema as any, opts);
    const a = unpackPart(parts["a"], UINT32);
    expect(a).toEqual(123);
  });

  it("splitPackedParts should throw on invalid package", () => {
    const schema = { a: UINT8 };
    expect(() => splitPackedParts(new Uint8Array([1]), schema as any)).toThrow("Invalid package!");
  });

  it("splitPackedParts should throw on checksum mismatch (encrypt)", () => {
    const schema = { a: UINT32, b: STRING };
    const data = { a: 1, b: "x" };
    const opts = { useCheckSum: true, useEncrypt: true, secret: 42 };
    const packed = pack(data, schema, opts);
    const corrupted = new Uint8Array(packed);
    // Corrupt checksum bytes
    const view = new DataView(corrupted.buffer);
    view.setInt16(corrupted.length - 2, 9999, false);
    expect(() => splitPackedParts(corrupted, schema as any, opts)).toThrow("Data mismatch!");
  });

  it("splitPackedParts should throw on checksum mismatch (no encrypt)", () => {
    const schema = { a: UINT32, b: STRING };
    const data = { a: 1, b: "x" };
    const opts = { useCheckSum: true, useEncrypt: false };
    const packed = pack(data, schema, opts);
    const corrupted = new Uint8Array(packed);
    const view = new DataView(corrupted.buffer);
    view.setInt16(corrupted.length - 2, 9999, false);
    expect(() => splitPackedParts(corrupted, schema as any, opts)).toThrow("Data mismatch!");
  });

  it("splitPackedParts should handle UINT64/INT64 fields", () => {
    const schema = { id: UINT64, value: INT64 };
    const data = { id: BigInt("123456789"), value: BigInt("-987654321") };
    const opts = { useCheckSum: false, useEncrypt: false };
    const packed = pack(data, schema, opts);
    const parts = splitPackedParts(packed, schema as any, opts);
    const id = unpackPart(parts["id"], UINT64);
    expect(id).toEqual(BigInt("123456789"));
  });
});

describe("Utils coverage", () => {
  it("encodeUTF8 should encode strings", () => {
    const result = encodeUTF8("hello");
    expect(result).toEqual(new Uint8Array([104, 101, 108, 108, 111]));
  });

  it("decodeUTF8 should decode bytes", () => {
    const bytes = new Uint8Array([104, 101, 108, 108, 111]);
    expect(decodeUTF8(bytes)).toEqual("hello");
    expect(decodeUTF8(bytes, 1, 3)).toEqual("el");
  });

  it("toUint8Array should handle string input", () => {
    const result = toUint8Array("abc");
    expect(result[0]).toEqual(97);
    expect(result.length).toEqual(3);
  });

  it("toUint8Array should handle ArrayBuffer input", () => {
    const buf = new ArrayBuffer(4);
    new Uint8Array(buf).set([1, 2, 3, 4]);
    const result = toUint8Array(buf);
    expect(result).toEqual(new Uint8Array([1, 2, 3, 4]));
  });

  it("toUint8Array should handle SharedArrayBuffer-like input", () => {
    const buf = new ArrayBuffer(3);
    new Uint8Array(buf).set([5, 6, 7]);
    // Pass as ArrayBufferLike (not instanceof ArrayBuffer check path)
    const result = toUint8Array(buf as ArrayBufferLike);
    expect(result).toEqual(new Uint8Array([5, 6, 7]));
  });
});

describe("Non-ASCII string coverage", () => {
  it("should pack and unpack non-ASCII strings (UTF-8)", () => {
    const opts = { useCheckSum: false, useEncrypt: false };
    const data = "こんにちは世界"; // Japanese
    const packed = pack(data, STRING, opts);
    const unpacked = unpack(packed, STRING, opts);
    expect(unpacked).toEqual(data);
  });

  it("should pack and unpack long ASCII strings (>64 chars)", () => {
    const opts = { useCheckSum: false, useEncrypt: false };
    const data = "a".repeat(100);
    const packed = pack(data, STRING, opts);
    const unpacked = unpack(packed, STRING, opts);
    expect(unpacked).toEqual(data);
  });

  it("should handle checksum-only unpack with non-8-aligned data", () => {
    // 5 bytes of data → not divisible by 8, hits remainder loop
    const schema = { a: UINT8, b: UINT32 };
    const data = { a: 1, b: 999 };
    const opts = { useCheckSum: true, useEncrypt: false };
    const packed = pack(data, schema, opts);
    const unpacked = unpack(packed, schema, opts);
    expect(unpacked).toEqual(data);
  });

  it("should handle checksum-only pack with non-8-aligned data", () => {
    // Hits the remainder loop in packer checksum-only path
    const schema = { a: UINT8, b: UINT16 };
    const data = { a: 7, b: 300 };
    const opts = { useCheckSum: true, useEncrypt: false };
    const packed = pack(data, schema, opts);
    const unpacked = unpack(packed, schema, opts);
    expect(unpacked).toEqual(data);
  });

  it("should throw Data mismatch for checksum-only corrupted data", () => {
    const schema = { a: UINT8 };
    const data = { a: 5 };
    const opts = { useCheckSum: true, useEncrypt: false };
    const packed = pack(data, schema, opts);
    const corrupted = new Uint8Array(packed);
    corrupted[0] = 99; // corrupt data byte
    expect(() => unpack(corrupted, schema, opts)).toThrow("Data mismatch!");
  });
});

describe("Branch coverage", () => {
  it("should call pack/unpack without options (uses defaults)", () => {
    const schema = { a: UINT8 };
    const data = { a: 42 };
    const packed = pack(data, schema);
    const unpacked = unpack(packed, schema);
    expect(unpacked).toEqual(data);

    // Also call with empty opts to hit ?? default branches
    const packed2 = pack(data, schema, {});
    const unpacked2 = unpack(packed2, schema, {});
    expect(unpacked2).toEqual(data);
  });

  it("should trigger buffer grow in packer for large data", () => {
    const opts = { useCheckSum: false, useEncrypt: false };
    // Large string forces buffer growth beyond initial 10KB
    const bigStr = "x".repeat(12000);
    const packed = pack(bigStr, STRING, opts);
    const unpacked = unpack(packed, STRING, opts);
    expect(unpacked).toEqual(bigStr);
  });

  it("should trigger buffer grow for large BINARY data", () => {
    const opts = { useCheckSum: false, useEncrypt: false };
    const bigBin = new Uint8Array(12000);
    bigBin.fill(0xAB);
    const packed = pack(bigBin, BINARY, opts);
    const unpacked = unpack(packed, BINARY, opts);
    expect(unpacked).toEqual(bigBin);
  });

  it("should throw RangeError for BINARY overflow", () => {
    const opts = { useCheckSum: false, useEncrypt: false };
    // 4 bytes header claiming length 100, but only 2 bytes of data
    const malformed = new Uint8Array([0, 0, 0, 100, 1, 2]);
    expect(() => unpack(malformed, BINARY, opts)).toThrow(RangeError);
  });

  it("should throw RangeError for OBJECT overflow", () => {
    const opts = { useCheckSum: false, useEncrypt: false };
    // 4 bytes header claiming length 50, but only 2 bytes of data
    const malformed = new Uint8Array([0, 0, 0, 50, 1, 2]);
    expect(() => unpack(malformed, OBJECT, opts)).toThrow(RangeError);
  });

  it("should handle splitPackedParts/combinePackedParts without options", () => {
    const schema = { a: UINT32, b: UINT8 };
    const data = { a: 100, b: 5 };
    // default options (encrypt + checksum)
    const packed = pack(data, schema);
    const parts = splitPackedParts(packed, schema as any);
    expect(parts["a"]).toBeDefined();

    const parts2 = packParts(data, schema as any);
    const combined = combinePackedParts(parts2, Object.keys(schema));
    const unpacked = unpack(combined, schema);
    expect(unpacked).toEqual(data);
  });

  it("should trigger grow for non-ASCII string that needs buffer expansion", () => {
    const opts = { useCheckSum: false, useEncrypt: false };
    // Large non-ASCII string forces grow + encodeInto path
    const bigNonAscii = "日本語テスト".repeat(2000);
    const packed = pack(bigNonAscii, STRING, opts);
    const unpacked = unpack(packed, STRING, opts);
    expect(unpacked).toEqual(bigNonAscii);
  });

  it("should trigger inner grow for non-ASCII string with tight buffer", () => {
    // Use a PackerContext sized to fit 4 + strLen but NOT 4 + strLen*3
    // Non-ASCII char "日" is 3 bytes in UTF-8, so strLen=1 needs 3 bytes
    const str = "日".repeat(10); // strLen=10, needs 30 bytes encoded
    // Buffer size: 4 + 10 = 14 → fits the initial check (line 117)
    // But 4 + 10*3 = 34 → exceeds 14, triggers inner grow (line 127)
    const ctx = new PackerContext(14);
    doPackCtx(ctx, str, STRING);
    const result = ctx.getResult();
    // Verify: 4 bytes length + 30 bytes UTF-8
    expect(result.length).toEqual(34);
  });

  it("should handle type errors for all numeric types", () => {
    expect(() => pack("x", UINT16)).toThrow("Expected number");
    expect(() => pack("x", INT8)).toThrow("Expected number");
    expect(() => pack("x", INT16)).toThrow("Expected number");
    expect(() => pack("x", UINT64)).toThrow("Expected number or bigint");
    expect(() => pack("x", INT64)).toThrow("Expected number or bigint");
    expect(() => pack(123, BOOL)).toThrow("Expected boolean");
    expect(() => pack(123, STRING)).toThrow("Expected string");
  });

  it("should trigger grow for every type with tiny buffer", () => {
    // Each type needs its own 0-byte context to force its specific grow branch
    const types: [any, any][] = [
      [255, UINT8],
      [true, BOOL],
      [-1, INT8],
      [1000, UINT16],
      [-1000, INT16],
      [100000, UINT32],
      [-100000, INT32],
      [BigInt(99), UINT64],
      [BigInt(-99), INT64],
      [1.5, FLOAT],
      [new Uint8Array([1, 2]), BINARY],
      ["hi", STRING],
      [{ x: 1 }, OBJECT],
      [[1, 2], [UINT8]],
    ];
    for (const [data, schema] of types) {
      const ctx = new PackerContext(0);
      doPackCtx(ctx, data, schema);
      expect(ctx.getResult().length).toBeGreaterThan(0);
    }
  });

  it("should call splitPackedParts and unpackParallel without options", () => {
    const schema = { a: UINT32, b: UINT8 };
    const data = { a: 100, b: 5 };
    // No opts → uses defaults (encrypt + checksum)
    const packed = pack(data, schema);
    const parts = splitPackedParts(packed, schema as any);
    expect(parts["a"]).toBeDefined();

    // Also call unpack without opts
    const unpacked = unpack(packed, schema);
    expect(unpacked).toEqual(data);

    // combinePackedParts without opts
    const parts2 = packParts(data, schema as any);
    const combined = combinePackedParts(parts2, Object.keys(schema));
    expect(combined.length).toBeGreaterThan(0);

    // With empty opts to hit ?? branches in splitPackedParts/combinePackedParts
    const packed3 = pack(data, schema, {});
    const parts3 = splitPackedParts(packed3, schema as any, {});
    expect(parts3["a"]).toBeDefined();
    const parts4 = packParts(data, schema as any);
    const combined2 = combinePackedParts(parts4, Object.keys(schema), {});
    expect(combined2.length).toBeGreaterThan(0);

    // encrypt ON, checksum OFF in splitPackedParts
    const optsEncOnly = { useEncrypt: true, useCheckSum: false, secret: 77 };
    const packed5 = pack(data, schema, optsEncOnly);
    const parts5 = splitPackedParts(packed5, schema as any, optsEncOnly);
    expect(parts5["a"]).toBeDefined();
  });

  it("should handle skipSchema for all types in splitPackedParts", () => {
    const schema = {
      a: UINT64,
      b: INT64,
      c: FLOAT,
      d: BINARY,
      e: OBJECT,
      f: [UINT8],
    };
    const data = {
      a: BigInt(1),
      b: BigInt(-1),
      c: 3.14,
      d: new Uint8Array([1]),
      e: { k: "v" },
      f: [1, 2, 3],
    };
    const opts = { useCheckSum: false, useEncrypt: false };
    const packed = pack(data, schema, opts);
    const parts = splitPackedParts(packed, schema as any, opts);
    expect(Object.keys(parts).length).toEqual(6);
    expect(unpackPart(parts["a"], UINT64)).toEqual(BigInt(1));
    expect(unpackPart(parts["c"], FLOAT)).toBeCloseTo(3.14, 2);
  });
});

describe("setDefaultConfig", () => {
  // Save original config to restore after tests
  const originalConfig = { ...defaultConfig };

  afterEach(() => {
    setDefaultConfig(originalConfig);
  });

  it("should change default encrypt/checksum behavior", () => {
    setDefaultConfig({ useEncrypt: false, useCheckSum: false });

    const data = { a: 42, b: "hello" };
    const schema = { a: UINT8, b: STRING };
    const packed = pack(data, schema);
    const unpacked = unpack(packed, schema);
    expect(unpacked).toEqual(data);

    // Verify no checksum (packed size = raw data, no extra 2 bytes)
    const packedWithChecksum = pack(data, schema, { useCheckSum: true, useEncrypt: false });
    expect(packedWithChecksum.length).toEqual(packed.length + 2);
  });

  it("should change default secret", () => {
    setDefaultConfig({ secret: 9999 });
    expect(defaultConfig.secret).toEqual(9999);

    const packed = pack(100, UINT8);
    const unpacked = unpack(packed, UINT8);
    expect(unpacked).toEqual(100);
  });

  it("should change default chunkSize", () => {
    setDefaultConfig({ chunkSize: 2048 });
    expect(defaultConfig.chunkSize).toEqual(2048);
  });

  it("should only update provided fields", () => {
    setDefaultConfig({ useEncrypt: false });
    expect(defaultConfig.useEncrypt).toEqual(false);
    expect(defaultConfig.useCheckSum).toEqual(originalConfig.useCheckSum);
    expect(defaultConfig.secret).toEqual(originalConfig.secret);
  });

  it("per-call options should override defaults", () => {
    setDefaultConfig({ useEncrypt: false, useCheckSum: false });

    const data = 42;
    const opts = { useEncrypt: true, useCheckSum: true, secret: 555 };
    const packed = pack(data, UINT8, opts);
    // Should fail to unpack with wrong secret
    expect(() => unpack(packed, UINT8, { useEncrypt: true, useCheckSum: true, secret: 999 })).toThrow("Data mismatch!");
    // Should succeed with matching options
    const unpacked = unpack(packed, UINT8, opts);
    expect(unpacked).toEqual(42);
  });
});

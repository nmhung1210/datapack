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
  packParallel,
  packParts,
  combinePackedParts,
  splitPackedParts,
  unpackPart,
  unpackParallel,
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
});

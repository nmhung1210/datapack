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
} from "./index";
import expect from "expect";
import { Buffer } from "buffer";

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

    const packed_BINARY = pack(Buffer.from("abc"), BINARY);
    const unpacked_BINARY = unpack(packed_BINARY, BINARY);
    expect(unpacked_BINARY.toString()).toBe("abc");
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
    expect(unpack(pack(Buffer.from([]), BINARY), BINARY).toString()).toBe("");
  });

  it("should throw an error for mismatched schema and data", () => {
    // Data mismatched
    expect(() => pack("should be a number", UINT8)).toThrow();

    // Unpack with a different schema
    const packed = pack(123, UINT8);
    expect(() => unpack(packed, INT8)).not.toThrow(); // This is valid, since they have the same size
    expect(() => unpack(packed, UINT16)).toThrow(); // This should throw because of mismatched buffer size
  });

  it("should handle large data to trigger buffer reallocation", () => {
    const largeString = "a".repeat(20000);
    const packed = pack(largeString, STRING);
    const unpacked = unpack(packed, STRING);
    expect(unpacked).toEqual(largeString);
  });

  it("should handle unpacker-specific errors", () => {
    // Invalid package (too short)
    expect(() => unpack(Buffer.from([1]), UINT8)).toThrow(
      "Invalid package!"
    );

    // Checksum mismatch
    const packedWithChecksum = pack(123, UINT8, { useCheckSum: true });
    packedWithChecksum[0] = 99; // Corrupt the data
    expect(() => unpack(packedWithChecksum, UINT8, { useCheckSum: true })).toThrow(
      /Data mismatch!/
    );

    // Invalid schema
    const packed = pack(123, UINT8);
    expect(unpack(packed, null as any)).toBeUndefined();
  });
});

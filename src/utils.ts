export enum DataTypes {
  UINT8 = 0,
  UINT16,
  UINT32,
  UINT64,
  INT8,
  INT16,
  INT32,
  INT64,
  BOOL,
  FLOAT,
  BINARY,
  STRING,
  OBJECT,
  FLOAT64,

  // Optional variants of each primitive type, i.e. `<TYPE> | UNDEFINED`. The
  // UNDEFINED marker bit (0x100) sits above every type tag, so the base type is
  // recoverable with `schema & ~UNDEFINED`. These exist as named members (rather
  // than inline bitwise-OR expressions) so that in a schema they keep a literal
  // enum type instead of widening to `number` — which is what lets
  // `SchemaToType` infer `T | undefined` for optional fields. Use the exported
  // `_UINT8` etc. aliases, or write `UINT8 | UNDEFINED` directly when precise
  // typing is not needed. On the wire an optional value is prefixed with a
  // presence byte (1 = present, 0 = absent); when absent no value bytes follow
  // and it unpacks back to `undefined`. Both `undefined` and `null` pack as
  // absent.
  _UINT8 = UINT8 | 0x100,
  _UINT16 = UINT16 | 0x100,
  _UINT32 = UINT32 | 0x100,
  _UINT64 = UINT64 | 0x100,
  _INT8 = INT8 | 0x100,
  _INT16 = INT16 | 0x100,
  _INT32 = INT32 | 0x100,
  _INT64 = INT64 | 0x100,
  _BOOL = BOOL | 0x100,
  _FLOAT = FLOAT | 0x100,
  _BINARY = BINARY | 0x100,
  _STRING = STRING | 0x100,
  _OBJECT = OBJECT | 0x100,
  _FLOAT64 = FLOAT64 | 0x100,
}

/**
 * Optional marker bit. OR it with any primitive type to allow the value to be
 * absent: `{ data: UINT8 | UNDEFINED }`. Equivalent to the `_UINT8` alias, but
 * the bitwise-OR widens to `number` so the field is not inferred as
 * `T | undefined` (use the `_TYPE` aliases when precise typing matters). Kept
 * out of `DataTypes` because it is a flag, not a data type of its own.
 */
export const UNDEFINED = 0x100 as const;

export const UINT8 = DataTypes.UINT8 as const;
export const UINT16 = DataTypes.UINT16 as const;
export const UINT32 = DataTypes.UINT32 as const;
export const UINT64 = DataTypes.UINT64 as const;
export const INT8 = DataTypes.INT8 as const;
export const INT16 = DataTypes.INT16 as const;
export const INT32 = DataTypes.INT32 as const;
export const INT64 = DataTypes.INT64 as const;
export const BOOL = DataTypes.BOOL as const;
export const FLOAT = DataTypes.FLOAT as const;
export const FLOAT64 = DataTypes.FLOAT64 as const;
export const BINARY = DataTypes.BINARY as const;
export const STRING = DataTypes.STRING as const;
export const OBJECT = DataTypes.OBJECT as const;

// Optional aliases — `_TYPE` is `TYPE | UNDEFINED` with its literal type kept,
// so `{ data: _UINT8 }` infers `number | undefined` on unpack.
export const _UINT8 = DataTypes._UINT8 as const;
export const _UINT16 = DataTypes._UINT16 as const;
export const _UINT32 = DataTypes._UINT32 as const;
export const _UINT64 = DataTypes._UINT64 as const;
export const _INT8 = DataTypes._INT8 as const;
export const _INT16 = DataTypes._INT16 as const;
export const _INT32 = DataTypes._INT32 as const;
export const _INT64 = DataTypes._INT64 as const;
export const _BOOL = DataTypes._BOOL as const;
export const _FLOAT = DataTypes._FLOAT as const;
export const _FLOAT64 = DataTypes._FLOAT64 as const;
export const _BINARY = DataTypes._BINARY as const;
export const _STRING = DataTypes._STRING as const;
export const _OBJECT = DataTypes._OBJECT as const;

export type Schema =
  | DataTypes
  | Schema[]
  | readonly Schema[]
  | { [name: string]: Schema };

export type DataTypeMap = {
  [DataTypes.UINT8]: number;
  [DataTypes.UINT16]: number;
  [DataTypes.UINT32]: number;
  [DataTypes.UINT64]: bigint;
  [DataTypes.INT8]: number;
  [DataTypes.INT16]: number;
  [DataTypes.INT32]: number;
  [DataTypes.INT64]: bigint;
  [DataTypes.BOOL]: boolean;
  [DataTypes.FLOAT]: number;
  [DataTypes.FLOAT64]: number;
  [DataTypes.BINARY]: Uint8Array;
  [DataTypes.STRING]: string;
  [DataTypes.OBJECT]: object;
  // Optional variants (`<TYPE> | UNDEFINED`).
  [DataTypes._UINT8]: number | undefined;
  [DataTypes._UINT16]: number | undefined;
  [DataTypes._UINT32]: number | undefined;
  [DataTypes._UINT64]: bigint | undefined;
  [DataTypes._INT8]: number | undefined;
  [DataTypes._INT16]: number | undefined;
  [DataTypes._INT32]: number | undefined;
  [DataTypes._INT64]: bigint | undefined;
  [DataTypes._BOOL]: boolean | undefined;
  [DataTypes._FLOAT]: number | undefined;
  [DataTypes._FLOAT64]: number | undefined;
  [DataTypes._BINARY]: Uint8Array | undefined;
  [DataTypes._STRING]: string | undefined;
  [DataTypes._OBJECT]: object | undefined;
};

type ResolveDataType<S extends DataTypes> = DataTypes extends S
  ? number | string | boolean | bigint | Uint8Array | object
  : S extends keyof DataTypeMap
    ? DataTypeMap[S]
    : number | string | boolean | bigint | Uint8Array | object;

export type SchemaToType<S> = S extends DataTypes
  ? ResolveDataType<S>
  : S extends ReadonlyArray<infer U>
    ? SchemaToType<U>[]
    : S extends object
      ? { [K in keyof S]: SchemaToType<S[K]> }
      : never;

export interface IPackConfig {
  chunkSize: number;
  useEncrypt: boolean;
  useCheckSum: boolean;
  secret: number;
}

export type IPackConfigOptions = Partial<IPackConfig>;

export const defaultConfig: IPackConfig = {
  chunkSize: 10240,
  useEncrypt: true,
  useCheckSum: true,
  secret: 1210,
};

export function setDefaultConfig(opts: IPackConfigOptions): void {
  if (opts.chunkSize !== undefined) {
    defaultConfig.chunkSize = opts.chunkSize;
  }
  if (opts.useEncrypt !== undefined) {
    defaultConfig.useEncrypt = opts.useEncrypt;
  }
  if (opts.useCheckSum !== undefined) {
    defaultConfig.useCheckSum = opts.useCheckSum;
  }
  if (opts.secret !== undefined) {
    defaultConfig.secret = opts.secret;
  }
}

export function defineSchema<const T extends Schema>(schema: T): T {
  return schema;
}

/**
 * Position-weighted additive checksum: the sum of `byte * (position + 1)` over
 * the first `len` bytes, reduced mod 65536. Weighting each byte by its position
 * makes the sum sensitive to byte transpositions and shifts (a plain byte-sum
 * is permutation-invariant and would miss them). Stored/read as a big-endian
 * unsigned 16-bit int.
 *
 * The weight is reduced mod 65536 and the accumulator is reduced once per block,
 * so the running sum can never lose float64 integer precision (each term stays
 * below 256*65536) regardless of payload size. Because every term is congruent
 * mod 65536, the result is identical to the unreduced sum mod 65536.
 */
export function computeChecksum(bytes: Uint8Array, len: number): number {
  let sum = 0;
  let i = 0;
  while (i < len) {
    const end = i + 8192 < len ? i + 8192 : len;
    for (; i < end; i++) {
      sum += bytes[i] * ((i + 1) & 0xffff);
    }
    sum %= 65536;
  }
  return sum;
}

/**
 * Keystream byte for position `i` derived from the integer `secret` seed.
 *
 * This is a stateless, position-keyed pseudo-random byte: the encryption adds
 * it to the plaintext byte (`& 0xFF`) on pack and subtracts it on unpack. Being
 * a pure function of `(secret, i)` lets every decrypt path recompute the shift
 * for any byte independently, while the avalanche mixing (a MurmurHash3-style
 * finalizer over `secret XOR i*golden-ratio`) makes the per-byte shift behave
 * randomly instead of the linearly-predictable `i + secret` it replaces.
 *
 * Note: this is lightweight obfuscation, not a cryptographically secure cipher.
 */
export function keystreamByte(secret: number, i: number): number {
  let x = (secret ^ Math.imul(i, 0x9e3779b1)) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 13), 0x45d9f3b);
  x = (x ^ (x >>> 16)) >>> 0;
  return x & 0xff;
}

/** Resolve per-call options against the defaults, once per pack/unpack entry point. */
export function resolveConfig(opt?: IPackConfigOptions): {
  useCheckSum: boolean;
  useEncrypt: boolean;
  secret: number;
} {
  const secret = opt?.secret ?? defaultConfig.secret;
  // A fractional secret makes the byte shift asymmetric between pack and unpack
  // (it would silently corrupt data), so require an integer key.
  if (!Number.isInteger(secret)) {
    throw new RangeError("secret must be an integer.");
  }
  return {
    useCheckSum: opt?.useCheckSum ?? defaultConfig.useCheckSum,
    useEncrypt: opt?.useEncrypt ?? defaultConfig.useEncrypt,
    secret,
  };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeUTF8(str: string): Uint8Array {
  return encoder.encode(str);
}

export function decodeUTF8(
  bytes: Uint8Array,
  start?: number,
  end?: number,
): string {
  return decoder.decode(bytes.subarray(start, end));
}

export function toUint8Array(
  data: ArrayBufferLike | ArrayBuffer | Uint8Array | string,
): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (typeof data === "string") {
    return encoder.encode(data);
  }
  return new Uint8Array(data as ArrayBuffer);
}

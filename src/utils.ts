
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
}

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
};

type ResolveDataType<S extends DataTypes> = DataTypes extends S
  ? number | string | boolean | bigint | Uint8Array | object
  : DataTypeMap[S];

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
  secret: 1210
};

export function setDefaultConfig(opts: IPackConfigOptions): void {
  if (opts.chunkSize !== undefined) defaultConfig.chunkSize = opts.chunkSize;
  if (opts.useEncrypt !== undefined) defaultConfig.useEncrypt = opts.useEncrypt;
  if (opts.useCheckSum !== undefined) defaultConfig.useCheckSum = opts.useCheckSum;
  if (opts.secret !== undefined) defaultConfig.secret = opts.secret;
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
 */
export function computeChecksum(bytes: Uint8Array, len: number): number {
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += bytes[i] * (i + 1);
  }
  return sum & 0xFFFF;
}

/** Resolve per-call options against the defaults, once per pack/unpack entry point. */
export function resolveConfig(opt?: IPackConfigOptions): {
  useCheckSum: boolean;
  useEncrypt: boolean;
  secret: number;
} {
  return {
    useCheckSum: opt?.useCheckSum ?? defaultConfig.useCheckSum,
    useEncrypt: opt?.useEncrypt ?? defaultConfig.useEncrypt,
    secret: opt?.secret ?? defaultConfig.secret,
  };
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function encodeUTF8(str: string): Uint8Array {
  return encoder.encode(str);
}

export function decodeUTF8(bytes: Uint8Array, start?: number, end?: number): string {
  return decoder.decode(bytes.subarray(start, end));
}

export function toUint8Array(data: ArrayBufferLike | ArrayBuffer | Uint8Array | string): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (typeof data === 'string') {
    return encoder.encode(data);
  }
  return new Uint8Array(data as ArrayBuffer);
}

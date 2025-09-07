
import { Buffer } from "buffer/index";

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
}

export const {
  UINT8,
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
} = DataTypes;

export type Schema =
  | DataTypes
  | DataTypes[]
  | { [name: string]: Schema | Schema[] | Schema[] };

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
  [DataTypes.BINARY]: Buffer;
  [DataTypes.STRING]: string;
  [DataTypes.OBJECT]: any;
};

export type SchemaToType<S extends Schema | Array<Schema>> = S extends DataTypes
  ? DataTypeMap[S]
  : S extends object
  ? S extends Array<infer U>
    ? U extends Schema
      ? SchemaToType<U>[]
      : never
    : { -readonly [K in keyof S]: S[K] extends Schema | Array<Schema> ? SchemaToType<S[K]> : never }
  : never;

export interface IPackConfig {
  chunkSize: number;
  useEncrypt: boolean;
  useCheckSum: boolean;
  secret: number;

}
export interface IPackConfigOptions {
  chunkSize?: number;
  useEncrypt?: boolean;
  useCheckSum?: boolean;
  secret?: number;
}

export const defaultConfig: IPackConfig = {
  chunkSize: 10240,
  useEncrypt: true,
  useCheckSum: true,
  secret: 1210
};

import { Suite } from "benchmark";
import {
  pack,
  unpack,
  UINT32,
  STRING,
  BOOL,
  UINT8,
  UINT16,
  INT8,
  INT16,
  INT32,
  FLOAT,
} from "../src";

const simpleSchema = {
  a: UINT8,
  b: UINT16,
  c: UINT32,
  d: INT8,
  e: INT16,
  f: INT32,
  g: FLOAT,
};
const simpleData = {
  a: 255,
  b: 65535,
  c: 4294967295,
  d: -128,
  e: -32768,
  f: -2147483648,
  g: 123.456,
};

const profileSchema = {
  userId: UINT32,
  nickName: STRING,
  isVip: BOOL,
  age: UINT8,
};
const stateSchema = {
  users: [profileSchema],
  posts: [
    { postId: UINT32, title: STRING, score: UINT16, authors: [profileSchema] },
  ],
};
const user = { userId: 101, nickName: "ABC", isVip: true, age: 34 };
const post = {
  postId: 100,
  title: "Hello World!",
  score: 999,
  authors: [{ userId: 102, nickName: "DEF", isVip: false, age: 28 }],
};

function build(n: number) {
  const users = [],
    posts = [];
  for (let i = 0; i < n; i++) {
    users.push(user);
    posts.push(post);
  }
  return { users, posts };
}
const complexData = build(10);
const bigData = build(25000);

const combos = [
  { label: "none ", opt: { useCheckSum: false, useEncrypt: false } },
  { label: "csum ", opt: { useCheckSum: true, useEncrypt: false } },
  { label: "enc  ", opt: { useCheckSum: false, useEncrypt: true } },
  { label: "both ", opt: { useCheckSum: true, useEncrypt: true } },
];

const scenarios = [
  { name: "simple ", data: simpleData, schema: simpleSchema },
  { name: "complex", data: complexData, schema: stateSchema },
  { name: "big1MB ", data: bigData, schema: stateSchema },
];

const suite = new Suite();
for (const s of scenarios) {
  for (const c of combos) {
    const packed = pack(s.data, s.schema as any, c.opt);
    suite.add(`pack   ${s.name} [${c.label}]`, () => {
      pack(s.data, s.schema as any, c.opt);
    });
    suite.add(`unpack ${s.name} [${c.label}]`, () => {
      unpack(packed, s.schema as any, c.opt);
    });
  }
}

// datapack vs JSON: serialize/deserialize speed using the bare option (no
// checksum/encrypt) as the closest analog to plain JSON.stringify/parse.
const jsonOpt = { useCheckSum: false, useEncrypt: false };
for (const s of scenarios) {
  const packed = pack(s.data, s.schema as any, jsonOpt);
  const json = JSON.stringify(s.data);
  suite.add(`pack   ${s.name} [datapack]`, () => {
    pack(s.data, s.schema as any, jsonOpt);
  });
  suite.add(`pack   ${s.name} [JSON    ]`, () => {
    JSON.stringify(s.data);
  });
  suite.add(`unpack ${s.name} [datapack]`, () => {
    unpack(packed, s.schema as any, jsonOpt);
  });
  suite.add(`unpack ${s.name} [JSON    ]`, () => {
    JSON.parse(json);
  });
}

// Size comparison (bytes) — printed before the timing run.
const utf8 = new TextEncoder();
console.log("\n=== Serialized size (bytes) ===");
console.log("scenario  datapack      JSON   ratio");
for (const s of scenarios) {
  const dpLen = pack(s.data, s.schema as any, jsonOpt).length;
  const jsonLen = utf8.encode(JSON.stringify(s.data)).length;
  const ratio = dpLen / jsonLen;
  console.log(
    `${s.name}  ${String(dpLen).padStart(8)}  ${String(jsonLen).padStart(8)}   ${ratio.toFixed(3)}x`,
  );
}
console.log("");

suite
  .on("cycle", (e: any) => console.log(String(e.target)))
  .on("complete", () => console.log("done"))
  .run();

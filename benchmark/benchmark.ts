import { Suite } from "benchmark";
import { pack, unpack, UINT32, STRING, BOOL, UINT8, UINT16, INT8, INT16, INT32, FLOAT } from "../src";

// Scenario 1: Simple object with number fields
const simpleObjectSchema = {
    a: UINT8,
    b: UINT16,
    c: UINT32,
    d: INT8,
    e: INT16,
    f: INT32,
    g: FLOAT,
};
const simpleObjectData = {
    a: 255,
    b: 65535,
    c: 4294967295,
    d: -128,
    e: -32768,
    f: -2147483648,
    g: 123.456,
};
const packedSimpleObject = pack(simpleObjectData, simpleObjectSchema);
const jsonStringSimpleObject = JSON.stringify(simpleObjectData);


// Scenario 2: Full sample with complex type
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

const user = {
  userId: 101,
  nickName: "ABC",
  isVip: true,
  age: 34,
};

const post = {
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
};

const usersComplex = [];
const postsComplex = [];
for (let i = 0; i < 10; i++) {
  usersComplex.push(user);
  postsComplex.push(post);
}
const complexStateData = {
  users: usersComplex,
  posts: postsComplex,
};
const packedComplexObject = pack(complexStateData, stateDataSchema);
const jsonStringComplexObject = JSON.stringify(complexStateData);


// Scenario 3: Big object with full data (around 1MB)
const usersBig = [];
const postsBig = [];
for (let i = 0; i < 25000; i++) {
    usersBig.push(user);
    postsBig.push(post);
}
const bigStateData = {
    users: usersBig,
    posts: postsBig,
};
const packedBigObject = pack(bigStateData, stateDataSchema);
const jsonStringBigObject = JSON.stringify(bigStateData);


const suite = new Suite();

suite
  // Simple Object
  .add("pack simple object", () => {
    pack(simpleObjectData, simpleObjectSchema);
  })
  .add("unpack simple object", () => {
    unpack(packedSimpleObject, simpleObjectSchema);
  })
  .add("JSON.stringify simple object", () => {
    JSON.stringify(simpleObjectData);
  })
  .add("JSON.parse simple object", () => {
    JSON.parse(jsonStringSimpleObject);
  })

  // Complex Object
  .add("pack 10x complex object", () => {
    pack(complexStateData, stateDataSchema);
  })
  .add("unpack 10x complex object", () => {
    unpack(packedComplexObject, stateDataSchema);
  })
  .add("JSON.stringify 10x complex object", () => {
    JSON.stringify(complexStateData);
  })
  .add("JSON.parse 10x complex object", () => {
    JSON.parse(jsonStringComplexObject);
  })

  // Big Object
  .add("pack big object (~1MB)", () => {
    pack(bigStateData, stateDataSchema);
  })
  .add("unpack big object (~1MB)", () => {
    unpack(packedBigObject, stateDataSchema);
  })
  .add("JSON.stringify big object (~1MB)", () => {
    JSON.stringify(bigStateData);
  })
  .add("JSON.parse big object (~1MB)", () => {
    JSON.parse(jsonStringBigObject);
  })

  .on("cycle", (event: any) => {
    console.log(String(event.target));
  })
  .on("complete", () => {
    console.log("Benchmark is complete");
  })
  .run();

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
console.log('Simple object datapack size:', packedSimpleObject.length);
console.log('Simple object JSON size:', Buffer.from(jsonStringSimpleObject).length);


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

console.log('Complex object datapack size:', packedComplexObject.length);
console.log('Complex object JSON size:', Buffer.from(jsonStringComplexObject).length);

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

console.log('Big object datapack size:', packedBigObject.length);
console.log('Big object JSON size:', Buffer.from(jsonStringBigObject).length);

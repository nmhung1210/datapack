import { Suite } from "benchmark";
import { pack, unpack, UINT32, STRING, BOOL, UINT8, INT16 } from "../src";

const profile = {
  userId: 101,
  nickName: 12,
  isVip: true,
  age: 34,
};
const profileSchema = {
  userId: UINT32,
  nickName: INT16,
  isVip: BOOL,
  age: UINT8,
};

const packed = pack(profile, profileSchema);

const suite = new Suite();

suite
  .add("pack", () => {
    pack(profile, profileSchema);
  })
  .add("unpack", () => {
    unpack(packed, profileSchema);
  })
  .add("JSON.stringify", () => {
    JSON.stringify(profile);
  })
  .add("JSON.parse", () => {
    JSON.parse(JSON.stringify(profile));
  })
  .on("cycle", (event: any) => {
    console.log(String(event.target));
  })
  .on("complete", () => {
    console.log("Benchmark is complete");
  })
  .run({ async: true });

import { bench, describe } from "vitest";

import { basicFileInfo } from "./info.js";
import { adskExampleFile } from "./node.test.js";

describe("process blob", async () => {
  bench("basic family 2016", async () => {
    const file = await adskExampleFile("rac_basic_sample_family-2016.rfa");
    const info = await basicFileInfo(file);
    if (info.version !== "2016") throw Error(`Unexpected version ${info.version}`);
  });

  bench("basic family 2025", async () => {
    const file = await adskExampleFile("racbasicsamplefamily-2025.rfa");
    const info = await basicFileInfo(file);
    if (info.version !== "2025") throw Error(`Unexpected version ${info.version}`);
  });
});

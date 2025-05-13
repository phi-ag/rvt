import { describe, expect, test } from "vitest";

import { elementTable } from "./elementTable.js";
import { openPath } from "./node.js";
import { adskExampleFile, exampleFile } from "./node.test.js";

describe("element table", () => {
  test.skip("empty-2025", async () => {
    const file = await exampleFile("empty-2025.rvt");
    const table = await elementTable(file);

    expect(table.size).toEqual(2413);
  });

  test.skip("empty-2026", async () => {
    const file = await exampleFile("empty-2026.rvt");
    const table = await elementTable(file);

    expect(table.size).toEqual(2426);
  });

  test.skip("2021", async () => {
    const file = await adskExampleFile("racbasicsamplefamily-2021.rfa");
    const table = await elementTable(file);

    expect(table.size).toEqual(1814);
  });

  test.skip("2026", async () => {
    const file = await adskExampleFile("racbasicsamplefamily-2026.rfa");
    const table = await elementTable(file);

    expect(table.size).toEqual(1992);
  });

  test.skip("large-proprietary", async () => {
    const file = await openPath("/home/peter/rdp/008_YYYY_MOD_F10_Z01-2021.rvt");
    const table = await elementTable(file);

    expect(table.size).toEqual(1992);
  });
});

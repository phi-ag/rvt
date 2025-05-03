import { describe, expect, test } from "vitest";

import { elementTable } from "./elementTable.js";
import { adskExampleFile, exampleFile } from "./node.test.js";

describe("element table", () => {
  test("empty-2025", async () => {
    const file = await exampleFile("empty-2025.rvt");
    const table = await elementTable(file);

    expect(table.size).toEqual(2413);
  });

  test("empty-2026", async () => {
    const file = await exampleFile("empty-2026.rvt");
    const table = await elementTable(file);

    expect(table.size).toEqual(2426);
  });

  test("2026", async () => {
    const file = await adskExampleFile("racbasicsamplefamily-2026.rfa");
    const table = await elementTable(file);

    expect(table.size).toEqual(1992);
  });
});

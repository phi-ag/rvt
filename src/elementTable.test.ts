import { describe, expect, test } from "vitest";

import { elementTable } from "./elementTable.js";
import { exampleFile } from "./node.test.js";

describe("element table", () => {
  test("empty-2025", async () => {
    const file = await exampleFile("empty-2025.rvt");
    const table = await elementTable(file);

    expect(table.size).toEqual(2413);
  });

  test("2026", async () => {
    const file = await exampleFile("racbasicsamplefamily-2026.rfa");
    const table = await elementTable(file);

    expect(table.size).toEqual(1992);
  });
});

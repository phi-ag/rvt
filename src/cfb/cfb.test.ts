import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { BlobSource } from "./blob.js";
import { Cfb } from "./cfb.js";

const endOfChain = 0xfffffffe;
const sectorSize = 4096;

const loadExample = async (): Promise<Uint8Array> =>
  new Uint8Array(
    await readFile(
      join(
        import.meta.dirname,
        "..",
        "..",
        "examples",
        "Autodesk",
        "racbasicsamplefamily-2026.rfa"
      )
    )
  );

const open = (data: Uint8Array): Promise<Cfb> =>
  Cfb.initialize(new BlobSource(new Blob([data as BlobPart])));

/** Byte offset of a directory entry, assumes a single directory sector */
const entryOffset = (data: Uint8Array, name: string): number => {
  const view = new DataView(data.buffer, data.byteOffset);
  const directory = (view.getUint32(48, true) + 1) * sectorSize;
  const decoder = new TextDecoder("utf-16le");

  for (let offset = directory; offset < directory + sectorSize; offset += 128) {
    const nameLength = view.getUint16(offset + 64, true);
    if (nameLength < 2) continue;
    if (decoder.decode(data.subarray(offset, offset + nameLength - 2)) === name)
      return offset;
  }

  throw Error(`Entry ${name} not found`);
};

/** Byte offset of the first MiniFat sector */
const miniFatOffset = (data: Uint8Array): number => {
  const view = new DataView(data.buffer, data.byteOffset);
  return (view.getUint32(60, true) + 1) * sectorSize;
};

describe("cfb", () => {
  test("empty stream", async () => {
    const data = await loadExample();
    const entry = entryOffset(data, "BasicFileInfo");
    const view = new DataView(data.buffer, data.byteOffset);
    view.setUint32(entry + 116, endOfChain, true);
    view.setUint32(entry + 120, 0, true);

    const cfb = await open(data);
    const info = cfb.findEntry("BasicFileInfo");
    expect(info).toMatchObject({ start: endOfChain, size: 0 });
    expect(await cfb.entryData(info!)).toEqual(new Uint8Array());
  });

  test("cyclic mini fat chain", async () => {
    const data = await loadExample();
    const view = new DataView(data.buffer, data.byteOffset);
    const start = view.getUint32(entryOffset(data, "BasicFileInfo") + 116, true);
    view.setUint32(miniFatOffset(data) + start * 4, start, true);

    const cfb = await open(data);
    const entry = cfb.findEntry("BasicFileInfo")!;
    expect((await cfb.entryData(entry)).byteLength).toBe(entry.size);
  });

  test("cyclic fat chain", async () => {
    const data = await loadExample();
    const view = new DataView(data.buffer, data.byteOffset);
    const start = view.getUint32(entryOffset(data, "69") + 116, true);
    const cfb = await open(data);
    const entry = cfb.findEntry("69")!;

    const fatSector = view.getUint32(76, true);
    view.setUint32((fatSector + 1) * sectorSize + start * 4, start, true);

    const corrupted = await open(data);
    expect((await corrupted.entryData(entry)).byteLength).toBe(entry.size);
    expect(await cfb.entryData(entry)).not.toEqual(await corrupted.entryData(entry));
  });

  test("chain ends before stream size", async () => {
    const data = await loadExample();
    const view = new DataView(data.buffer, data.byteOffset);
    const start = view.getUint32(entryOffset(data, "BasicFileInfo") + 116, true);
    view.setUint32(miniFatOffset(data) + start * 4, endOfChain, true);

    const cfb = await open(data);
    await expect(cfb.entryData(cfb.findEntry("BasicFileInfo")!)).rejects.toThrow(
      "unexpected end of chain"
    );
  });
});

/** Directory index of an entry, assumes a single directory sector */
const entryIndex = (data: Uint8Array, name: string): number => {
  const view = new DataView(data.buffer, data.byteOffset);
  const directory = (view.getUint32(48, true) + 1) * sectorSize;
  return (entryOffset(data, name) - directory) / 128;
};

describe("cfb paths", () => {
  test("entries", async () => {
    const cfb = await open(await loadExample());
    expect(cfb.entries().map((entry) => entry.path)).toEqual([
      "",
      "Formats",
      "RevitPreview4.0",
      "Global",
      "Partitions",
      "Contents",
      "TransmissionData",
      "BasicFileInfo",
      "PartAtom",
      "Partitions/69",
      "Global/DocumentIncrementTable",
      "Global/History",
      "Global/PartitionTable",
      "Global/ContentDocuments",
      "Global/ElemTable",
      "Global/Latest",
      "Formats/Latest"
    ]);
  });

  test("find path", async () => {
    const cfb = await open(await loadExample());
    expect(cfb.findPath("Global/Latest")).toMatchObject({ name: "Latest", size: 68508 });
    expect(cfb.findPath("Formats/Latest")).toMatchObject({
      name: "Latest",
      size: 165553
    });
    expect(cfb.findPath("")).toMatchObject({ name: "Root Entry" });
    expect(cfb.findPath("Latest")).toBeUndefined();
    expect(cfb.findPath("Global/Missing")).toBeUndefined();
  });

  test("find entry returns first match", async () => {
    const cfb = await open(await loadExample());
    expect(cfb.findEntry("Latest")).toBe(cfb.findPath("Global/Latest"));
  });

  test("entries returns a copy", async () => {
    const cfb = await open(await loadExample());
    cfb.entries().length = 0;
    expect(cfb.entries()).toHaveLength(17);
  });

  test("cyclic directory tree", async () => {
    const data = await loadExample();
    const view = new DataView(data.buffer, data.byteOffset);
    const offset = entryOffset(data, "BasicFileInfo");
    view.setInt32(offset + 68, entryIndex(data, "BasicFileInfo"), true);

    await expect(open(data)).rejects.toThrow("Directory entry cycle");
  });

  test("directory tree references unused entry", async () => {
    const data = await loadExample();
    const view = new DataView(data.buffer, data.byteOffset);
    view.setInt32(entryOffset(data, "BasicFileInfo") + 68, 31, true);

    await expect(open(data)).rejects.toThrow("Directory entry reference invalid (31)");
  });
});

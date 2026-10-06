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

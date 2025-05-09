import { Cfb } from "./cfb/index.js";
import * as array from "./utils/array.js";

export interface ElementEntry {
  id: bigint;
  u1: number;
  u2: number;
  u3: number;
  u4: bigint;
  u5: number;
}

export interface ElementTable {
  fileVersion: number;
  size: number;
}

/*
 * TODO: quick and dirty decompress hack
 * - should be streaming
 * - underlying CFB should stream too
 * - `for await` doesn't work in Safari
 */
const decompress = async (data: Uint8Array): Promise<Uint8Array> => {
  const stream = new Blob([data]).stream();
  const decompressedStream = stream.pipeThrough(new DecompressionStream("gzip"));

  const chunks = [];
  try {
    for await (const chunk of decompressedStream) {
      chunks.push(chunk);
    }
  } catch (e) {
    if (e instanceof Error && (e.cause as { errno: number })?.errno === -3) {
      console.warn("Expected invalid gzip data in ElemTable");
    } else {
      throw e;
    }
  }

  const blob = new Blob(chunks);
  const buffer = await blob.arrayBuffer();
  //return new Uint8Array(buffer);
  const foo = new Uint8Array(buffer);
  //console.log("ASDFASF", foo.length);
  return foo;
  /*
  const stream = new DecompressionStream("gzip");
  try {
    await stream.writable.getWriter().write(data);
  } catch (e) {
    console.log("ASDF", e);
  }

  const result = await stream.readable.getReader().read();
  if (!result.value) throw Error("SDAF");

  console.log("ASDFASF", result.value.length);

  return result.value;
  */

  //console.log(await stream.readable.getReader().read()); // "Hello World"
};

const elementIdSize = (flag: number): 32 | 64 => {
  switch (flag) {
    case 0x04:
      return 32;
    case 0x05:
      return 64;
  }

  throw Error(`Unexpected element table id size (${flag})`);
};

const tableEntry32 = (view: DataView, offset: number): ElementEntry => {
  const id = view.getInt32(offset, true);
  const id2 = view.getInt32(offset + 4, true);
  const u1 = view.getInt32(offset + 8, true);
  const u2 = view.getInt32(offset + 12, true);
  const u3 = view.getInt32(offset + 16, true);
  const u4 = view.getInt32(offset + 20, true);
  const u5 = view.getInt32(offset + 24, true);

  // NOTE: found a large 2021 project where this throws
  if (id !== id2) throw Error(`Id mismatch (${id} != ${id2})`);
  // NOTE: found a large 2021 project where this throws
  if (u4 !== 0) throw Error(`Unknown4 is not zero (${id}) ${u5}`);

  return {
    id: BigInt(id),
    u1,
    u2,
    u3,
    u4: BigInt(u4),
    u5
  };
};

const tableEntry64 = (view: DataView, offset: number): ElementEntry => {
  const id = view.getBigInt64(offset, true);
  const u1 = view.getInt32(offset + 8, true);
  const u2 = view.getInt32(offset + 12, true);
  const u3 = view.getInt32(offset + 16, true);
  const id2 = view.getBigInt64(offset + 20, true);
  const u4 = view.getBigInt64(offset + 28, true);
  const u5 = view.getInt32(offset + 36, true);

  if (id !== id2) throw Error(`Id mismatch (${id} != ${id2})`);
  if (u5 !== 0) throw Error(`Unknown5 is not zero (${id})`);

  return {
    id,
    u1,
    u2,
    u3,
    u4,
    u5
  };
};

export const parseElementTable = async (data: Uint8Array): Promise<ElementTable> => {
  const header = data.subarray(0, 8);
  if (!array.isZero(header))
    throw Error(`Unexpected element table compressed header non-zero [${header}]`);

  const decompressed = await decompress(data.subarray(8));
  const fileVersion = decompressed[0];

  const idSize = elementIdSize(decompressed[1]);

  const view = new DataView(
    decompressed.buffer,
    decompressed.byteOffset,
    decompressed.byteLength
  );

  const size = view.getInt32(2, true);
  console.log("Size", size);
  console.log("View", view.buffer.byteLength);

  const chunkSize = idSize === 32 ? 28 : 40;
  console.log("chunks", (view.buffer.byteLength - 6) / chunkSize);

  const ids: ElementEntry[] = [];
  for (let i = 0; i < size; i++) {
    const offset = i * chunkSize + 6;

    const entry = idSize === 32 ? tableEntry32(view, offset) : tableEntry64(view, offset);
    ids.push(entry);
    //if (entry.id === BigInt(size)) break;
    //throw Error("ASDFASFASDF");
  }

  console.log(ids.slice(0, 200));

  /*
  console.log(ids.slice(0, 100).map((e) => e.id));
  //const missing = [1521n, 1957n, 1967n, 1976n, 2283n];
  const missing = [17n, 23n, 24n, 25n, 29n, 31n, 32n, 33n, 5702n, 5701n, 7199n, 7200n];
  //console.log(ids.slice(0, 100).map((e) => e.id));

  console.log(ids.filter((e) => e.id === 0n));
  console.log(ids.filter((e) => missing.includes(e.id)));

  console.log(ids.filter((e) => e.id > e.unknown4).length);
  //console.log(ids.filter((e) => e.unknown2 !== 74).length);

  console.log(
    ids.filter(
      (e) =>
        !(
          e.unknown1 === 74 &&
          e.unknown2 === 74 &&
          e.unknown3 === 74 &&
          e.id > e.unknown4
        )
    ).length
  );

  //console.log(ids.filter((e) => e.unknown4 !== -1n).length);

  console.log(ids.filter((e) => e.id <= e.unknown4));
  console.log(ids.find((e) => e.id === 1530n));
  console.log(ids.find((e) => e.id === 1527n));
  */

  //const foo = ids.filter((e) => e.id > e.unknown4);
  //writeFileSync("ids.txt", foo.map((e) => e.id).join(","));

  return { fileVersion, size };
};

export interface ElementTableSuccess {
  ok: true;
  data: ElementTable;
  error?: never;
}

export interface ElementTableError {
  ok: false;
  data?: never;
  error: string;
}

export type ElementTableResult = ElementTableSuccess | ElementTableError;

export const elementTable = async (cfb: Cfb): Promise<ElementTable> => {
  const entry = cfb.findEntry("ElemTable");
  if (!entry) throw Error("ElemTable not found");
  return await parseElementTable(await cfb.entryData(entry));
};

export const tryElementTable = async (cfb: Cfb): Promise<ElementTableResult> => {
  try {
    return { ok: true, data: await elementTable(cfb) };
  } catch (e) {
    if (e instanceof Error) return { ok: false, error: e.message };
    throw e;
  }
};

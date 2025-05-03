import { Cfb } from "./cfb/index.js";
import * as array from "./utils/array.js";

export interface ElementEntry {
  id: bigint;
  unknown1: number;
  unknown2: number;
  unknown3: number;
  unknown4: bigint;
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
  for await (const chunk of decompressedStream) {
    chunks.push(chunk);
  }

  const blob = new Blob(chunks);
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
};

export const parseElementTable = async (data: Uint8Array): Promise<ElementTable> => {
  const header = data.subarray(0, 8);
  if (!array.isZero(header))
    throw Error(`Unexpected element table compressed header non-zero [${header}]`);

  const decompressed = await decompress(data.subarray(8));
  const fileVersion = decompressed[0];

  if (decompressed[1] !== 0x05)
    throw Error(`Unexpected element table decompressed header [${decompressed[1]}]`);

  const view = new DataView(
    decompressed.buffer,
    decompressed.byteOffset,
    decompressed.byteLength
  );

  const size = view.getInt32(2, true);

  const ids: ElementEntry[] = [];
  for (let i = 0; i < size; i++) {
    const offset = i * 40 + 6;
    const id = view.getBigInt64(offset, true);
    const unknown1 = view.getInt32(offset + 8, true);
    const unknown2 = view.getInt32(offset + 12, true);
    const unknown3 = view.getInt32(offset + 16, true);
    const id2 = view.getBigInt64(offset + 20, true);
    const unknown4 = view.getBigInt64(offset + 28, true);
    const unknown5 = view.getInt32(offset + 36, true);

    if (id !== id2) throw Error(`Id mismatch (${id} != ${id2})`);
    if (unknown5 !== 0) throw Error(`Unknown5 is not zero (${id})`);

    ids.push({
      id,
      unknown1,
      unknown2,
      unknown3,
      unknown4
    });
  }

  console.log(size);
  //const missing = [1521n, 1957n, 1967n, 1976n, 2283n];
  const missing = [17n, 23n, 24n, 25n, 29n, 31n, 32n, 33n, 5702n, 5701n, 7199n, 7200n];
  //console.log(ids.slice(0, 100).map((e) => e.id));

  console.log(ids.filter((e) => e.id === 0n));
  /*
  console.log(ids.filter((e) => e.id === 1n));
  console.log(ids.filter((e) => e.id === 1519n));
  console.log(ids.filter((e) => e.id === 1520n));
  */
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

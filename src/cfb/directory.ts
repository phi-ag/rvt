import * as array from "../utils/array.js";
import { type Header } from "./header.js";
import { readDate } from "./utils.js";

export enum EntryColor {
  Red = 0,
  Black = 1
}

export enum EntryType {
  Unknown = 0,
  Storage = 1,
  Stream = 2,
  RootStorage = 5
}

export interface Entry {
  name: string;
  /** Full path from the root storage, eg. `Global/Latest`, the root itself is `""` */
  path: string;
  type: EntryType;
  color: EntryColor;
  left: number;
  right: number;
  child: number;
  clsid: Uint8Array;
  state: number;
  created?: Date;
  modified?: Date;
  start: number;
  size: number;
}

const decoder = new TextDecoder("utf-16le");

type RawEntry = Omit<Entry, "path">;

const parseEntry = (data: Uint8Array): RawEntry => {
  const view = new DataView(data.buffer, data.byteOffset);

  const maxNameLength = 64;
  const nameLength = view.getUint16(maxNameLength, true);
  const name = decoder.decode(data.subarray(0, nameLength - 2));

  const type = data[66] as EntryType;
  if (!(type in EntryType)) throw Error(`Unexpected entry type (${type})`);

  const color = data[67] as EntryColor;
  if (!(color in EntryColor)) throw Error(`Unexpected entry color (${color})`);

  const left = view.getInt32(68, true);
  const right = view.getInt32(72, true);
  const child = view.getInt32(76, true);
  const clsid = data.slice(80, 80 + 16);
  const state = view.getInt32(96, true);

  const hasCreated = !array.isZero(data.subarray(100, 108));
  const created = hasCreated ? readDate(view, 100) : undefined;

  const hasModified = !array.isZero(data.subarray(108, 116));
  const modified = hasModified ? readDate(view, 108) : undefined;

  const start = view.getUint32(116, true);
  const size = view.getUint32(120, true);

  return {
    name,
    type,
    color,
    left,
    right,
    child,
    clsid,
    state,
    created,
    modified,
    start,
    size
  };
};

export type Directory = Entry[];

const noStream = -1;

const parseDirectorySector = (
  entryCount: number,
  sector: Uint8Array
): (RawEntry | undefined)[] => {
  const entries = [];
  for (let i = 0; i < entryCount; i++) {
    const start = i * 128;
    const entry = parseEntry(sector.subarray(start, start + 128));
    entries.push(entry.type !== EntryType.Unknown ? entry : undefined);
  }

  return entries;
};

/**
 * Walk the red-black tree of each storage to resolve the full path of every entry
 *
 * Entries reference each other by their index in the directory, including unused entries.
 */
const resolvePaths = (entries: (RawEntry | undefined)[]): (string | undefined)[] => {
  const paths: (string | undefined)[] = [];

  const rootIndex = entries.findIndex((entry) => entry?.type === EntryType.RootStorage);
  if (rootIndex === -1) return paths;

  paths[rootIndex] = "";
  const stack: [index: number, parent: string][] = [[entries[rootIndex]!.child, ""]];

  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    const [index, parent] = item;
    if (index === noStream) continue;

    const entry = entries[index];
    if (!entry) throw Error(`Directory entry reference invalid (${index})`);
    if (paths[index] !== undefined) throw Error(`Directory entry cycle (${index})`);

    const path = parent ? `${parent}/${entry.name}` : entry.name;
    paths[index] = path;

    stack.push([entry.left, parent], [entry.right, parent]);
    if (entry.type === EntryType.Storage) stack.push([entry.child, path]);
  }

  return paths;
};

/**
 * Parse the CFB directory
 *
 * Entries are returned in directory order, unused and unreachable entries are skipped.
 *
 * - https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-cfb/60fe8611-66c3-496b-b70d-a504c94c9ace
 * - https://github.com/SheetJS/js-cfb/blob/master/cfb.js#L618
 */
export const parseDirectory = (header: Header, sectors: Uint8Array): Directory => {
  const entryCount = header.version === 3 ? 4 : 32;

  const entries = [];
  for (let i = 0; i < header.directorySectorCount; i++) {
    const start = i * header.sectorSize;
    const end = start + header.sectorSize;
    const sectorEntries = parseDirectorySector(entryCount, sectors.subarray(start, end));
    for (const entry of sectorEntries) entries.push(entry);
  }

  const paths = resolvePaths(entries);

  const directory: Directory = [];
  entries.forEach((entry, i) => {
    const path = paths[i];
    if (entry && path !== undefined) directory.push({ ...entry, path });
  });

  return directory;
};

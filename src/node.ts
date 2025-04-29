import { openAsBlob } from "node:fs";

import { Cfb } from "./cfb/index.js";

export interface OpenPathSuccess {
  ok: true;
  data: Cfb;
  error?: never;
}

export interface OpenPathError {
  ok: false;
  data?: never;
  error: string;
}

export type OpenPathResult = OpenPathSuccess | OpenPathError;

export const openPath = async (path: string): Promise<Cfb> =>
  Cfb.initialize(await openAsBlob(path));

export const tryOpenPath = async (path: string): Promise<OpenPathResult> => {
  try {
    return { ok: true, data: await openPath(path) };
  } catch (e) {
    if (e instanceof Error) return { ok: false, error: e.message };
    throw e;
  }
};

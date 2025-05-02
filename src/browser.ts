import { BlobSource, Cfb } from "./cfb/index.js";

export interface OpenFileSuccess {
  ok: true;
  data: Cfb;
  error?: never;
}

export interface OpenFileError {
  ok: false;
  data?: never;
  error: string;
}

export type OpenFileResult = OpenFileSuccess | OpenFileError;

export const openFile = async (file: File): Promise<Cfb> =>
  Cfb.initialize(new BlobSource(file));

export const tryOpenFile = async (file: File): Promise<OpenFileResult> => {
  try {
    return { ok: true, data: await openFile(file) };
  } catch (e) {
    if (e instanceof Error) return { ok: false, error: e.message };
    throw e;
  }
};

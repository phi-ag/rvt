import { Cfb, type Source } from "./cfb/index.js";

export class DenoSource implements Source, Disposable {
  #file: Deno.FsFile;
  size: number;

  constructor(file: Deno.FsFile, size: number) {
    this.#file = file;
    this.size = size;
  }

  [Symbol.dispose](): void {
    this.#file.close();
  }

  static async open(path: string | URL): Promise<DenoSource> {
    const file = await Deno.open(path);
    const fileInfo = await file.stat();
    return new DenoSource(file, fileInfo.size);
  }

  async sliceBytes(start: number, end: number): Promise<Uint8Array> {
    if (start > end) throw Error(`Invalid slice arguments (start: ${start}, end ${end})`);

    const position = await this.#file.seek(start, Deno.SeekMode.Start);
    if (position !== start)
      throw Error(`Failed to seek to position ${start} (received ${position})`);

    const size = end - start;
    const buffer = new Uint8Array(size);
    const bytesRead = await this.#file.read(buffer);

    if (bytesRead !== size)
      throw Error(`Failed to read ${size} bytes from file (received ${bytesRead})`);

    return buffer;
  }

  async sliceView(start: number, end: number): Promise<DataView> {
    const buffer = await this.sliceBytes(start, end);
    return new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }
}

export type DisposableCfb = Disposable & { data: Cfb };

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

export type OpenPathResult = Disposable & (OpenPathSuccess | OpenPathError);

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

export const openPath = async (path: string | URL): Promise<DisposableCfb> => {
  const source = await DenoSource.open(path);

  return {
    data: await Cfb.initialize(source),
    [Symbol.dispose]: () => source[Symbol.dispose]()
  };
};

export const tryOpenPath = async (path: string): Promise<OpenPathResult> => {
  try {
    const cfb = await openPath(path);
    return { ok: true, data: cfb.data, [Symbol.dispose]: () => cfb[Symbol.dispose]() };
  } catch (e) {
    if (e instanceof Error)
      return { ok: false, error: e.message, [Symbol.dispose]: noop };
    throw e;
  }
};

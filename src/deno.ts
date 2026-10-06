import { Cfb, type Source } from "./cfb/index.js";

export class DenoSource implements Source, Disposable {
  #file: Deno.FsFile;
  // Seek and read share the file position, run one slice at a time
  #queue: Promise<unknown> = Promise.resolve();
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

  sliceBytes(start: number, end: number): Promise<Uint8Array> {
    const slice = this.#queue.then(() => this.#readSlice(start, end));
    this.#queue = slice.catch(noop);
    return slice;
  }

  async #readSlice(start: number, end: number): Promise<Uint8Array> {
    if (start > end) throw Error(`Invalid slice arguments (start: ${start}, end ${end})`);

    const position = await this.#file.seek(start, Deno.SeekMode.Start);
    if (position !== start)
      throw Error(`Failed to seek to position ${start} (received ${position})`);

    const size = end - start;
    const buffer = new Uint8Array(size);

    // A read may return fewer bytes than requested
    let bytesRead = 0;
    while (bytesRead < size) {
      const n = await this.#file.read(buffer.subarray(bytesRead));
      if (n === null) break;
      bytesRead += n;
    }

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

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

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

export const openPath = async (path: string | URL): Promise<DisposableCfb> => {
  const source = await DenoSource.open(path);

  try {
    return {
      data: await Cfb.initialize(source),
      [Symbol.dispose]: () => source[Symbol.dispose]()
    };
  } catch (e) {
    source[Symbol.dispose]();
    throw e;
  }
};

export const tryOpenPath = async (path: string | URL): Promise<OpenPathResult> => {
  try {
    const cfb = await openPath(path);
    return { ok: true, data: cfb.data, [Symbol.dispose]: () => cfb[Symbol.dispose]() };
  } catch (e) {
    if (e instanceof Error)
      return { ok: false, error: e.message, [Symbol.dispose]: noop };
    throw e;
  }
};

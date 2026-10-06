import { expect } from "jsr:@std/expect";
import { describe, it } from "jsr:@std/testing/bdd";
import { stub } from "jsr:@std/testing/mock";

import { DenoSource, openPath, tryOpenPath } from "../../dist/deno.js";
import { basicFileInfo } from "../../dist/index.js";

const examplePath = "../../examples/Autodesk/racbasicsamplefamily-2026.rfa";

/** File that returns at most `chunkSize` bytes per read, like a pipe or network file system */
class ChunkedFile {
  #data: Uint8Array;
  #chunkSize: number;
  #position = 0;

  constructor(data: Uint8Array, chunkSize: number) {
    this.#data = data;
    this.#chunkSize = chunkSize;
  }

  seek(offset: number): Promise<number> {
    this.#position = offset;
    return Promise.resolve(offset);
  }

  read(buffer: Uint8Array): Promise<number | null> {
    if (this.#position >= this.#data.length) return Promise.resolve(null);

    const end = Math.min(
      this.#position + buffer.length,
      this.#position + this.#chunkSize,
      this.#data.length
    );
    buffer.set(this.#data.subarray(this.#position, end));

    const bytesRead = end - this.#position;
    this.#position = end;
    return Promise.resolve(bytesRead);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  close(): void {}
}

const chunkedSource = (data: Uint8Array, chunkSize: number): DenoSource =>
  new DenoSource(new ChunkedFile(data, chunkSize) as unknown as Deno.FsFile, data.length);

describe("deno source", () => {
  it("short reads", async () => {
    const data = new Uint8Array(1000).map((_, i) => i % 256);
    using source = chunkedSource(data, 100);

    expect(await source.sliceBytes(50, 750)).toEqual(data.subarray(50, 750));
  });

  it("read past end of file", async () => {
    using source = chunkedSource(new Uint8Array(100), 100);

    await expect(source.sliceBytes(50, 150)).rejects.toThrow(
      "Failed to read 100 bytes from file (received 50)"
    );
  });

  it("concurrent reads", async () => {
    const data = await Deno.readFile(examplePath);
    using source = await DenoSource.open(examplePath);

    const offsets = Array.from({ length: 32 }, (_, i) => i * 4096);
    const slices = await Promise.all(
      offsets.map((offset) => source.sliceBytes(offset, offset + 512))
    );

    slices.forEach((slice, i) =>
      expect(slice).toEqual(data.subarray(offsets[i], offsets[i] + 512))
    );
  });

  it("open url", async () => {
    using file = await openPath(new URL(examplePath, import.meta.url));
    expect((await basicFileInfo(file.data)).version).toBe("2026");

    using result = await tryOpenPath(new URL(examplePath, import.meta.url));
    expect(result.ok).toBe(true);
  });
});

/** Record files opened by `fn`, closing any it leaves open */
const openedFiles = async (fn: () => Promise<unknown>): Promise<Deno.FsFile[]> => {
  const open = Deno.open;
  const files: Deno.FsFile[] = [];

  {
    using _open = stub(Deno, "open", async (path, options) => {
      const file = await open(path, options);
      files.push(file);
      return file;
    });

    await fn();
  }

  const leaked = files.filter((file) => !isClosed(file));
  for (const file of leaked) file.close();
  expect(leaked).toEqual([]);

  return files;
};

const isClosed = (file: Deno.FsFile): boolean => {
  try {
    file.statSync();
    return false;
  } catch (e) {
    if (e instanceof Deno.errors.BadResource) return true;
    throw e;
  }
};

describe("deno open", () => {
  it("close file if open fails", async () => {
    const files = await openedFiles(() =>
      expect(openPath("../../README.md")).rejects.toThrow(
        "Unexpected compound file signature"
      )
    );
    expect(files).toHaveLength(1);
  });

  it("close file if try open fails", async () => {
    const files = await openedFiles(async () => {
      using result = await tryOpenPath("../../README.md");
      expect(result.ok).toBe(false);
    });
    expect(files).toHaveLength(1);
  });

  it("close file on dispose", async () => {
    const files = await openedFiles(async () => {
      using _file = await openPath(examplePath);
    });
    expect(files).toHaveLength(1);
  });
});

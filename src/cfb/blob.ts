import { type Source } from "./source.js";

export class BlobSource implements Source {
  #blob: Blob;
  size: number;

  constructor(blob: Blob) {
    this.#blob = blob;
    this.size = blob.size;
  }

  async sliceBytes(start: number, end: number): Promise<Uint8Array> {
    return new Uint8Array(await this.#blob.slice(start, end).arrayBuffer());
  }

  async sliceView(start: number, end: number): Promise<DataView> {
    return new DataView(await this.#blob.slice(start, end).arrayBuffer());
  }
}

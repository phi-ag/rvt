import { describe, expect, test } from "vitest";

import { parsePreview } from "./thumbnail.js";

const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const iend = [0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82];

// Chunk with a 4 byte payload containing "IEND", must not be mistaken for the end
const chunk = [
  0x00, 0x00, 0x00, 0x04, 0x74, 0x45, 0x58, 0x74, 0x49, 0x45, 0x4e, 0x44, 0x01, 0x02,
  0x03, 0x04
];

const png = [...signature, ...chunk, ...iend];

const bytes = async (blob: Blob): Promise<number[]> => [
  ...new Uint8Array(await blob.arrayBuffer())
];

describe("thumbnail", () => {
  test("image at start", async () => {
    const preview = parsePreview(new Uint8Array(png));
    expect(preview.type).toBe("image/png");
    expect(await bytes(preview)).toEqual(png);
  });

  test("strip data before and after image", async () => {
    const preview = parsePreview(new Uint8Array([0x01, 0x02, ...png, 0xff, 0xff]));
    expect(await bytes(preview)).toEqual(png);
  });

  test("keep truncated image", async () => {
    const truncated = [...signature, ...chunk.slice(0, 10)];
    const preview = parsePreview(new Uint8Array([0x01, ...truncated]));
    expect(await bytes(preview)).toEqual(truncated);
  });

  test("missing image", () => {
    expect(() => parsePreview(new Uint8Array([0x01, 0x02, 0x03]))).toThrow(
      "Failed to find preview image marker"
    );
  });
});

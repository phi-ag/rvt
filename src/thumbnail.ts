import { Cfb } from "./cfb/index.js";

const findMarker = (data: Uint8Array): number | undefined => {
  const imageMarker = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a];

  for (let i = 0; i <= data.length - 6; i++) {
    if (
      data[i] === imageMarker[0] &&
      data[i + 1] === imageMarker[1] &&
      data[i + 2] === imageMarker[2] &&
      data[i + 3] === imageMarker[3] &&
      data[i + 4] === imageMarker[4] &&
      data[i + 5] === imageMarker[5]
    ) {
      return i;
    }
  }
};

/**
 * Walk the PNG chunks to find the end of the image, data after IEND is not part of it
 *
 * - https://www.w3.org/TR/png-3/#5Chunk-layout
 */
const findEnd = (data: Uint8Array, start: number): number | undefined => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const signatureLength = 8;
  const iend = [0x49, 0x45, 0x4e, 0x44];

  for (let offset = start + signatureLength; offset + 12 <= data.length;) {
    // Length (4) + type (4) + data + crc (4), length is big-endian
    const end = offset + 12 + view.getUint32(offset);
    if (end > data.length) return;

    if (
      data[offset + 4] === iend[0] &&
      data[offset + 5] === iend[1] &&
      data[offset + 6] === iend[2] &&
      data[offset + 7] === iend[3]
    ) {
      return end;
    }

    offset = end;
  }
};

export const parsePreview = (data: Uint8Array): Blob => {
  const marker = findMarker(data);
  if (marker === undefined) throw Error("Failed to find preview image marker");

  // Keep the remaining data if the image is truncated, decoders may still handle it
  const end = findEnd(data, marker) ?? data.length;

  return new Blob([data.subarray(marker, end) as BlobPart], {
    type: "image/png"
  });
};

export interface ThumbnailSuccess {
  ok: true;
  data: Blob;
  error?: never;
}

export interface ThumbnailError {
  ok: false;
  data?: never;
  error: string;
}

export type ThumbnailResult = ThumbnailSuccess | ThumbnailError;

export const thumbnail = async (cfb: Cfb): Promise<Blob> => {
  const entry = cfb.findEntry("RevitPreview4.0");
  if (!entry) throw Error("RevitPreview4.0 not found");
  return parsePreview(await cfb.entryData(entry));
};

export const tryThumbnail = async (cfb: Cfb): Promise<ThumbnailResult> => {
  try {
    return { ok: true, data: await thumbnail(cfb) };
  } catch (e) {
    if (e instanceof Error) return { ok: false, error: e.message };
    throw e;
  }
};

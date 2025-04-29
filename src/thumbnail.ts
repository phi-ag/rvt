import { Cfb } from "./cfb/index.js";

const findMarker = (data: Uint8Array): number | undefined => {
  const imageMarker = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a];

  for (let i = 0; i < data.length - 6; i++) {
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

export const parsePreview = (data: Uint8Array): Blob => {
  const marker = findMarker(data);
  if (!marker) throw Error("Failed to find preview image marker");

  return new Blob([data.subarray(marker)], {
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

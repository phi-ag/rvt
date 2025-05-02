export interface Source {
  size: number;
  sliceBytes: (start: number, end: number) => Promise<Uint8Array>;
  sliceView: (start: number, end: number) => Promise<DataView>;
}

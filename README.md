# @phi-ag/rvt

[![Version](https://img.shields.io/npm/v/%40phi-ag%2Frvt?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@phi-ag/rvt)
[![Coverage](https://img.shields.io/codecov/c/github/phi-ag/rvt?style=for-the-badge)](https://app.codecov.io/github/phi-ag/rvt)
[![Downloads](https://img.shields.io/npm/d18m/%40phi-ag%2Frvt?style=for-the-badge)](https://www.npmjs.com/package/@phi-ag/rvt)
[![Size](https://img.shields.io/npm/unpacked-size/%40phi-ag%2Frvt?style=for-the-badge&label=size&color=lightgray)](https://www.npmjs.com/package/@phi-ag/rvt)

Parse Revit file format

## Usage

    pnpm add @phi-ag/rvt

### Examples

Node.js / Bun

```ts
import { basicFileInfo, thumbnail } from "@phi-ag/rvt";
import { openPath } from "@phi-ag/rvt/node";

const file = await openPath("family.rfa");
const info = await basicFileInfo(file);
const image = await thumbnail(file);

console.log(info);
```

Deno

```ts
import { basicFileInfo, thumbnail } from "@phi-ag/rvt";
import { openPath } from "@phi-ag/rvt/deno";

using file = await openPath("family.rfa");
const info = await basicFileInfo(file.data);
const image = await thumbnail(file.data);

console.log(info);
```

Browser

```ts
import { basicFileInfo, openFile, thumbnail } from "@phi-ag/rvt";

// Get a file handle from <input type="file" accept=".rfa,.rvt" />
// see https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications
const selectedFile = document.getElementById("input").files[0];

const file = await openFile(selectedFile);
const info = await basicFileInfo(file);
const image = await thumbnail(file);

console.log(info);
```

If you don't want to throw errors, use `tryOpenPath`, `tryOpenFile`, `tryBasicFileInfo` and `tryThumbnail`

```ts
tryOpenPath("valid.rvt");
// => { ok: true; data: ... }

tryOpenPath("invalid.rvt");
// => { ok: false; error: "Error message" }

tryBasicFileInfo(validFile);
// => { ok: true; data: { version, build, ... } }

tryBasicFileInfo(invalidFile);
// => { ok: false; error: "Error message" }
```

## Development

Install [fnm](https://github.com/Schniz/fnm?tab=readme-ov-file#installation) or [nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating) ([nvm-windows](https://github.com/coreybutler/nvm-windows?tab=readme-ov-file#installation--upgrades))

Install `Node.js`

    fnm use

Install `pnpm`

    corepack enable
    corepack prepare --activate

Install packages

    pnpm i

Watch

    pnpm dev

Test

    pnpm test

## Reverse Engineering

The code in this repository was created through [clean-room reverse engineering](https://en.wikipedia.org/wiki/Clean-room_design).

### Tools

- [7zip](https://github.com/ip7z/7zip)
- [binwalk](https://github.com/ReFirmLabs/binwalk)
- Hex editor (eg. [ImHex](https://github.com/WerWolv/ImHex))

### Example

1. Pick a file you want to inspect. I'm using [racbasicsamplefamily-2026.rfa](examples/racbasicsamplefamily-2026.rfa) for this example.
2. Extract the [Compound File Binary Format](https://en.wikipedia.org/wiki/Compound_File_Binary_Format) using `7z`.

```
7z x racbasicsamplefamily-2026.rfa

.
├── BasicFileInfo
├── Contents
├── Formats
│   └── Latest
├── Global
│   ├── ContentDocuments
│   ├── DocumentIncrementTable
│   ├── ElemTable
│   ├── History
│   ├── Latest
│   └── PartitionTable
├── PartAtom
├── Partitions
│   └── 69
├── RevitPreview4.0
└── TransmissionData
```

3. Recursively analyze and extract data using `binwalk`.

```
binwalk -Me Global/ElemTable

extractions/
├── ElemTable -> /home/peter/rdp/family-2026/Global/ElemTable
└── ElemTable.extracted
    └── 8
        └── decompressed.bin
```

4. Use a hex editor to inspect the data.

```
imhex extractions/ElemTable.extracted/8/decompressed.bin
```

5. Start to guess what the data could represent.

```
Hex View 00 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F

00000000 C9 05 C8 07 00 00 00 00 00 00 00 00 00 00 00 00 ................
```

After looking at a couple of files I'm thinking:

- The first byte could indicate the file version, seems to be consistent for a given Revit version.
- The second byte seems to be always `05`.
- Interpreting the next 4 bytes `C8 07 00 00` as little-endian `int32` is `1992`.
  - I believe this is the total amount of entries in this file.
  - It seems strange that they are using `int32` for this value as they moved to `int64` element ids, see [64-Bit Element Ids, Maybe?](https://thebuildingcoder.typepad.com/blog/2022/11/64-bit-element-ids-maybe.html)
- After the initial 6 bytes the file can be processed in 40 byte chunks (everything little-endian):
  - Id: `int64`
  - Unknown (1): `int32`
  - Unknown (2): `int32`
  - Unknown (3): `int32`
  - Id (2): `int64` (seems to be always identical to the first id)
  - Unknown (4): `int64`
  - Unknown (5): `int32`

This is as far as I got for `ElemTable`.

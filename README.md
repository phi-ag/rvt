# @phi-ag/rvt

[![Version](https://img.shields.io/npm/v/%40phi-ag%2Frvt?style=for-the-badge&color=blue)](https://www.npmjs.com/package/@phi-ag/rvt)
[![Coverage](https://img.shields.io/codecov/c/github/phi-ag/rvt?style=for-the-badge)](https://app.codecov.io/github/phi-ag/rvt)
[![Downloads](https://img.shields.io/npm/d18m/%40phi-ag%2Frvt?style=for-the-badge)](https://www.npmjs.com/package/@phi-ag/rvt)
[![Size](https://img.shields.io/npm/unpacked-size/%40phi-ag%2Frvt?style=for-the-badge&label=size&color=lightgray)](https://www.npmjs.com/package/@phi-ag/rvt)

Parse Revit file format

## Usage

    pnpm add @phi-ag/rvt

### Examples

Node.js / Deno / Bun

```ts
import { basicFileInfo, thumbnail } from "@phi-ag/rvt";
import { openPath } from "@phi-ag/rvt/node";

const file = await openPath("family.rfa");
const info = await basicFileInfo(file);
const image = await thumbnail(file);

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

tryBasicFileInfo("valid.rvt");
// => { ok: true; data: { version, build, ... } }

tryBasicFileInfo("invalid.rvt");
// => { ok: false; error: "Error message" }
```

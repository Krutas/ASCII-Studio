# ASCII Studio Core

A TypeScript package that turns decoded RGB or RGBA pixels into a colored ASCII grid. The package has zero runtime dependencies and uses standard JavaScript types, so it can run in a browser, a worker, or Node.js. The caller supplies decoded pixels and decides how to render or export the grid.

## Install in another project

Build a tarball from a checkout of this repository. The pack command compiles the package and includes JavaScript and TypeScript declarations.

```sh
cd packages/ascii-core
npm ci
npm pack
```

From the consuming project, install the resulting file.

```sh
npm install /path/to/ascii-studio-core-0.1.0.tgz
```

## Convert pixels

```ts
import { convertToAscii } from "ascii-studio-core";

const grid = convertToAscii({
  width: 2,
  height: 1,
  data: new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]),
}, {
  columns: 2,
  charset: " #",
});

console.log(grid.glyphs); // " #"
console.log([...grid.colors]); // [0, 0, 0, 255, 255, 255]
```

Canvas `ImageData` can be passed directly. For packed RGB input, set `channels: 3`. Pixels must be contiguous, left to right, top to bottom, with four bytes per pixel by default. Transparent pixels are composited over `background` before averaging. For video, call the same function for each decoded frame and keep timestamps in the caller.

The result stores glyphs consecutively with no line separators. Row `y` starts at `y * grid.columns`. The RGB triple for cell `i` starts at `i * 3` in `grid.colors`. The grid also carries `background` for the renderer.

| Option | Default | Meaning |
| --- | --- | --- |
| `columns` | Source width, capped at 120 | Output columns |
| `cellAspect` | 0.5 | Glyph width divided by height, between 0.01 and 100. Row count is derived from this and the image proportions. |
| `charset` | `" .:-=+*#%@"` | Printable ASCII characters ordered from lowest to highest ink coverage |
| `colorMode` | `"rgb"` | `"rgb"`, `"grayscale"`, or `"monochrome"` |
| `background` | `[0, 0, 0]` | RGB background for compositing and rendering |
| `foreground` | `[255, 255, 255]` | RGB glyph color in monochrome mode |
| `saturation` | 1 | Saturation multiplier from 0 to 4 |
| `brightness` | 0 | Brightness offset from −1 to 1 |
| `contrast` | 1 | Contrast multiplier from 0 to 4 |
| `invert` | false | Reverse how brightness selects glyphs |

Adjustments apply in the order saturation, brightness, contrast. Conversion runs synchronously and limits the output to 1,000,000 cells. For large frames or continuous video, call it inside a worker to keep the UI responsive.

Run `npm test` to compile and test the package.

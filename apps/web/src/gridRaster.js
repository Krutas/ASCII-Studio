const FIRST_GLYPH = 32;
const GLYPH_COUNT = 95;

function makeGlyphMasks(width, height) {
  const atlas = document.createElement("canvas");
  atlas.width = width * GLYPH_COUNT;
  atlas.height = height;
  const context = atlas.getContext("2d");
  context.font = (height * 16 / 18) + "px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (let glyph = 1; glyph < GLYPH_COUNT; glyph++) {
    context.fillText(String.fromCharCode(FIRST_GLYPH + glyph), (glyph + 0.5) * width, height / 2, width);
  }

  const pixels = context.getImageData(0, 0, atlas.width, height).data;
  const masks = new Uint8Array(width * height * GLYPH_COUNT);
  for (let glyph = 0; glyph < GLYPH_COUNT; glyph++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        masks[(glyph * height + y) * width + x] = pixels[(y * atlas.width + glyph * width + x) * 4 + 3];
      }
    }
  }
  return masks;
}

function cellEdges(count, size) {
  return Array.from({ length: count + 1 }, (_, index) => Math.round(index * size / count));
}

function prepareRaster(context, grid, { width, height }) {
  context.canvas.width = width;
  context.canvas.height = height;
  const frame = context.createImageData(width, height);
  const packed = new Uint32Array(frame.data.buffer);
  const xEdges = cellEdges(grid.columns, width);
  const yEdges = cellEdges(grid.rows, height);
  const backgroundPixel = Uint8Array.of(...grid.background, 255);
  const background = new Uint32Array(backgroundPixel.buffer)[0];
  const masks = new Map();

  for (let y = 0; y < grid.rows; y++) {
    const cellHeight = yEdges[y + 1] - yEdges[y];
    for (let x = 0; x < grid.columns; x++) {
      const cellWidth = xEdges[x + 1] - xEdges[x];
      const key = cellHeight * (width + 1) + cellWidth;
      if (cellWidth && cellHeight && !masks.has(key)) {
        masks.set(key, makeGlyphMasks(cellWidth, cellHeight));
      }
    }
  }

  return (grid) => {
    const [backgroundRed, backgroundGreen, backgroundBlue] = grid.background;
    packed.fill(background);
    for (let y = 0; y < grid.rows; y++) {
      const top = yEdges[y];
      const cellHeight = yEdges[y + 1] - top;
      for (let x = 0; x < grid.columns; x++) {
        const cell = y * grid.columns + x;
        const glyph = grid.glyphs.charCodeAt(cell) - FIRST_GLYPH;
        if (!glyph) continue;
        const left = xEdges[x];
        const cellWidth = xEdges[x + 1] - left;
        const mask = masks.get(cellHeight * (width + 1) + cellWidth);
        if (!mask) continue;

        const red = grid.colors[cell * 3] - backgroundRed;
        const green = grid.colors[cell * 3 + 1] - backgroundGreen;
        const blue = grid.colors[cell * 3 + 2] - backgroundBlue;
        let sample = glyph * cellWidth * cellHeight;
        for (let row = 0; row < cellHeight; row++) {
          let offset = ((top + row) * width + left) * 4;
          for (let column = 0; column < cellWidth; column++, offset += 4) {
            const opacity = mask[sample++] / 255;
            if (!opacity) continue;
            frame.data[offset] = backgroundRed + red * opacity;
            frame.data[offset + 1] = backgroundGreen + green * opacity;
            frame.data[offset + 2] = backgroundBlue + blue * opacity;
          }
        }
      }
    }
    context.putImageData(frame, 0, 0);
  };
}

// Dense video reuses glyph masks instead of issuing thousands of Canvas text draws per frame.
export function makeGridRasterizer(canvas) {
  let key;
  let paint;
  return (grid, size) => {
    const nextKey = [grid.columns, grid.rows, size.width, size.height, ...grid.background].join("/");
    if (key !== nextKey || canvas.width !== size.width || canvas.height !== size.height) {
      paint = prepareRaster(canvas.getContext("2d"), grid, size);
      key = nextKey;
    }
    paint(grid);
  };
}

import { Capacitor, registerPlugin } from "@capacitor/core";

const androidExport = registerPlugin("ImageExport");
const maximumInputBytes = 32 * 1024 * 1024;
const maximumFrameSide = 1200;
export const glyphWidth = 10;
export const glyphHeight = 18;

export async function decodeImage(file) {
  if (file.size > maximumInputBytes) throw new Error("Choose an image smaller than 32 MB.");
  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("This image could not be opened. Try PNG, JPEG or WebP.");
    }

    const scale = Math.min(1, maximumFrameSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return {
      name: file.name,
      width: image.naturalWidth,
      height: image.naturalHeight,
      frame: context.getImageData(0, 0, canvas.width, canvas.height),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function drawGrid(canvas, grid) {
  const width = grid.columns * glyphWidth;
  const height = grid.rows * glyphHeight;
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "rgb(" + grid.background.join(",") + ")";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = "16px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (let index = 0; index < grid.glyphs.length; index++) {
    const glyph = grid.glyphs[index];
    if (glyph === " ") continue;
    const color = index * 3;
    context.fillStyle = "rgb(" + grid.colors[color] + "," + grid.colors[color + 1] + "," + grid.colors[color + 2] + ")";
    const x = (index % grid.columns + 0.5) * glyphWidth;
    const y = (Math.floor(index / grid.columns) + 0.5) * glyphHeight;
    context.fillText(glyph, x, y, glyphWidth);
  }
}

function makePng(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNG export failed. Try a lower symbol density."));
    }, "image/png");
  });
}

function readDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read the exported PNG."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function exportPng(canvas, sourceName) {
  return saveMedia(await makePng(canvas), sourceName, "png");
}

export async function saveMedia(blob, sourceName, extension) {
  const basename = sourceName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 64);
  const name = (basename || "ascii") + "-ascii." + extension;

  if (Capacitor.getPlatform() === "android") {
    const dataUrl = await readDataUrl(blob);
    const options = { name, base64: dataUrl.split(",")[1] };
    return extension === "png" ? androidExport.savePng(options) : androidExport.saveVideo({
      ...options, mimeType: extension === "mp4" ? "video/mp4" : "video/webm",
    });
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return { saved: true };
}

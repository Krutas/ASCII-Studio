export type RGB = readonly [red: number, green: number, blue: number];

export interface PixelFrame {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array | Uint8ClampedArray;
  readonly channels?: 3 | 4;
}

export interface AsciiOptions {
  readonly columns?: number;
  readonly cellAspect?: number;
  readonly charset?: string;
  readonly colorMode?: "rgb" | "grayscale" | "monochrome";
  readonly background?: RGB;
  readonly foreground?: RGB;
  readonly brightness?: number;
  readonly contrast?: number;
  readonly saturation?: number;
  readonly invert?: boolean;
}

export interface AsciiGrid {
  readonly columns: number;
  readonly rows: number;
  readonly glyphs: string;
  readonly colors: Uint8Array;
  readonly background: RGB;
}

const MAX_CELLS = 1_000_000;
const DEFAULT_CHARSET = " .:-=+*#%@";
const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(name + " must be a positive safe integer");
  }
  return value;
}

function inRange(value: number, name: string, min: number, max: number): number {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(name + " is outside its supported range");
  }
  return value;
}

function color(value: RGB, name: string): RGB {
  if (!Array.isArray(value) || value.length !== 3 ||
      ![value[0], value[1], value[2]].every(
        (channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255
      )) {
    throw new RangeError(name + " must contain three RGB bytes");
  }
  return [value[0], value[1], value[2]];
}

function luma(red: number, green: number, blue: number): number {
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, value));
}

function sample(
  data: PixelFrame["data"], width: number, channels: 3 | 4,
  left: number, top: number, right: number, bottom: number, background: RGB
): RGB {
  let red = 0;
  let green = 0;
  let blue = 0;

  for (let y = top; y < bottom; y++) {
    let offset = (y * width + left) * channels;
    for (let x = left; x < right; x++, offset += channels) {
      const alpha = channels === 4 ? data[offset + 3] / 255 : 1;
      red += data[offset] * alpha + background[0] * (1 - alpha);
      green += data[offset + 1] * alpha + background[1] * (1 - alpha);
      blue += data[offset + 2] * alpha + background[2] * (1 - alpha);
    }
  }

  const area = (right - left) * (bottom - top);
  return [red / area, green / area, blue / area];
}

/** Converts decoded pixels to a row-major ASCII grid. */
export function convertToAscii(frame: PixelFrame, options: AsciiOptions = {}): AsciiGrid {
  const width = positiveInteger(frame.width, "width");
  const height = positiveInteger(frame.height, "height");
  const { data, channels = 4 } = frame;
  if (channels !== 3 && channels !== 4) {
    throw new RangeError("channels must be 3 (RGB) or 4 (RGBA)");
  }
  if (!(data instanceof Uint8Array || data instanceof Uint8ClampedArray)) {
    throw new TypeError("data must be a Uint8Array or Uint8ClampedArray");
  }
  const byteLength = width * height * channels;
  if (!Number.isSafeInteger(byteLength) || data.length !== byteLength) {
    throw new RangeError("data length must equal width × height × channels");
  }

  const columns = positiveInteger(options.columns ?? Math.min(width, 120), "columns");
  const cellAspect = inRange(options.cellAspect ?? 0.5, "cellAspect", 0.01, 100);
  const rows = Math.max(1, Math.round(height / width * columns * cellAspect));
  if (columns * rows > MAX_CELLS) {
    throw new RangeError("output exceeds 1,000,000 cells; reduce columns or cellAspect");
  }

  const charset = options.charset ?? DEFAULT_CHARSET;
  if (typeof charset !== "string" || charset.length < 2 || /[^ -~]/u.test(charset)) {
    throw new RangeError("charset must contain at least two printable ASCII characters");
  }
  const mode = options.colorMode ?? "rgb";
  if (mode !== "rgb" && mode !== "grayscale" && mode !== "monochrome") {
    throw new RangeError("invalid colorMode");
  }

  const background = color(options.background ?? BLACK, "background");
  const foreground = color(options.foreground ?? WHITE, "foreground");
  const brightness = inRange(options.brightness ?? 0, "brightness", -1, 1);
  const contrast = inRange(options.contrast ?? 1, "contrast", 0, 4);
  const saturation = inRange(options.saturation ?? 1, "saturation", 0, 4);
  const colors = new Uint8Array(columns * rows * 3);
  const lines: string[] = [];

  const adjust = (channel: number, gray: number): number => {
    const saturated = gray + (channel - gray) * saturation;
    return clampByte((saturated + brightness * 255 - 127.5) * contrast + 127.5);
  };

  for (let y = 0; y < rows; y++) {
    const top = Math.floor(y * height / rows);
    const bottom = Math.max(top + 1, Math.floor((y + 1) * height / rows));
    let line = "";

    for (let x = 0; x < columns; x++) {
      const left = Math.floor(x * width / columns);
      const right = Math.max(left + 1, Math.floor((x + 1) * width / columns));
      const [red, green, blue] = sample(data, width, channels, left, top, right, bottom, background);
      const gray = luma(red, green, blue);
      const r = adjust(red, gray);
      const g = adjust(green, gray);
      const b = adjust(blue, gray);
      const intensity = luma(r, g, b);
      const density = options.invert ? 255 - intensity : intensity;
      line += charset[Math.round(density / 255 * (charset.length - 1))];

      const offset = (y * columns + x) * 3;
      if (mode === "monochrome") {
        colors.set(foreground, offset);
      } else if (mode === "grayscale") {
        colors.fill(Math.round(intensity), offset, offset + 3);
      } else {
        colors[offset] = Math.round(r);
        colors[offset + 1] = Math.round(g);
        colors[offset + 2] = Math.round(b);
      }
    }
    lines.push(line);
  }

  return { columns, rows, glyphs: lines.join(""), colors, background };
}

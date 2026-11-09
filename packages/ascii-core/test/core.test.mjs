import assert from "node:assert/strict";
import { test } from "node:test";
import * as core from "ascii-studio-core";

const blackToWhite = Uint8Array.of(0, 0, 0, 255, 255, 255, 255, 255);
const frame = { width: 2, height: 1, data: blackToWhite };

test("maps dark and bright pixels to symbols with matching RGB colors", () => {
  assert.equal(typeof core.convertToAscii, "function");
  const result = core.convertToAscii(frame, { columns: 2, charset: " #" });
  assert.equal(result.columns, 2);
  assert.equal(result.rows, 1);
  assert.equal(result.glyphs, " #");
  assert.deepEqual([...result.colors], [0, 0, 0, 255, 255, 255]);
});

test("preserves image proportions with rectangular character cells", () => {
  const image = { width: 4, height: 4, data: new Uint8Array(4 * 4 * 4).fill(255) };
  const result = core.convertToAscii(image, { columns: 4, charset: " #" });
  assert.equal(result.rows, 2);
  assert.equal(result.glyphs, "########");
});

test("averages source pixels when reducing the grid", () => {
  const result = core.convertToAscii(frame, { columns: 1, charset: " .#" });
  assert.equal(result.glyphs, ".");
  assert.deepEqual([...result.colors], [128, 128, 128]);
});

test("composites transparent RGBA over the chosen background", () => {
  const image = { width: 1, height: 1, data: Uint8ClampedArray.of(255, 0, 0, 0) };
  const result = core.convertToAscii(image, { background: [0, 0, 255] });
  assert.deepEqual([...result.colors], [0, 0, 255]);
  assert.deepEqual(result.background, [0, 0, 255]);
});

test("reads RGB and supports grayscale and monochrome palettes", () => {
  const image = { width: 1, height: 1, channels: 3, data: Uint8Array.of(255, 0, 0) };
  assert.deepEqual([...core.convertToAscii(image, { colorMode: "grayscale" }).colors], [54, 54, 54]);
  assert.deepEqual([...core.convertToAscii(image, {
    colorMode: "monochrome", foreground: [1, 2, 3]
  }).colors], [1, 2, 3]);
});

test("adjusts color and glyph density before rendering", () => {
  const image = { width: 1, height: 1, data: Uint8Array.of(128, 0, 0, 255) };
  const options = { charset: " #", saturation: 0, brightness: 0.5, contrast: 2 };
  const result = core.convertToAscii(image, options);
  assert.equal(result.glyphs, "#");
  assert.deepEqual([...result.colors], [182, 182, 182]);
  assert.equal(core.convertToAscii(image, { ...options, invert: true }).glyphs, " ");
});

test("rejects malformed frames and invalid or oversized output settings", () => {
  assert.throws(() => core.convertToAscii({ ...frame, width: 0 }), /width/);
  assert.throws(() => core.convertToAscii({ ...frame, width: 3 }), /length/);
  assert.throws(() => core.convertToAscii(frame, { charset: "█" }), /charset/);
  assert.throws(() => core.convertToAscii(frame, { columns: 10_000 }), /cells/);
});

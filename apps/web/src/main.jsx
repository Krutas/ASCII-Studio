import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { convertToAscii } from "ascii-studio-core";
import { decodeImage, drawGrid, exportPng, getGridCanvasSize, glyphHeight, glyphWidth,
  MAX_IMAGE_LONG_SIDE, MAX_IMAGE_SHORT_SIDE } from "./media.js";
import { makeSample } from "./sample.js";
import { VideoStudio } from "./VideoStudio.jsx";
import appIcon from "./ascii-studio-icon.png";
import "./style.css";

import { Adjustments, initialSettings, palettes, PanelTitle, Presets } from "./controls.jsx";

function App() {
  const [sample] = useState(makeSample);
  const [mode, setMode] = useState("image");
  const backdrop = useRef(null);

  useEffect(() => {
    const grid = convertToAscii(sample.frame, {
      columns: 150, cellAspect: glyphWidth / glyphHeight,
      brightness: 0.12, saturation: 1.6, background: [7, 10, 20],
    });
    drawGrid(backdrop.current, grid);
  }, [sample]);

  return (
    <div className="studio">
      <div className="backdrop" aria-hidden="true"><canvas ref={backdrop} /></div>
      <header className="topbar">
        <div className="brand"><img className="brand-icon" src={appIcon} alt="" />
          <div><strong>ASCII Studio</strong><small>MEDIA CONVERTER</small></div>
        </div>
        <nav className="mode-switch" aria-label="Conversion mode">
          <button type="button" aria-pressed={mode === "image"} onClick={() => setMode("image")}>Image</button>
          <button type="button" aria-pressed={mode === "video"} onClick={() => setMode("video")}>Video</button>
        </nav>
        <span className="local"><i /> LOCAL PROCESSING</span>
      </header>
      <div hidden={mode !== "image"}><ImageStudio sample={sample} /></div>
      {mode === "video" && <VideoStudio />}
    </div>
  );
}

const MAX_IMAGE_ROWS = 950;

function ImageStudio({ sample }) {
  const [source, setSource] = useState(sample);
  const [settings, setSettings] = useState(initialSettings);
  const [previewSettings, setPreviewSettings] = useState(initialSettings);
  const [previewResolution, setPreviewResolution] = useState(null);
  const [preset, setPreset] = useState("Cosmic");
  const [status, setStatus] = useState({ text: "", error: false });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [customResolution, setCustomResolution] = useState(false);
  const [resolution, setResolution] = useState(null);
  const selection = useRef(0);
  const dragDepth = useRef(0);
  const preview = useRef(null);

  const cellAspect = glyphWidth / glyphHeight;
  const frame = useMemo(() => padExtremePortrait(source.frame), [source]);
  const grid = useMemo(() => {
    const { density, ...options } = previewSettings;
    const fitColumns = Math.floor(MAX_IMAGE_ROWS * frame.width / frame.height / cellAspect);
    const columns = Math.max(1, Math.min(density, fitColumns));
    return convertToAscii(frame, { ...options, columns, cellAspect, background: [7, 10, 20] });
  }, [frame, previewSettings, cellAspect]);

  const automaticSize = getGridCanvasSize(grid, MAX_IMAGE_LONG_SIDE,
    MAX_IMAGE_LONG_SIDE * MAX_IMAGE_SHORT_SIDE, MAX_IMAGE_SHORT_SIDE);
  const dimensions = resolution ?? automaticSize;
  const widthLimit = Number(dimensions.height) > MAX_IMAGE_SHORT_SIDE ? MAX_IMAGE_SHORT_SIDE : MAX_IMAGE_LONG_SIDE;
  const heightLimit = Number(dimensions.width) > MAX_IMAGE_SHORT_SIDE ? MAX_IMAGE_SHORT_SIDE : MAX_IMAGE_LONG_SIDE;
  const resolutionValid = validDimension(dimensions.width, widthLimit) && validDimension(dimensions.height, heightLimit);
  const contain = previewResolution !== null;
  const width = previewResolution?.width ?? automaticSize.width;
  const height = previewResolution?.height ?? automaticSize.height;
  const settingsChanged = Object.keys(settings).some((key) => settings[key] !== previewSettings[key]);
  const resolutionChanged = customResolution
    ? Number(dimensions.width) !== previewResolution?.width || Number(dimensions.height) !== previewResolution?.height
    : contain;
  const previewPending = settingsChanged || resolutionChanged;

  useEffect(() => {
    drawGrid(preview.current, grid, { width, height, contain });
  }, [grid, width, height, contain]);

  function update(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
    if (key !== "density") setPreset(null);
  }

  function applyPreset(name) {
    setPreset(name);
    setSettings((current) => ({ ...current, ...palettes[name], invert: false }));
  }

  function updatePreview() {
    if (settingsChanged) setPreviewSettings(settings);
    if (resolutionChanged) {
      setPreviewResolution(customResolution
        ? { width: Number(dimensions.width), height: Number(dimensions.height) }
        : null);
    }
  }

  function restoreSample() {
    selection.current++;
    setLoading(false);
    setSource(sample);
    setStatus({ text: "", error: false });
  }

  async function selectImage(file) {
    if (!file) return;
    const id = ++selection.current;
    setLoading(true);
    setStatus({ text: "Opening image…", error: false });

    try {
      const image = await decodeImage(file);
      if (selection.current !== id) return;
      setSource(image);
      setStatus({ text: "Image ready to convert.", error: false });
    } catch (error) {
      if (selection.current === id) setStatus({ text: error.message, error: true });
    } finally {
      if (selection.current === id) setLoading(false);
    }
  }

  async function saveImage() {
    const id = selection.current;
    setSaving(true);
    try {
      const result = await exportPng(preview.current, source.name);
      if (selection.current === id) {
        setStatus({ text: result.saved ? "PNG export ready." : "Export canceled.", error: false });
      }
    } catch (error) {
      if (selection.current === id) setStatus({ text: error.message || "Could not save the PNG.", error: true });
    } finally {
      setSaving(false);
    }
  }

  return (
      <main>
        <div className="intro">
          <p className="eyebrow">SIGNAL / 01</p>
          <h1>Turn pixels into text.</h1>
          <p>Convert an image into ASCII art. Tune every symbol and export the result.</p>
        </div>
        <div className="workspace">
          <aside className="panel source">
            <PanelTitle number="01">Source image</PanelTitle>
            <label className={"drop" + (dragOver ? " active" : "")}
              onDragEnter={(event) => { event.preventDefault(); dragDepth.current++; setDragOver(true); }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => { if (--dragDepth.current <= 0) { dragDepth.current = 0; setDragOver(false); } }}
              onDrop={(event) => {
                event.preventDefault();
                dragDepth.current = 0;
                setDragOver(false);
                selectImage(event.dataTransfer.files[0]);
              }}>
              <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose an image" onChange={(event) => {
                selectImage(event.target.files[0]);
                event.target.value = "";
              }} />
              <span className="upload-icon" aria-hidden="true">↑</span>
              <strong>Choose an image</strong>
              <small>PNG, JPEG, WebP · up to 32 MB</small>
            </label>
            <div className="source-file">
              <span className="file-icon" aria-hidden="true">▧</span>
              <div><strong title={source.name}>{source.name}</strong><small>{source.width} × {source.height} px</small></div>
            </div>
            <button type="button" className="quiet" onClick={restoreSample} disabled={source === sample && !loading && !status.error}>Use sample image</button>
            <div className="separator" />
            <PanelTitle number="02">Style presets</PanelTitle>
            <Presets preset={preset} applyPreset={applyPreset} />
          </aside>
          <section className="panel preview" aria-label="ASCII preview">
            <div className="preview-header"><PanelTitle number="03">ASCII preview</PanelTitle><span>{grid.columns} × {grid.rows} CELLS</span></div>
            <div className="preview-stage image-preview-stage">
              <canvas ref={preview} role="img" aria-label={"ASCII conversion of " + source.name} />
              {previewPending && <div className="preview-overlay">
                <button type="button" className="export" onClick={updatePreview}
                  disabled={loading || saving || (customResolution && !resolutionValid)}>Preview</button>
              </div>}
            </div>
            <div className="preview-footer"><span aria-live="polite">{previewPending ? "Changes pending" : "Preview ready"}</span><span>PNG / {width} × {height}</span></div>
          </section>
          <aside className="panel settings">
            <PanelTitle number="04">Adjust</PanelTitle>
            <Adjustments settings={settings} update={update} reset={() => { setSettings(initialSettings); setPreset("Cosmic"); }} />
          </aside>
          <footer className="panel actions">
            <p role="status" className={status.error ? "error" : ""}>{status.text || "Your images stay on this device."}</p>
            <div className="image-export">
              <label className="format-label">PNG resolution
                <select value={customResolution ? "custom" : "auto"} onChange={(event) => {
                  if (!resolution) setResolution(automaticSize);
                  setCustomResolution(event.target.value === "custom");
                }}>
                  <option value="auto">Auto</option>
                  <option value="custom">Custom</option>
                </select>
              </label>
              {customResolution && <div className="image-dimensions">
                {[["width", "Width", widthLimit], ["height", "Height", heightLimit]].map(([key, label, limit]) => (
                  <label key={key}>{label}
                    <input type="number" min="1" max={limit} step="1" required
                      value={dimensions[key]} aria-invalid={!validDimension(dimensions[key], limit)}
                      onChange={(event) => setResolution({ ...dimensions, [key]: event.target.value })} />
                  </label>
                ))}
              </div>}
              <button type="button" className="export" onClick={saveImage}
                disabled={saving || loading || previewPending}>
                <span aria-hidden="true">↓</span> {saving ? "Exporting…" : "Export PNG"}
              </button>
              {customResolution && !resolutionValid &&
                <p className="error" role="status">Enter whole pixel dimensions within 3840 × 2160 or 2160 × 3840.</p>}
            </div>
          </footer>
        </div>
      </main>
  );
}

function validDimension(value, limit) {
  const dimension = Number(value);
  return Number.isInteger(dimension) && dimension >= 1 && dimension <= limit;
}

function padExtremePortrait(frame) {
  const width = Math.ceil(frame.height * (glyphWidth / glyphHeight) / MAX_IMAGE_ROWS);
  if (width <= frame.width) return frame;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  context.putImageData(frame, Math.floor((width - frame.width) / 2), 0);
  return context.getImageData(0, 0, width, frame.height);
}

createRoot(document.getElementById("root")).render(<App />);

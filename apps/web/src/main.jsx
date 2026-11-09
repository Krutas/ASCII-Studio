import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { convertToAscii } from "ascii-studio-core";
import { decodeImage, drawGrid, exportPng, glyphHeight, glyphWidth } from "./media.js";
import { makeSample } from "./sample.js";
import { VideoStudio } from "./VideoStudio.jsx";
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
        <div className="brand"><span className="brand-icon" aria-hidden="true">A<span>_</span></span>
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

function ImageStudio({ sample }) {
  const [source, setSource] = useState(sample);
  const [settings, setSettings] = useState(initialSettings);
  const [preset, setPreset] = useState("Cosmic");
  const [status, setStatus] = useState({ text: "", error: false });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const selection = useRef(0);
  const dragDepth = useRef(0);
  const preview = useRef(null);

  const cellAspect = glyphWidth / glyphHeight;
  const frame = useMemo(() => padExtremePortrait(source.frame), [source]);
  const grid = useMemo(() => {
    const { density, ...options } = settings;
    const fitColumns = Math.floor(190 * frame.width / frame.height / cellAspect);
    const columns = Math.max(1, Math.min(density, fitColumns));
    return convertToAscii(frame, { ...options, columns, cellAspect, background: [7, 10, 20] });
  }, [frame, settings, cellAspect]);

  useEffect(() => {
    drawGrid(preview.current, grid);
  }, [grid]);

  function update(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
    if (key !== "density") setPreset(null);
  }

  function applyPreset(name) {
    setPreset(name);
    setSettings((current) => ({ ...current, ...palettes[name], invert: false }));
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
            <div className="preview-stage">
              <canvas ref={preview} role="img" aria-label={"ASCII conversion of " + source.name} />
            </div>
            <div className="preview-footer"><span>● LIVE PREVIEW</span><span>PNG / {grid.columns * glyphWidth} × {grid.rows * glyphHeight}</span></div>
          </section>
          <aside className="panel settings">
            <PanelTitle number="04">Adjust</PanelTitle>
            <Adjustments settings={settings} update={update} reset={() => { setSettings(initialSettings); setPreset("Cosmic"); }} />
          </aside>
          <footer className="panel actions">
            <p role="status" className={status.error ? "error" : ""}>{status.text || "Your images stay on this device."}</p>
            <button type="button" className="export" onClick={saveImage} disabled={saving || loading}>
              <span aria-hidden="true">↓</span> {saving ? "Exporting…" : "Export PNG"}
            </button>
          </footer>
        </div>
      </main>
  );
}

function padExtremePortrait(frame) {
  const width = Math.ceil(frame.height * (glyphWidth / glyphHeight) / 190);
  if (width <= frame.width) return frame;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = frame.height;
  const context = canvas.getContext("2d");
  context.putImageData(frame, Math.floor((width - frame.width) / 2), 0);
  return context.getImageData(0, 0, width, frame.height);
}

createRoot(document.getElementById("root")).render(<App />);

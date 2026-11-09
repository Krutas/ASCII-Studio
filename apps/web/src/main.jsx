import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { convertToAscii } from "ascii-studio-core";
import { decodeImage, drawGrid, exportPng, glyphHeight, glyphWidth } from "./media.js";
import { makeSample } from "./sample.js";
import "./style.css";

const palettes = {
  Cosmic: { charset: " .:-=+*#%@", colorMode: "rgb", brightness: 0.08, contrast: 1.15, saturation: 1.3, foreground: [224, 236, 255] },
  Classic: { charset: " .:-=+*#%@", colorMode: "grayscale", brightness: 0, contrast: 1, saturation: 1, foreground: [224, 236, 255] },
  Matrix: { charset: " .:01xX#@", colorMode: "monochrome", brightness: 0, contrast: 1.2, saturation: 1, foreground: [92, 255, 163] },
  Retro: { charset: " .:*oO#@", colorMode: "monochrome", brightness: 0.05, contrast: 1.1, saturation: 1, foreground: [255, 192, 106] },
};

const initialSettings = { ...palettes.Cosmic, density: 100, invert: false };
const modes = [["rgb", "Color"], ["grayscale", "Gray"], ["monochrome", "Mono"]];
const sliders = [
  { key: "density", label: "Symbol density", min: 24, max: 160, step: 1 },
  { key: "brightness", label: "Brightness", min: -0.4, max: 0.4, step: 0.02 },
  { key: "contrast", label: "Contrast", min: 0.5, max: 2, step: 0.05 },
  { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.05 },
];

function PanelTitle({ number, children }) {
  return <h2><span>{number}</span>{children}</h2>;
}

function App() {
  const [sample] = useState(makeSample);
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
  const backdrop = useRef(null);

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

  useEffect(() => {
    const grid = convertToAscii(sample.frame, {
      columns: 150, cellAspect: glyphWidth / glyphHeight,
      brightness: 0.12, saturation: 1.6, background: [7, 10, 20],
    });
    drawGrid(backdrop.current, grid);
  }, [sample]);

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
    <div className="studio">
      <div className="backdrop" aria-hidden="true"><canvas ref={backdrop} /></div>
      <header className="topbar">
        <div className="brand"><span className="brand-icon" aria-hidden="true">A<span>_</span></span>
          <div><strong>ASCII Studio</strong><small>IMAGE CONVERTER</small></div>
        </div>
        <span className="local"><i /> LOCAL PROCESSING</span>
      </header>
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
            <div className="presets">
              {Object.keys(palettes).map((name, index) => (
                <button type="button" key={name} aria-pressed={preset === name} onClick={() => applyPreset(name)}>
                  <span aria-hidden="true">{["✦", "#", "01", "▥"][index]}</span>{name}
                </button>
              ))}
            </div>
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
            <div className="segmented" role="group" aria-label="Color mode">
              {modes.map(([value, label]) => <button type="button" key={value} aria-pressed={settings.colorMode === value}
                onClick={() => update("colorMode", value)}>{label}</button>)}
            </div>
            {sliders.map(({ key, label, min, max, step }) => (
              <label key={key} className="slider">
                <span>{label}<output>{key === "density" ? settings[key] : settings[key].toFixed(2)}</output></span>
                <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(event) => update(key, Number(event.target.value))} />
              </label>
            ))}
            <label className="check"><input type="checkbox" checked={settings.invert} onChange={(event) => update("invert", event.target.checked)} /> Invert symbols</label>
            <button type="button" className="quiet" onClick={() => { setSettings(initialSettings); setPreset("Cosmic"); }}>Reset settings</button>
          </aside>
          <footer className="panel actions">
            <p role="status" className={status.error ? "error" : ""}>{status.text || "Your images stay on this device."}</p>
            <button type="button" className="export" onClick={saveImage} disabled={saving || loading}>
              <span aria-hidden="true">↓</span> {saving ? "Exporting…" : "Export PNG"}
            </button>
          </footer>
        </div>
      </main>
    </div>
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

import React from "react";

export const palettes = {
  Cosmic: { charset: " .:-=+*#%@", colorMode: "rgb", brightness: 0.08, contrast: 1.15, saturation: 1.3, foreground: [224, 236, 255] },
  Classic: { charset: " .:-=+*#%@", colorMode: "grayscale", brightness: 0, contrast: 1, saturation: 1, foreground: [224, 236, 255] },
  Matrix: { charset: " .:01xX#@", colorMode: "monochrome", brightness: 0, contrast: 1.2, saturation: 1, foreground: [92, 255, 163] },
  Retro: { charset: " .:*oO#@", colorMode: "monochrome", brightness: 0.05, contrast: 1.1, saturation: 1, foreground: [255, 192, 106] },
};

export const initialSettings = { ...palettes.Cosmic, density: 100, invert: false };
const modes = [["rgb", "Color"], ["grayscale", "Gray"], ["monochrome", "Mono"]];
const sliders = [
  { key: "density", label: "Symbol density", min: 24, max: 160, step: 1 },
  { key: "brightness", label: "Brightness", min: -0.4, max: 0.4, step: 0.02 },
  { key: "contrast", label: "Contrast", min: 0.5, max: 2, step: 0.05 },
  { key: "saturation", label: "Saturation", min: 0, max: 2, step: 0.05 },
];

export function PanelTitle({ number, children }) {
  return <h2><span>{number}</span>{children}</h2>;
}

export function Presets({ preset, applyPreset }) {
  return (
            <div className="presets">
              {Object.keys(palettes).map((name, index) => (
                <button type="button" key={name} aria-pressed={preset === name} onClick={() => applyPreset(name)}>
                  <span aria-hidden="true">{["✦", "#", "01", "▥"][index]}</span>{name}
                </button>
              ))}
            </div>
  );
}

export function Adjustments({ settings, update, reset, maxDensity = 160 }) {
  return (
    <>
            <div className="segmented" role="group" aria-label="Color mode">
              {modes.map(([value, label]) => <button type="button" key={value} aria-pressed={settings.colorMode === value}
                onClick={() => update("colorMode", value)}>{label}</button>)}
            </div>
            {sliders.map(({ key, label, min, max, step }) => (
              <label key={key} className="slider">
                <span>{label}<output>{key === "density" ? settings[key] : settings[key].toFixed(2)}</output></span>
                <input type="range" min={min} max={key === "density" ? maxDensity : max} step={step} value={settings[key]} onChange={(event) => update(key, Number(event.target.value))} />
              </label>
            ))}
            <label className="check"><input type="checkbox" checked={settings.invert} onChange={(event) => update("invert", event.target.checked)} /> Invert symbols</label>
            <button type="button" className="quiet" onClick={reset}>Reset settings</button>
    </>
  );
}

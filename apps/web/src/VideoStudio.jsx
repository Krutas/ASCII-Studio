import React, { useEffect, useRef, useState } from "react";
import { Adjustments, initialSettings, palettes, PanelTitle, Presets } from "./controls.jsx";
import { saveMedia } from "./media.js";
import demoUrl from "./video-demo.mp4?url";
import {
  makeFrameRenderer, MAX_VIDEO_BYTES, MAX_VIDEO_DENSITY, recordAsciiVideo,
  supportedVideoFormats, videoDecoderError, videoMetadata,
} from "./video.js";

const defaults = { ...initialSettings, density: 84 };
const demo = { url: demoUrl, name: "Orbit demo.mp4" };
const clock = (seconds) => {
  const whole = Math.floor(seconds || 0);
  return Math.floor(whole / 60) + ":" + String(whole % 60).padStart(2, "0");
};

export function VideoStudio() {
  const [clip, setClip] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [settings, setSettings] = useState(defaults);
  const [preset, setPreset] = useState("Cosmic");
  const [formats] = useState(supportedVideoFormats);
  const [extension, setExtension] = useState(formats[0]?.extension ?? "");
  const [progress, setProgress] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const decoder = useRef(null);
  const preview = useRef(null);
  const renderer = useRef(null);
  const activeExport = useRef(null);
  const busy = progress !== null || saving;
  const format = formats.find((item) => item.extension === extension);

  useEffect(() => {
    renderer.current = makeFrameRenderer(preview.current);
    return () => {
      activeExport.current?.abort();
      activeExport.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (clip?.objectUrl) URL.revokeObjectURL(clip.url);
    };
  }, [clip]);

  useEffect(() => {
    const video = decoder.current;
    if (!metadata || !video) return;
    let previousTime = -1;
    let request;

    function draw() {
      const now = video.currentTime;
      if (video.readyState >= 2 && (previousTime < 0 || now - previousTime >= 1 / 15 || now < previousTime)) {
        renderer.current(video, settings);
        previousTime = now;
      }
      if (playing) request = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(request);
  }, [clip, metadata, playing, settings]);

  function changeSource(next) {
    decoder.current?.pause();
    setMetadata(null);
    setPlaying(false);
    setTime(0);
    setStatus(null);
    setClip(next);
  }

  function selectFile(file) {
    if (!file || busy) return;
    if (file.size > MAX_VIDEO_BYTES) {
      setStatus({ error: true, text: "Choose a video smaller than 100 MB." });
      return;
    }
    changeSource({ url: URL.createObjectURL(file), objectUrl: true, name: file.name });
  }

  function ready(event) {
    try {
      setMetadata(videoMetadata(event.currentTarget));
      setStatus(null);
    } catch (error) {
      changeSource(null);
      setStatus({ error: true, text: error.message });
    }
  }

  function failDecode(event) {
    const error = videoDecoderError(event.currentTarget);
    changeSource(null);
    setStatus({ error: true, text: error.message });
  }

  function togglePlay() {
    const video = decoder.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => setStatus({ error: true, text: "The clip could not play." }));
    } else {
      video.pause();
    }
  }

  function update(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
    if (key !== "density") setPreset(null);
  }

  function applyPreset(name) {
    setPreset(name);
    setSettings((current) => ({ ...current, ...palettes[name], invert: false }));
  }

  async function exportVideo() {
    if (!clip || !metadata || !format || activeExport.current) return;
    const controller = new AbortController();
    activeExport.current = controller;
    decoder.current?.pause();
    setStatus(null);
    setProgress(0);

    try {
      const result = await recordAsciiVideo({
        url: clip.url, settings, format, signal: controller.signal, onProgress: setProgress,
      });
      controller.signal.throwIfAborted();
      setProgress(null);
      setSaving(true);
      const saved = await saveMedia(result, clip.name, format.extension);
      if (activeExport.current === controller) {
        setStatus({ error: false, text: saved.saved ? "Video export ready." : "Save canceled." });
      }
    } catch (error) {
      if (activeExport.current === controller) {
        setStatus(controller.signal.aborted
          ? { error: false, text: "Export canceled." }
          : { error: true, text: error.message || "Could not export the clip." });
      }
    } finally {
      if (activeExport.current === controller) {
        activeExport.current = null;
        setProgress(null);
        setSaving(false);
      }
    }
  }

  return (
    <main>
      <div className="intro">
        <p className="eyebrow">SIGNAL / 02</p>
        <h1>Turn motion into text.</h1>
        <p>Convert a short clip into ASCII art and export it as a silent video.</p>
      </div>
      <div className="workspace video-workspace">
        <aside className="panel source">
          <PanelTitle number="01">Source video</PanelTitle>
          <label className="drop" onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
            event.preventDefault();
            selectFile(event.dataTransfer.files[0]);
          }}>
            <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
              aria-label="Choose a video" disabled={busy} onChange={(event) => {
                selectFile(event.target.files[0]);
                event.target.value = "";
              }} />
            <span className="upload-icon" aria-hidden="true">↑</span>
            <strong>Choose a video</strong>
            <small>Up to 30 seconds · 100 MB</small>
          </label>
          {clip && <div className="source-file">
            <span className="file-icon" aria-hidden="true">▷</span>
            <div><strong title={clip.name}>{clip.name}</strong>
              <small>{metadata ? metadata.width + " × " + metadata.height + " · " + clock(metadata.duration) : "Opening clip…"}</small>
            </div>
          </div>}
          <button type="button" className="quiet" disabled={busy || clip === demo}
            onClick={() => changeSource(demo)}>Use demo clip</button>
          <div className="separator" />
          <PanelTitle number="02">Style presets</PanelTitle>
          <Presets preset={preset} applyPreset={applyPreset} />
        </aside>
        <section className="panel preview" aria-label="ASCII video preview">
          <div className="preview-header"><PanelTitle number="03">ASCII preview</PanelTitle><span>VIDEO / MUTED</span></div>
          <div className="preview-stage video-stage">
            <canvas ref={preview} role="img" aria-label="ASCII video frame" hidden={!metadata} />
            {!metadata && <p className="empty-clip">{clip ? "Decoding the first frame…" : "Choose a clip or try the demo."}</p>}
            {clip && <video className="video-decoder" key={clip.url} ref={decoder} src={clip.url}
              muted playsInline preload="auto" aria-hidden="true" tabIndex={-1}
              onLoadedData={ready} onError={failDecode}
              onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
              onSeeked={(event) => {
                if (metadata && event.currentTarget.readyState >= 2) renderer.current(event.currentTarget, settings);
              }}
              onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />}
          </div>
          <div className="video-transport">
            <button type="button" onClick={togglePlay} disabled={!metadata || busy}>{playing ? "Pause" : "Play"}</button>
            <input aria-label="Video position" type="range" min="0" max={metadata?.duration ?? 1} step="0.01"
              value={time} disabled={!metadata || busy} onChange={(event) => {
                const next = Number(event.target.value);
                setTime(next);
                decoder.current.currentTime = next;
              }} />
            <span>{clock(time)} / {clock(metadata?.duration)}</span>
          </div>
        </section>
        <aside className="panel settings">
          <PanelTitle number="04">Adjust</PanelTitle>
          <Adjustments settings={settings} update={update} maxDensity={MAX_VIDEO_DENSITY}
            reset={() => { setSettings(defaults); setPreset("Cosmic"); }} />
        </aside>
        <footer className="panel actions video-actions">
          <div>
            <p role="status" className={status?.error ? "error" : ""}>
              {status?.text || (progress !== null ? "Exporting video… " + Math.round(progress * 100) + "%"
                : saving ? "Saving video…" : formats.length ? "Export uses the settings selected when it starts. Audio is omitted."
                  : "Video preview works here. This browser or WebView cannot export video.")}
            </p>
            {progress !== null && <progress max="1" value={progress} aria-label="Video export progress" />}
          </div>
          <div className="video-buttons">
            {format && <label className="format-label">Format
              <select value={extension} disabled={busy} onChange={(event) => setExtension(event.target.value)}>
                {formats.map(({ extension }) => <option key={extension} value={extension}>{extension.toUpperCase()}</option>)}
              </select>
            </label>}
            {progress !== null
              ? <button type="button" className="export" onClick={() => activeExport.current?.abort()}>Cancel export</button>
              : <button type="button" className="export" disabled={!metadata || !format || saving}
                onClick={exportVideo}>↓ {saving ? "Saving…" : "Export video"}</button>}
          </div>
        </footer>
      </div>
    </main>
  );
}

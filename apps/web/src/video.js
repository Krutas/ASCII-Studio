import { convertToAscii } from "ascii-studio-core";
import { makeGridRasterizer } from "./gridRaster.js";
import { drawGrid, getGridCanvasSize, glyphWidth, glyphHeight } from "./media.js";

export const MAX_VIDEO_SECONDS = 30;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_VIDEO_DENSITY = 600;
const MAX_VIDEO_ROWS = 400;
const MAX_EXPORT_BYTES = 16 * 1024 * 1024;
const EXPORT_FPS = 24;
const FORMATS = [
  {
    extension: "mp4",
    mimeTypes: ["video/mp4;codecs=avc1.42002a", "video/mp4", "video/mp4;codecs=avc1.42001f"],
    withAudio: ['video/mp4;codecs="avc1.42002a,mp4a.40.2"', "video/mp4"],
  },
  {
    extension: "webm",
    mimeTypes: ["video/webm;codecs=vp8", "video/webm"],
    withAudio: ['video/webm;codecs="vp8,opus"', "video/webm"],
  },
];

export function supportedVideoFormats(includeAudio = false) {
  if (includeAudio && typeof globalThis.AudioContext !== "function") return [];
  if (typeof globalThis.MediaRecorder?.isTypeSupported !== "function" ||
      typeof HTMLCanvasElement.prototype.captureStream !== "function") return [];

  return FORMATS.flatMap(({ extension, mimeTypes, withAudio }) => {
    const candidates = includeAudio ? withAudio : mimeTypes;
    const mimeType = candidates.find((type) => MediaRecorder.isTypeSupported(type));
    return mimeType ? [{ extension, mimeType }] : [];
  });
}

export function videoMetadata(video) {
  if (!video.videoWidth || !video.videoHeight || !Number.isFinite(video.duration) || video.duration <= 0) {
    throw new Error("Choose a video with a known duration and a playable picture.");
  }
  if (video.duration > MAX_VIDEO_SECONDS) {
    throw new Error("Choose a video that is 30 seconds or shorter.");
  }
  return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
}

export function videoDecoderError(video) {
  return new Error(video.error?.code === 3
    ? "The video could not be decoded. Try a different file."
    : "This device cannot open the clip. Try an MP4 or WebM with a supported codec.");
}

export function getVideoGridSize({ width, height }, density) {
  const rowRatio = height / width * glyphWidth / glyphHeight;
  const columns = Math.max(1, Math.min(density, Math.floor(MAX_VIDEO_ROWS / rowRatio)));
  const rows = Math.min(MAX_VIDEO_ROWS, Math.max(1, Math.round(columns * rowRatio)));
  return { columns, rows };
}

export function makeFrameRenderer(output) {
  const rasterize = makeGridRasterizer(output);
  const sample = document.createElement("canvas");
  const context = sample.getContext("2d", { willReadFrequently: true });

  return (video, settings) => {
    const { density, ...options } = settings;
    const { columns, rows } = getVideoGridSize({
      width: video.videoWidth, height: video.videoHeight,
    }, density);
    const dense = columns > 120 || rows > 80;
    const sampleScale = dense ? 1 : 3;
    const width = columns * sampleScale;
    const height = rows * sampleScale;
    if (sample.width !== width) sample.width = width;
    if (sample.height !== height) sample.height = height;
    context.drawImage(video, 0, 0, width, height);
    // The sample already follows the target character grid proportions.
    const grid = convertToAscii(context.getImageData(0, 0, width, height), {
      ...options, columns, cellAspect: 1, background: [7, 10, 20],
    });
    const size = getGridCanvasSize(grid, 1920, 1920 * 1080);
    if (dense) rasterize(grid, size);
    else drawGrid(output, grid, size);
    return grid;
  };
}

function loadFrame(video, url, signal, audioReady = Promise.resolve()) {
  return new Promise((resolve, reject) => {
    const listeners = new AbortController();
    const timeout = setTimeout(() => finish(new Error(
      video.readyState >= 2 ? "Could not start audio. Try exporting without sound." : "The first video frame did not load."
    )), 12_000);

    function finish(error) {
      listeners.abort();
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    }

    function abort() { finish(signal.reason); }

    audioReady.catch(finish);
    video.addEventListener("loadeddata", () => {
      audioReady.then(() => finish(), finish);
    }, { signal: listeners.signal });
    video.addEventListener("error", () => finish(videoDecoderError(video)), { signal: listeners.signal });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    else video.src = url;
  });
}

export async function recordAsciiVideo({ url, settings, format, includeAudio, signal, onProgress }) {
  const video = document.createElement("video");
  video.muted = !includeAudio;
  video.playsInline = true;
  video.preload = "auto";
  let stream;
  let audioContext;
  let audioTrack;

  try {
    let audioReady;
    if (includeAudio) {
      audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();
      audioTrack = destination.stream.getAudioTracks()[0];
      // Route the clip to the recorder only, so export is quiet on the device.
      audioContext.createMediaElementSource(video).connect(destination);
      audioReady = audioContext.resume();
    }
    await loadFrame(video, url, signal, audioReady);
    signal.throwIfAborted();
    const { duration } = videoMetadata(video);
    const canvas = document.createElement("canvas");
    const render = makeFrameRenderer(canvas);
    render(video, settings);
    stream = canvas.captureStream(EXPORT_FPS);
    if (audioTrack) stream.addTrack(audioTrack);
    const recorder = new MediaRecorder(stream, {
      mimeType: format.mimeType,
      videoBitsPerSecond: 1_800_000,
      audioBitsPerSecond: includeAudio ? 128_000 : undefined,
    });

    return await new Promise((resolve, reject) => {
      const listeners = new AbortController();
      const chunks = [];
      let bytes = 0;
      let frameTimer;
      let lastFrame = 0;
      let complete = false;

      const timeout = setTimeout(() => {
        fail(new Error("Video export timed out. Try a shorter clip or a lower symbol density."));
      }, 45_000);

      function cleanup() {
        listeners.abort();
        clearInterval(frameTimer);
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
      }

      function fail(error) {
        cleanup();
        if (recorder.state !== "inactive") recorder.stop();
        reject(error);
      }

      function abort() { fail(signal.reason); }

      function tick() {
        try {
          const now = video.currentTime;
          if (video.readyState >= 2 && now - lastFrame >= 1 / EXPORT_FPS - 0.005) {
            render(video, settings);
            lastFrame = now;
            onProgress(Math.min(now / duration, 0.99));
          }
        } catch (error) {
          fail(error);
        }
      }

      recorder.addEventListener("dataavailable", ({ data }) => {
        if (!data.size) return;
        bytes += data.size;
        if (bytes > MAX_EXPORT_BYTES) fail(new Error("The export is too large. Try a shorter clip."));
        else chunks.push(data);
      }, { signal: listeners.signal });
      recorder.addEventListener("error", () => {
        fail(new Error("The device could not encode this format. Try a different format or a lower density."));
      }, { signal: listeners.signal });
      recorder.addEventListener("stop", () => {
        cleanup();
        if (!complete || bytes === 0) {
          reject(new Error("The encoder stopped before a video was produced."));
          return;
        }
        const type = format.extension === "mp4" ? "video/mp4" : "video/webm";
        resolve(new Blob(chunks, { type }));
      }, { signal: listeners.signal });
      video.addEventListener("ended", () => {
        complete = true;
        clearInterval(frameTimer);
        if (recorder.state !== "inactive") recorder.stop();
      }, { signal: listeners.signal });
      video.addEventListener("error", () => fail(videoDecoderError(video)), { signal: listeners.signal });
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) fail(new Error("Keep ASCII Studio open while exporting the video."));
      }, { signal: listeners.signal });
      signal.addEventListener("abort", abort, { once: true });

      try {
        signal.throwIfAborted();
        recorder.start(250);
        stream.getVideoTracks()[0]?.requestFrame?.();
        video.play().then(() => {
          if (!listeners.signal.aborted && !complete) {
            // The recording canvas is detached, so browser animation callbacks can be throttled.
            frameTimer = setInterval(tick, 1000 / EXPORT_FPS);
          }
        }, fail);
      } catch (error) {
        fail(error);
      }
    });
  } finally {
    stream?.getVideoTracks().forEach((track) => track.stop());
    audioTrack?.stop();
    video.pause();
    if (audioContext) await audioContext.close();
    video.removeAttribute("src");
    video.load();
  }
}

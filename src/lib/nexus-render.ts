import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let engine: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

async function getEngine(onLog?: (message: string) => void) {
  if (engine) return engine;
  if (loading) return loading;
  loading = (async () => {
    const ff = new FFmpeg();
    ff.on("log", ({ message }) => onLog?.(message));
    const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
    await ff.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      workerURL: await toBlobURL(`${base}/ffmpeg-core.worker.js`, "text/javascript"),
    });
    engine = ff;
    return ff;
  })();
  try { return await loading; } finally { loading = null; }
}

export type NexusProcessOptions = {
  trimStart?: number;
  trimEnd?: number;
  speed?: number;
  volume?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  mirrorX?: boolean;
  mirrorY?: boolean;
  effect?: string;
  enhance?: boolean;
  scale?: number;
  targetFps?: number;
  interpolation?: boolean;
  durationSeconds?: number;
  compression?: "SOCIAL" | "BALANCED" | "HIGH_QUALITY";
};

export async function renderNexusVideo(file: File, options: NexusProcessOptions, onProgress?: (p:number)=>void) {
  const ff = await getEngine();
  const stamp = Date.now();
  const ext = file.name.split(".").pop() || "mp4";
  const input = `nexus-input-${stamp}.${ext}`;
  const output = `nexus-output-${stamp}.mp4`;
  ff.on("progress", ({progress}) => onProgress?.(Math.max(0, Math.min(1, progress))));
  await ff.writeFile(input, await fetchFile(file));

  const filters: string[] = [];
  const b = Number(options.brightness || 0);
  const c = Number(options.contrast || 0);
  const s = Number(options.saturation || 0);
  const h = Number(options.hue || 0);
  if (b || c || s || h) filters.push(`eq=brightness=${b / 100}:contrast=${1 + c / 100}:saturation=${1 + s / 100}:gamma=1`);
  if (h) filters.push(`hue=h=${h}`);
  if (options.mirrorX) filters.push("hflip");
  if (options.mirrorY) filters.push("vflip");

  const effect = options.effect || "NONE";
  const effectFilters: Record<string,string> = {
    GLOW: "eq=brightness=0.08:saturation=1.2,unsharp=5:5:0.35:5:5:0",
    RGB: "chromashift=cbh=3:crh=-3",
    GLITCH: "noise=alls=8:allf=t,eq=contrast=1.2",
    SHAKE: "crop=iw*0.94:ih*0.94",
    BLUR: "gblur=sigma=3",
    CHROMA: "hue=h=8:s=1.5",
    VIGNETTE: "vignette=PI/4",
    GRAIN: "noise=alls=18:allf=t+u",
    WARP: "lenscorrection=k1=0.08:k2=0.02",
    ZOOM: "scale=iw*1.06:ih*1.06,crop=iw/1.06:ih/1.06",
    FLASH: "eq=brightness=0.28:contrast=1.05",
    BLOOM: "gblur=sigma=1.4,eq=brightness=0.08:saturation=1.15",
    SCAN: "drawgrid=w=iw:h=4:t=1:c=black@0.16",
    NOISE: "noise=alls=28:allf=t+u",
    PIXEL: "scale=iw/12:ih/12:flags=neighbor,scale=iw*12:ih*12:flags=neighbor",
    EDGE: "edgedetect=low=0.1:high=0.4",
    INVERT: "negate",
    SEPIA: "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131",
    THERMAL: "hue=h=160:s=2",
    DREAM: "gblur=sigma=1.2,eq=brightness=0.06:saturation=1.35",
    TILT: "gblur=sigma=0.8"
  };
  if (effectFilters[effect]) filters.push(effectFilters[effect]);

  if (options.enhance) {
    if (options.scale && options.scale !== 100) filters.push(`scale=iw*${options.scale / 100}:ih*${options.scale / 100}:flags=lanczos`);
    filters.push("hqdn3d=0.8:0.8:4:4,unsharp=5:5:0.75:5:5:0");
  }

  const args = ["-i", input];
  const start = Math.max(0, Math.min(100, Number(options.trimStart ?? 0)));
  const end = Math.max(start + 0.1, Math.min(100, Number(options.trimEnd ?? 100)));
  if (start > 0) args.push("-ss", String(start / 100 * 3600));
  if (end < 100) args.push("-to", String(end / 100 * 3600));
  if (filters.length) args.push("-vf", filters.join(","));

  const speed = Math.max(0.25, Math.min(4, Number(options.speed || 1)));
  if (speed !== 1) args.push("-filter:a", `atempo=${speed < 0.5 ? 0.5 : speed > 2 ? 2 : speed}`);
  if (options.targetFps && options.interpolation) {
    args.push("-r", String(options.targetFps));
  }
  if (options.volume !== undefined) args.push("-af", `volume=${Math.max(0, Math.min(2, options.volume / 100))}`);

  const preset = options.compression || "BALANCED";
  const crf = preset === "SOCIAL" ? "26" : preset === "HIGH_QUALITY" ? "18" : "22";
  const maxrate = preset === "SOCIAL" ? "5M" : preset === "HIGH_QUALITY" ? "14M" : "8M";
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", crf, "-maxrate", maxrate, "-bufsize", preset === "SOCIAL" ? "10M" : preset === "HIGH_QUALITY" ? "28M" : "16M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", preset === "SOCIAL" ? "128k" : "192k", "-movflags", "+faststart", "-y", output);

  const result = await ff.exec(args);
  if (result !== 0) throw new Error("NEXUS could not render this video.");
  const data = await ff.readFile(output);
  if (!(data instanceof Uint8Array)) throw new Error("NEXUS render output could not be read.");
  await ff.deleteFile(input).catch(() => undefined);
  await ff.deleteFile(output).catch(() => undefined);
  onProgress?.(1);
  return new Blob([data.buffer as ArrayBuffer], {type:"video/mp4"});
}

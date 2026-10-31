import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

async function getFFmpeg() {
  if (ffmpeg) return ffmpeg;
  if (loading) return loading;
  loading = (async () => {
    const engine = new FFmpeg();
    const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
    await engine.load({
      coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm"),
      workerURL: await toBlobURL(`${base}/ffmpeg-core.worker.js`, "text/javascript"),
    });
    ffmpeg = engine;
    return engine;
  })();
  try { return await loading; } finally { loading = null; }
}

export type SpeedPoint = { position: number; speed: number };
export type NexusTimelineSegment = { id: string; start: number; sourceStart: number; sourceEnd: number; speed?: number; reverse?: boolean; freezeAt?: number; freezeDuration?: number };

export type NexusRenderOptions = {
  trimStart?: number;
  trimEnd?: number;
  speed?: number;
  speedRamp?: SpeedPoint[];
  volume?: number;
  muted?: boolean;
  pan?: number;
  bass?: number;
  treble?: number;
  compress?: number;
  audioFadeIn?: number;
  audioFadeOut?: number;
  normalizeAudio?: boolean;
  exposure?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  vibrance?: number;
  temperature?: number;
  tint?: number;
  hue?: number;
  whites?: number;
  blacks?: number;
  sharpness?: number;
  fade?: number;
  vignette?: number;
  grain?: number;
  red?: number;
  green?: number;
  blue?: number;
  structure?: number;
  lift?: number;
  gamma?: number;
  gain?: number;
  midtones?: number;
  shadows?: number;
  highlights?: number;
  clarity?: number;
  texture?: number;
  dehaze?: number;
  opacity?: number;
  blendMode?: string;
  maskType?: "NONE"|"RECT"|"CIRCLE";
  maskFeather?: number;
  mirrorX?: boolean;
  mirrorY?: boolean;
  blur?: number;
  effect?: string;
  effects?: { effect: string; enabled?: boolean; opacity?: number }[];
  chromaColor?: string;
  chromaSimilarity?: number;
  chromaBlend?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  positionX?: number;
  positionY?: number;
  rotation?: number;
  flipX?: boolean;
  flipY?: boolean;
  skew?: number;
  upscale?: number;
  targetFps?: number;
  interpolation?: boolean;
  enhance?: boolean;
  compression?: "SOCIAL" | "BALANCED" | "HIGH_QUALITY";
  durationSeconds?: number;
  reverse?: boolean;
  freezeAt?: number;
  freezeDuration?: number;
  timelineSegments?: NexusTimelineSegment[];
};

const effectFilters: Record<string, string> = {
  GLOW: "eq=brightness=0.08:saturation=1.2,unsharp=5:5:0.35",
  RGB: "chromashift=cbh=3:crh=-3",
  GLITCH: "noise=alls=8:allf=t,eq=contrast=1.2",
  SHAKE: "crop=iw*0.94:ih*0.94",
  BLUR: "gblur=sigma=3",
  CHROMA: "hue=h=8:s=1.5",
  VIGNETTE: "vignette=PI/4",
  GRAIN: "noise=alls=18:allf=t+u",
  WARP: "lenscorrection=k1=0.08:k2=0.02",
  ZOOM: "scale=iw*1.06:ih*1.06:flags=lanczos,crop=iw:ih",
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
  TILT: "gblur=sigma=0.8",
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function atempoChain(speed: number) {
  let s = clamp(speed, 0.25, 4);
  const filters: string[] = [];
  while (s > 2) { filters.push("atempo=2"); s /= 2; }
  while (s < 0.5) { filters.push("atempo=0.5"); s /= 0.5; }
  filters.push(`atempo=${s}`);
  return filters.join(",");
}

function buildVisualFilters(o: NexusRenderOptions) {
  const filters: string[] = [];
  const exposure = Number(o.exposure || 0);
  const b = Number(o.brightness || 0);
  const c = Number(o.contrast || 0);
  const s = Number(o.saturation || 0);
  const vibrance = Number(o.vibrance || 0);
  const temperature = Number(o.temperature || 0);
  const tint = Number(o.tint || 0);
  const h = Number(o.hue || 0);
  const shadows = Number(o.shadows || 0);
  const highlights = Number(o.highlights || 0);
  const whites = Number(o.whites || 0);
  const blacks = Number(o.blacks || 0);
  const clarity = Number(o.clarity || 0);
  const texture = Number(o.texture || 0);
  const dehaze = Number(o.dehaze || 0);
  const sharpness = Number(o.sharpness || 0);
  const fade = Number(o.fade || 0);
  const vignette = Number(o.vignette || 0);
  const grain = Number(o.grain || 0);
  const red = Number(o.red || 0);
  const green = Number(o.green || 0);
  const blue = Number(o.blue || 0);
  const structure = Number(o.structure || 0);
  const lift = Number(o.lift || 0);
  const gamma = Number(o.gamma || 0);
  const gain = Number(o.gain || 0);
  const midtones = Number(o.midtones || 0);

  // Stable color pipeline: map editor controls to FFmpeg filters with bounded values.
  const eqBrightness = clamp((b + exposure * 0.55 + midtones * 0.08) / 100, -1, 1);
  const eqContrast = clamp(1 + (c + structure * 0.12 + clarity * 0.08 + dehaze * 0.08) / 100, 0.1, 3);
  const eqSaturation = clamp(1 + (s + vibrance * 0.35 + texture * 0.08) / 100, 0, 3);
  const eqGamma = clamp(1 - gamma / 200, 0.1, 10);
  if (eqBrightness || c || s || vibrance || midtones || gamma || structure || clarity || texture || dehaze) filters.push(`eq=brightness=${eqBrightness}:contrast=${eqContrast}:saturation=${eqSaturation}:gamma=${eqGamma}`);
  if (h) filters.push(`hue=h=${h}`);
  if (temperature || tint) filters.push(`colorbalance=rs=${clamp(temperature / 100, -1, 1)}:gs=${clamp(tint / 120, -1, 1)}:bs=${clamp(-temperature / 100, -1, 1)}`);
  if (whites || blacks) { const black = clamp(-blacks / 100, -0.8, 0.8); const white = clamp(1 - whites / 100, 0.2, 1); filters.push(`colorlevels=rimin=${black}:gimin=${black}:bimin=${black}:rimax=${white}:gimax=${white}:bimax=${white}`); }
  if (red || green || blue) filters.push(`colorchannelmixer=rr=${clamp(1 + red / 100, 0, 2)}:gg=${clamp(1 + green / 100, 0, 2)}:bb=${clamp(1 + blue / 100, 0, 2)}`);
  if (lift || gain || shadows || highlights) filters.push(`colorbalance=rs=${clamp((lift + shadows) / 180, -1, 1)}:gs=${clamp((lift + shadows) / 220, -1, 1)}:bs=${clamp((lift + shadows) / 260, -1, 1)}:rh=${clamp((gain + highlights) / 180, -1, 1)}:gh=${clamp((gain + highlights) / 220, -1, 1)}:bh=${clamp((gain + highlights) / 260, -1, 1)}`);
  if (fade) filters.push(`eq=contrast=${clamp(1 - fade / 180, 0.2, 2)}:brightness=${clamp(fade / 700, 0, 0.3)}`);
  if (vignette) filters.push(`vignette=PI/${clamp(4 - vignette / 25, 1, 4)}`);
  if (grain) filters.push(`noise=alls=${clamp(grain / 3, 0, 32)}:allf=t+u`);
  if (sharpness) filters.push(`unsharp=5:5:${clamp(sharpness / 80, 0, 1.8)}`);
  if (o.blur) filters.push(`gblur=sigma=${clamp(Number(o.blur), 0, 20)}`);
  if (o.flipX || o.mirrorX) filters.push("hflip");
  if (o.flipY || o.mirrorY) filters.push("vflip");
  const sx = clamp(Number(o.scaleX ?? 100) / 100, 0.25, 3);
  const sy = clamp(Number(o.scaleY ?? 100) / 100, 0.25, 3);
  if (sx !== 1 || sy !== 1) filters.push(`scale=iw*${sx}:ih*${sy}:flags=lanczos`);
  if (o.rotation) filters.push(`rotate=${clamp(Number(o.rotation),-180,180)}*PI/180:fillcolor=black@0`);
  if (o.positionX || o.positionY) {
    const x = Math.round(clamp(Number(o.positionX), -100, 100) * 8);
    const y = Math.round(clamp(Number(o.positionY), -100, 100) * 8);
    const ax = Math.abs(x), ay = Math.abs(y);
    filters.push(`pad=iw+${ax*2}:ih+${ay*2}:${ax+Math.max(x,0)}:${ay+Math.max(y,0)}:color=black@0`);
    filters.push(`crop=iw-${ax*2}:ih-${ay*2}:${ax-Math.min(x,0)}:${ay-Math.min(y,0)}`);
  }
  if (o.effect === "CHROMA") {
    const hex = String(o.chromaColor || "#00ff00").replace("#","");
    const rgb = hex.length === 6 ? hex : "00ff00";
    const similarity = clamp(Number(o.chromaSimilarity ?? 0.28), 0.01, 0.99);
    const blend = clamp(Number(o.chromaBlend ?? 0.08), 0, 1);
    filters.push(`colorkey=0x${rgb}:${similarity}:${blend}`);
  } else {
    const stack = (o.effects || []).filter(x => x.enabled !== false && effectFilters[x.effect]);
    if (stack.length) {
      for (const layer of stack) {
        // FFmpeg filter graphs are sequential here, so stack order is deterministic.
        // Opacity is retained in the editor model; effects without an alpha-aware filter
        // are applied at full strength until a dedicated compositor is introduced.
        const filter = effectFilters[layer.effect];
        if (filter) filters.push(filter);
      }
    } else if (o.effect && effectFilters[o.effect]) {
      const filter = effectFilters[o.effect];
      if (filter) filters.push(filter);
    }
  }
  if (o.enhance) {
    filters.push("hqdn3d=0.8:0.8:4:4");
    filters.push("unsharp=5:5:0.85:5:5:0");
  }
  if (o.scale && o.scale !== 100) filters.push(`scale=iw*${o.scale / 100}:ih*${o.scale / 100}:flags=lanczos`);
  if (o.upscale && o.upscale !== 100) filters.push(`scale=iw*${o.upscale / 100}:ih*${o.upscale / 100}:flags=lanczos`);
  if (o.maskType === "RECT") {
    const feather = clamp(Number(o.maskFeather || 0) / 25, 0, 4);
    filters.push(feather > 0 ? `format=yuva420p,geq=a='if(between(X,W*.05,W*.95)*between(Y,H*.05,H*.95),255,0)':r='r(X,Y)':g='g(X,Y)':b='b(X,Y)'` : "format=yuva420p,crop=iw*.9:ih*.9");
  } else if (o.maskType === "CIRCLE") {
    filters.push("format=yuva420p,geq=a='if(lte(hypot(X-W/2,Y-H/2),min(W,H)*.45),255,0)':r='r(X,Y)':g='g(X,Y)':b='b(X,Y)'");
  }
  if (o.blendMode && o.blendMode !== "normal") {
    const mode = ["multiply","screen","overlay","darken","lighten"].includes(o.blendMode) ? o.blendMode : "normal";
    if (mode !== "normal") filters.push(`blend=all_mode=${mode}`);
  }
  if (o.opacity !== undefined && o.opacity < 100) filters.push(`format=yuva420p,colorchannelmixer=aa=${clamp(o.opacity / 100, 0, 1)}`);
  return filters;
}

export async function renderNexusVideoV2(file: File, o: NexusRenderOptions, onProgress?: (p: number) => void) {
  const engine = await getFFmpeg();
  const stamp = Date.now();
  const input = `nexus-v2-in-${stamp}.${file.name.split(".").pop() || "mp4"}`;
  const output = `nexus-v2-out-${stamp}.mp4`;
  const progressListener = ({ progress }: { progress: number }) => onProgress?.(clamp(progress, 0, 1));
  engine.on("progress", progressListener);
  await engine.writeFile(input, await fetchFile(file));

  const start = clamp(Number(o.trimStart ?? 0), 0, 99.9) / 100;
  const end = clamp(Number(o.trimEnd ?? 100), start + 0.1, 100) / 100;
  const sourceDuration = Math.max(0.1, Number(o.durationSeconds || 3600));
  const args = ["-i", input];
  const vf = buildVisualFilters(o);

  // Real sequence assembly: every timeline clip becomes a source-trimmed segment.
  // This replaces the former behaviour that exported only the currently selected clip.
  if (o.timelineSegments?.length) {
    const segments = [...o.timelineSegments]
      .filter(x => Number.isFinite(x.sourceStart) && Number.isFinite(x.sourceEnd) && x.sourceEnd > x.sourceStart)
      .sort((a,b) => a.start - b.start);
    if (!segments.length) throw new Error("The timeline has no valid video segments.");
    const graph: string[] = [];
    const videoLabels: string[] = [];
    const audioLabels: string[] = [];
    const probeLog: string[] = [];
    const onLog = ({ message }: { message: string }) => probeLog.push(message);
    let hasAudio = false;
    try {
      engine.on("log", onLog);
      await engine.ffprobe(["-v","error","-select_streams","a:0","-show_entries","stream=index","-of","csv=p=0",input]);
      hasAudio = probeLog.join("\\n").trim().length > 0;
    } catch {
      hasAudio = false;
    } finally {
      engine.off("log", onLog);
    }
    const audioFilters: string[] = [];
    const volume = o.muted ? 0 : clamp(Number(o.volume ?? 100) / 100, 0, 2);
    audioFilters.push(`volume=${volume}`);
    const pan = clamp(Number(o.pan ?? 0) / 100, -1, 1);
    const bass = clamp(Number(o.bass ?? 0), -12, 12);
    const treble = clamp(Number(o.treble ?? 0), -12, 12);
    const compress = clamp(Number(o.compress ?? 0), 0, 100);
    if (bass) audioFilters.push(`bass=g=${bass}:f=100:t=q`);
    if (treble) audioFilters.push(`treble=g=${treble}:f=4000:t=q`);
    if (Math.abs(pan) > .001) {
      const left = clamp(1 - Math.max(0,pan),0,1);
      const right = clamp(1 + Math.max(0,-pan),0,2);
      audioFilters.push(`pan=stereo|c0=${left}*c0+${Math.max(0,pan)}*c1|c1=${Math.max(0,-pan)}*c0+${right}*c1`);
    }
    if (compress > 0) audioFilters.push(`acompressor=threshold=${-30+compress*.1}dB:ratio=${(1+compress/12).toFixed(2)}:attack=5:release=80:makeup=1`);
    if (o.normalizeAudio) audioFilters.push("loudnorm=I=-14:TP=-1.5:LRA=11");
    if (o.audioFadeIn) audioFilters.push(`afade=t=in:st=0:d=${clamp(Number(o.audioFadeIn),0,30)}`);
    const timelineSeconds = segments.reduce((total,clip) => total + ((clamp(clip.sourceEnd,0,100)-clamp(clip.sourceStart,0,100))/100*sourceDuration)/clamp(Number(clip.speed||1),.25,4) + clamp(Number(clip.freezeDuration||0),0,30),0);
    if (o.audioFadeOut) { const fade = clamp(Number(o.audioFadeOut),0,30); audioFilters.push(`afade=t=out:st=${Math.max(0,timelineSeconds-fade)}:d=${fade}`); }
    segments.forEach((clip,index) => {
      const start = clamp(clip.sourceStart,0,100) / 100 * sourceDuration;
      const end = clamp(clip.sourceEnd,0,100) / 100 * sourceDuration;
      const speed = clamp(Number(clip.speed || 1),.25,4);
      const freeze = clamp(Number(clip.freezeDuration || 0),0,30);
      const v = [`trim=start=${start.toFixed(4)}:end=${end.toFixed(4)}`,"setpts=PTS-STARTPTS"];
      if (clip.reverse) v.push("reverse","setpts=PTS-STARTPTS");
      if (speed !== 1) v.push(`setpts=PTS/${speed}`);
      if (vf.length) v.push(...vf);
      if (freeze > 0) v.push(`tpad=stop_mode=clone:stop_duration=${freeze}`);
      graph.push(`[0:v:0]${v.join(",")}[vseg${index}]`);
      videoLabels.push(`[vseg${index}]`);
      if (hasAudio) {
        const a = [`atrim=start=${start.toFixed(4)}:end=${end.toFixed(4)}`,"asetpts=PTS-STARTPTS"];
        if (clip.reverse) a.push("areverse","asetpts=PTS-STARTPTS");
        if (speed !== 1) a.push(atempoChain(speed));
        if (freeze > 0) a.push(`apad=pad_dur=${freeze}`);
        graph.push(`[0:a:0]${a.join(",")}[aseg${index}]`);
        audioLabels.push(`[aseg${index}]`);
      }
    });
    graph.push(`${videoLabels.join("")}concat=n=${videoLabels.length}:v=1:a=0[vout]`);
    if (hasAudio) graph.push(`${audioLabels.join("")}concat=n=${audioLabels.length}:v=0:a=1,${audioFilters.join(",")}[aout]`);
    args.push("-filter_complex",graph.join(";"),"-map","[vout]");
    if (hasAudio) args.push("-map","[aout]");
    args.push("-an");
    if (hasAudio) args.pop();
    // Output frame-rate conforming (dup/drop) is supported; this is not AI frame interpolation.
    if (o.targetFps) args.push("-r",String(clamp(Number(o.targetFps),12,120)));
    const preset = o.compression || "BALANCED";
    const crf = preset === "SOCIAL" ? "26" : preset === "HIGH_QUALITY" ? "18" : "22";
    const maxrate = preset === "SOCIAL" ? "5M" : preset === "HIGH_QUALITY" ? "14M" : "8M";
    args.push("-c:v","libx264","-preset","veryfast","-crf",crf,"-maxrate",maxrate,"-bufsize",preset === "SOCIAL" ? "10M" : preset === "HIGH_QUALITY" ? "28M" : "16M","-pix_fmt","yuv420p");
    if (hasAudio) args.push("-c:a","aac","-b:a",preset === "SOCIAL" ? "128k" : "192k");
    args.push("-movflags","+faststart","-y",output);
    const result = await engine.exec(args);
    if (result !== 0) throw new Error("NEXUS could not assemble the full timeline. Check the source codec and clip ranges.");
    const data = await engine.readFile(output);
    await engine.deleteFile(input).catch(() => undefined);
    await engine.deleteFile(output).catch(() => undefined);
    onProgress?.(1);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return new Blob([buffer], { type: "video/mp4" });
  }
  const reverse = Boolean(o.reverse);
  const freezeAtPct = o.freezeAt === undefined ? null : clamp(Number(o.freezeAt), 0, 100) / 100;
  const freezeSeconds = clamp(Number(o.freezeDuration ?? 0), 0, 30);
  const speed = clamp(Number(o.speed || 1), 0.25, 4);
  const ramp = (o.speedRamp || []).filter(p => Number.isFinite(p.position) && Number.isFinite(p.speed)).sort((a,b)=>a.position-b.position);

  // Speed-ramp is rendered as real piecewise time remapping. The graph is not cosmetic.
  if (ramp.length >= 2) {
    const points = ramp
      .map(p => ({ position: clamp(Number(p.position), 0, 1), speed: clamp(Number(p.speed), 0.25, 4) }))
      .sort((a,b) => a.position - b.position);
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    if (!firstPoint || !lastPoint) throw new Error("NEXUS speed graph has no valid points.");
    if (firstPoint.position > 0) points.unshift({ position: 0, speed: firstPoint.speed });
    if (lastPoint.position < 1) points.push({ position: 1, speed: lastPoint.speed });

    const videoParts: string[] = [];
    const total = end - start;
    for (let i = 0; i < points.length - 1; i++) {
      const pointA = points[i];
      const pointB = points[i + 1];
      if (!pointA || !pointB) continue;
      const a = (start + total * pointA.position) * sourceDuration;
      const b = (start + total * pointB.position) * sourceDuration;
      const s = pointA.speed;
      videoParts.push(
        `[0:v:0]trim=start=${a}:end=${b},setpts=(PTS-STARTPTS)/${s}${vf.length ? "," + vf.join(",") : ""}[v${i}]`
      );
    }
    args.push(
      "-filter_complex",
      `${videoParts.join(";")};${videoParts.map((_,i)=>`[v${i}]`).join("")}concat=n=${videoParts.length}:v=1:a=0[vout]`,
      "-map", "[vout]", "-map", "0:a?"
    );
  } else {
    args.push("-ss", String(start * sourceDuration), "-t", String(Math.max(0.01, (end - start) * sourceDuration)));
    const timeFilters: string[] = [];
    if (reverse) timeFilters.push("reverse");
    if (freezeAtPct !== null && freezeSeconds > 0) {
      const clipDuration = Math.max(0.01, (end - start) * sourceDuration / Math.max(speed, 0.25));
      const freezeTime = clamp((freezeAtPct - start) * sourceDuration / Math.max(speed, 0.25), 0, clipDuration);
      timeFilters.push(`tpad=stop_mode=clone:stop_duration=${freezeSeconds}`);
      if (freezeTime > 0 && freezeTime < clipDuration) timeFilters.push(`trim=start=0:end=${clipDuration + freezeSeconds}`);
    }
    const allVideoFilters = [...timeFilters, ...vf];
    if (o.targetFps) args.push("-r", String(clamp(Number(o.targetFps),12,120)));
    if (speed !== 1) allVideoFilters.push(`setpts=PTS/${speed}`);
    if (allVideoFilters.length) args.push("-vf", allVideoFilters.join(","));
    args.push("-map", "0:v:0", "-map", "0:a?");
  }

  const volume = o.muted ? 0 : clamp(Number(o.volume ?? 100) / 100, 0, 2);
  const audioFilters = [`volume=${volume}`];
  const pan = clamp(Number(o.pan ?? 0) / 100, -1, 1);
  const bass = clamp(Number(o.bass ?? 0), -12, 12);
  const treble = clamp(Number(o.treble ?? 0), -12, 12);
  const compress = clamp(Number(o.compress ?? 0), 0, 100);
  const fadeIn = clamp(Number(o.audioFadeIn ?? 0), 0, 30);
  const fadeOut = clamp(Number(o.audioFadeOut ?? 0), 0, 30);
  if (bass) audioFilters.push(`bass=g=${bass}:f=100:t=q`);
  if (treble) audioFilters.push(`treble=g=${treble}:f=4000:t=q`);
  if (Math.abs(pan) > 0.001) {
    const left = clamp(1 - Math.max(0, pan), 0, 1);
    const right = clamp(1 + Math.min(0, pan), 0, 1);
    const oppositeLeft = clamp(1 - Math.min(0, pan), 0, 2);
    const oppositeRight = clamp(1 + Math.max(0, pan), 0, 2);
    audioFilters.push(`pan=stereo|c0=${left}*c0+${Math.max(0,pan)}*c1|c1=${Math.max(0,-pan)}*c0+${oppositeRight}*c1`);
  }
  if (compress > 0) {
    const ratio = 1 + compress / 12;
    const threshold = -30 + compress * 0.1;
    audioFilters.push(`acompressor=threshold=${threshold}dB:ratio=${ratio.toFixed(2)}:attack=5:release=80:makeup=1`);
  }
  if (o.normalizeAudio) audioFilters.push("loudnorm=I=-14:TP=-1.5:LRA=11");
  if (fadeIn > 0) audioFilters.push(`afade=t=in:st=0:d=${fadeIn}`);
  if (fadeOut > 0) {
    const trimmedDuration = Math.max(0.01, (end - start) * sourceDuration / Math.max(speed, 0.25));
    audioFilters.push(`afade=t=out:st=${Math.max(0, trimmedDuration - fadeOut)}:d=${fadeOut}`);
  }
  if (speed !== 1 && ramp.length < 2) audioFilters.push(atempoChain(speed));
  if (reverse) audioFilters.push("areverse");
  if (freezeSeconds > 0) audioFilters.push(`apad=pad_dur=${freezeSeconds}`);
  args.push("-af", audioFilters.join(","));
  const preset = o.compression || "BALANCED";
  const crf = preset === "SOCIAL" ? "26" : preset === "HIGH_QUALITY" ? "18" : "22";
  const maxrate = preset === "SOCIAL" ? "5M" : preset === "HIGH_QUALITY" ? "14M" : "8M";
  args.push("-c:v", "libx264", "-preset", "veryfast", "-crf", crf, "-maxrate", maxrate, "-bufsize", preset === "SOCIAL" ? "10M" : preset === "HIGH_QUALITY" ? "28M" : "16M", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", preset === "SOCIAL" ? "128k" : "192k", "-movflags", "+faststart", "-y", output);

  try {
    const result = await engine.exec(args);
    if (result !== 0) throw new Error("NEXUS could not render this edit.");
    const data = await engine.readFile(output);
    onProgress?.(1);
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    return new Blob([buffer], { type: "video/mp4" });
  } finally {
    engine.off("progress", progressListener);
    await engine.deleteFile(input).catch(() => undefined);
    await engine.deleteFile(output).catch(() => undefined);
  }
}
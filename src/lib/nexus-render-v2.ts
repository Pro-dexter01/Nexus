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
export type NexusTimelineSegment = { id: string; start: number; sourceStart: number; sourceEnd: number; inputIndex?: number; sourceDuration?: number; speed?: number; speedRamp?: SpeedPoint[]; transitionIn?: {type:string;duration:number}; reverse?: boolean; freezeAt?: number; freezeDuration?: number };

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
  keyframes?: {time:number;value:number;property:string}[];
  text?: string;
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

function keyframeExpression(points:{time:number;value:number;property:string}[],property:string,fallback:number,min:number,max:number){
 const pts=points.filter(p=>p.property===property).sort((a,b)=>a.time-b.time).map(p=>({time:Math.max(0,p.time),value:clamp(p.value,min,max)}));
 if(!pts.length)return String(clamp(fallback,min,max));
 const first=pts[0],last=pts[pts.length-1];if(!first||!last)return String(clamp(fallback,min,max));
 let expression=String(last.value);
 for(let i=pts.length-2;i>=0;i--){const a=pts[i],b=pts[i+1];if(!a||!b)continue;const span=Math.max(.001,b.time-a.time);const linear='('+a.value+'+('+(b.value-a.value)+')*(t-'+a.time+')/'+span+')';expression='if(lt(t\\,'+b.time+')\\,'+linear+'\\,'+expression+')';}
 return 'if(lt(t\\,'+first.time+')\\,'+first.value+'\\,'+expression+')';
}
function buildVisualFilters(o: NexusRenderOptions) {
  const filters: string[] = [];
  const hasKeyframe=(property:string)=>Boolean(o.keyframes?.some(point=>point.property===property));
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
  if (o.rotation && !hasKeyframe("rotation")) filters.push(`rotate=${clamp(Number(o.rotation),-180,180)}*PI/180:fillcolor=black@0`);
  if ((o.positionX || o.positionY) && !hasKeyframe("positionX") && !hasKeyframe("positionY")) {
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
  if (o.scale && o.scale !== 100 && !hasKeyframe("scale")) filters.push(`scale=iw*${o.scale / 100}:ih*${o.scale / 100}:flags=lanczos`);
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
  if (o.opacity !== undefined && o.opacity < 100 && !hasKeyframe("opacity")) filters.push(`format=yuva420p,colorchannelmixer=aa=${clamp(o.opacity / 100, 0, 1)}`);
  return filters;
}

async function createTextOverlay(text:string,width:number,height:number){
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');if(!context)throw new Error('Text overlay could not be initialized.');
  const fontSize=Math.max(22,Math.round(height*.065));context.font='700 '+fontSize+'px system-ui, sans-serif';
  context.textAlign='center';context.textBaseline='middle';context.lineJoin='round';context.lineWidth=Math.max(3,fontSize*.12);
  const maxWidth=width*.86,lines:string[]=[];let line='';
  for(const word of text.slice(0,500).split(/\s+/)){const candidate=line?line+' '+word:word;if(context.measureText(candidate).width>maxWidth&&line){lines.push(line);line=word;}else line=candidate;}
  if(line)lines.push(line);const lineHeight=fontSize*1.22;const startY=height*.42-((lines.length-1)*lineHeight)/2;
  lines.forEach((value,index)=>{const y=startY+index*lineHeight;context.strokeStyle='rgba(0,0,0,.88)';context.fillStyle='#ffffff';context.strokeText(value,width/2,y,maxWidth);context.fillText(value,width/2,y,maxWidth);});
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Text overlay image could not be created.')),'image/png'));
  return blob;
}
function normalizeSpeedRamp(points:SpeedPoint[]|undefined){
  const normalized=(points??[]).filter(p=>Number.isFinite(p.position)&&Number.isFinite(p.speed)).map(p=>({position:clamp(p.position,0,1),speed:clamp(p.speed,.25,4)})).sort((a,b)=>a.position-b.position);
  if(!normalized.length)return [];
  if(normalized[0]!.position>0)normalized.unshift({position:0,speed:normalized[0]!.speed});
  if(normalized[normalized.length-1]!.position<1)normalized.push({position:1,speed:normalized[normalized.length-1]!.speed});
  return normalized;
}
function rampDuration(sourceLength:number,ramp:SpeedPoint[]){
  if(ramp.length<2)return sourceLength;
  let duration=0;for(let i=0;i<ramp.length-1;i++){const a=ramp[i],b=ramp[i+1];if(a&&b)duration+=sourceLength*Math.max(0,b.position-a.position)/clamp(a.speed,.25,4);}
  return duration;
}
export async function renderNexusVideoV2(file: File | File[], o: NexusRenderOptions, onProgress?: (p: number) => void) {
  const files = Array.isArray(file) ? file : [file];
  if (!files.length) throw new Error("Import at least one video before rendering.");
  const engine = await getFFmpeg();
  const stamp = Date.now();
  const inputs = files.map((f,i)=>`nexus-v2-in-${stamp}-${i}.${f.name.split(".").pop() || "mp4"}`);
  const input = inputs[0] ?? `nexus-v2-in-${stamp}.mp4`;
  const output = `nexus-v2-out-${stamp}.mp4`;
  const textOverlayPath=`nexus-v2-text-${stamp}.png`;
  let hasTextOverlay=false;
  const progressListener = ({ progress }: { progress: number }) => onProgress?.(clamp(progress, 0, 1));
  engine.on("progress", progressListener);
  const cleanup=async()=>{engine.off("progress",progressListener);for(const path of inputs)await engine.deleteFile(path).catch(()=>undefined);await engine.deleteFile(textOverlayPath).catch(()=>undefined);await engine.deleteFile(output).catch(()=>undefined);};
  try{for(let i=0;i<files.length;i++){const source=files[i],path=inputs[i];if(source&&path)await engine.writeFile(path,await fetchFile(source));}}catch(error){await cleanup();throw error;}

  const start = clamp(Number(o.trimStart ?? 0), 0, 99.9) / 100;
  const end = clamp(Number(o.trimEnd ?? 100), start + 0.1, 100) / 100;
  const sourceDuration = Math.max(0.1, Number(o.durationSeconds || 3600));
  const args = inputs.flatMap(path=>["-i",path]);
  const vf = buildVisualFilters(o);

  // Real sequence assembly: every timeline clip becomes a source-trimmed segment.
  // This replaces the former behaviour that exported only the currently selected clip.
  if (o.timelineSegments?.length) {
    const segments = [...o.timelineSegments]
      .filter(x => Number.isFinite(x.sourceStart) && Number.isFinite(x.sourceEnd) && x.sourceEnd > x.sourceStart)
      .sort((a,b) => a.start - b.start);
    if (!segments.length){await cleanup();throw new Error("The timeline has no valid video segments.");}
    const graph: string[] = [];
    const videoLabels: string[] = [];
    const audioLabels: string[] = [];
    let outputWidth=1280,outputHeight=720;
    try{
      const dimensions:string[]=[];
      const onVideoLog=({message}:{message:string})=>dimensions.push(message);
      engine.on("log",onVideoLog);
      try{await engine.ffprobe(["-v","error","-select_streams","v:0","-show_entries","stream=width,height","-of","csv=s=x:p=0",inputs[0]??""]);}finally{engine.off("log",onVideoLog);}
      const match=dimensions.join(" ").match(/(\d+)[x,](\d+)/);
      if(match){outputWidth=Math.max(2,Math.min(1920,Math.floor(Number(match[1])/2)*2));outputHeight=Math.max(2,Math.min(1920,Math.floor(Number(match[2])/2)*2));}
    }catch{/* use a safe 720p canvas when source metadata is unavailable */}
    if(o.text?.trim()){const overlay=await createTextOverlay(o.text,outputWidth,outputHeight);await engine.writeFile(textOverlayPath,await fetchFile(overlay));hasTextOverlay=true;args.push("-loop","1","-i",textOverlayPath);}
    const hasAudioSources:boolean[]=[];
    for(const input of inputs){
      const probeLog:string[]=[];
      const onLog=({message}:{message:string})=>probeLog.push(message);
      try{
        engine.on("log",onLog);
        await engine.ffprobe(["-v","error","-select_streams","a:0","-show_entries","stream=index","-of","csv=p=0",input]);
        hasAudioSources.push(probeLog.join("\\n").trim().length>0);
      }catch{hasAudioSources.push(false);}
      finally{engine.off("log",onLog);}
    }
    const hasAudio=hasAudioSources.some(Boolean);
    const audioFilters: string[] = [];
    const volume = o.muted ? 0 : clamp(Number(o.volume ?? 100) / 100, 0, 2);
    if(!o.muted&&o.keyframes?.some(point=>point.property==="volume"))audioFilters.push("volume='"+keyframeExpression(o.keyframes,"volume",volume*100,0,200)+"/100':eval=frame");
    else audioFilters.push(`volume=${volume}`);
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
    const timelineSeconds = Math.max(.1,Number(o.durationSeconds||segments.reduce((total,clip)=>{const length=(clamp(clip.sourceEnd,0,100)-clamp(clip.sourceStart,0,100))/100*Math.max(.1,Number(clip.sourceDuration||sourceDuration));const ramp=normalizeSpeedRamp(clip.speedRamp);return total+(ramp.length>=2&&!clip.reverse&&!clip.freezeDuration?rampDuration(length,ramp):length/clamp(Number(clip.speed||1),.25,4))+clamp(Number(clip.freezeDuration||0),0,30);},0)));
    if (o.audioFadeOut) { const fade = clamp(Number(o.audioFadeOut),0,30); audioFilters.push(`afade=t=out:st=${Math.max(0,timelineSeconds-fade)}:d=${fade}`); }
    let timelineCursor=0;
    const addGap=(gap:number,index:number)=>{
      if(gap<=0.04)return;
      graph.push(`color=c=black:s=${outputWidth}x${outputHeight}:r=30:d=${gap},format=yuv420p[vgap${index}]`);
      const audioLabel=hasAudio?`[agap${index}]`:undefined;
      if(hasAudio)graph.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${gap},asetpts=PTS-STARTPTS${audioLabel}`);
      timelinePieces.push({video:`[vgap${index}]`,audio:audioLabel,start:timelineCursor,duration:gap,transitionDuration:0,transitionType:"fade"});
    };
    segments.forEach((clip,index) => {
      const inputIndex=clamp(Math.floor(Number(clip.inputIndex??0)),0,inputs.length-1);
      const clipSourceDuration=Math.max(.1,Number(clip.sourceDuration||sourceDuration));
      const sourceHasAudio=Boolean(hasAudioSources[inputIndex]);
      const start = clamp(clip.sourceStart,0,100) / 100 * clipSourceDuration;
      const end = clamp(clip.sourceEnd,0,100) / 100 * clipSourceDuration;
      const speed = clamp(Number(clip.speed || 1),.25,4);
      const freeze = clamp(Number(clip.freezeDuration || 0),0,30);
      const freezeAt = clip.freezeAt === undefined ? null : clamp(Number(clip.freezeAt),0,100)/100*clipSourceDuration;
      const segmentFilters=[...vf,`scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease:flags=lanczos`,`pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2:color=black`,`setsar=1`,`fps=30`,`format=yuv420p`];
      const timelineStart=clamp(Number(clip.start||0),0,100)/100*sourceDuration;
      const overlap=Math.max(0,timelineCursor-timelineStart);
      const transition=clip.transitionIn;
      if(overlap>0.08&&!transition){void cleanup();throw new Error("Overlapping clips need a transition. Apply a transition preset or move the clips apart.");}
      if(timelineStart>timelineCursor)addGap(timelineStart-timelineCursor,index);
      const clipRamp=normalizeSpeedRamp(clip.speedRamp);
      const useRamp=clipRamp.length>=2&&!clip.reverse&&freeze<=0;
      const segmentOutputDuration=(useRamp?rampDuration(end-start,clipRamp):(end-start)/speed)+freeze;
      const transitionDuration=transition?clamp(Number(transition.duration),.05,Math.min(3,Math.max(.06,segmentOutputDuration-.05))):0;
      if(transition&&Math.abs(overlap-transitionDuration)>.12){void cleanup();throw new Error("The transition overlap and transition duration do not match. Reapply the transition preset.");}
      const splitFreeze = freeze > 0 && freezeAt !== null && freezeAt > start + 0.04 && freezeAt < end - 0.04;
      if(useRamp){
        const vparts:string[]=[],aparts:string[]=[];
        for(let partIndex=0;partIndex<clipRamp.length-1;partIndex++){
          const a=clipRamp[partIndex],b=clipRamp[partIndex+1];if(!a||!b)continue;
          const pieceStart=start+(end-start)*a.position,pieceEnd=start+(end-start)*b.position,rate=clamp(a.speed,.25,4);
          const vLabel=`vramp${index}_${partIndex}`;
          const chain=[`trim=start=${pieceStart.toFixed(4)}:end=${pieceEnd.toFixed(4)}`,"setpts=PTS-STARTPTS",`setpts=PTS/${rate}`,...segmentFilters];
          graph.push(`[${inputIndex}:v:0]${chain.join(",")}[${vLabel}]`);vparts.push(`[${vLabel}]`);
          if(hasAudio){const aLabel=`aramp${index}_${partIndex}`;if(sourceHasAudio){const audio=[`atrim=start=${pieceStart.toFixed(4)}:end=${pieceEnd.toFixed(4)}`,"asetpts=PTS-STARTPTS","aformat=sample_rates=48000:channel_layouts=stereo",atempoChain(rate)];graph.push(`[${inputIndex}:a:0]${audio.join(",")}[${aLabel}]`);}else{const silent=(pieceEnd-pieceStart)/rate;graph.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${silent},asetpts=PTS-STARTPTS[${aLabel}]`);}aparts.push(`[${aLabel}]`);}
        }
        graph.push(`${vparts.join("")}concat=n=${vparts.length}:v=1:a=0[vseg${index}]`);
        if(hasAudio)graph.push(`${aparts.join("")}concat=n=${aparts.length}:v=0:a=1[aseg${index}]`);
      } else if (splitFreeze && freezeAt !== null) {
        // Freeze is inserted at the selected source frame, not appended to the clip tail.
        const pieces = clip.reverse
          ? [{from:freezeAt,to:end,reverse:true},{freeze:true},{from:start,to:freezeAt,reverse:true}]
          : [{from:start,to:freezeAt,reverse:false},{freeze:true},{from:freezeAt,to:end,reverse:false}];
        const vparts:string[]=[];
        const aparts:string[]=[];
        pieces.forEach((piece,partIndex)=>{
          const vLabel=`vpart${index}_${partIndex}`;
          if (piece.freeze) {
            const still=[`trim=start=${freezeAt.toFixed(4)}:end=${Math.min(end,freezeAt+0.08).toFixed(4)}`,"setpts=PTS-STARTPTS",`tpad=stop_mode=clone:stop_duration=${freeze}`,...segmentFilters];
            graph.push(`[${inputIndex}:v:0]${still.join(",")}[${vLabel}]`);
          } else {
            const chain=[`trim=start=${piece.from.toFixed(4)}:end=${piece.to.toFixed(4)}`,"setpts=PTS-STARTPTS"];
            if(piece.reverse)chain.push("reverse","setpts=PTS-STARTPTS");
            if(speed!==1)chain.push(`setpts=PTS/${speed}`);
            chain.push(...segmentFilters);
            graph.push(`[${inputIndex}:v:0]${chain.join(",")}[${vLabel}]`);
          }
          vparts.push(`[${vLabel}]`);
          if(hasAudio){
            const aLabel=`apart${index}_${partIndex}`;
            if(piece.freeze || !sourceHasAudio){
              const silentDuration=piece.freeze?freeze:(piece.to-piece.from)/speed;
              graph.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${silentDuration},asetpts=PTS-STARTPTS[${aLabel}]`);
            }else{
              const chain=[`atrim=start=${piece.from.toFixed(4)}:end=${piece.to.toFixed(4)}`,"asetpts=PTS-STARTPTS","aformat=sample_rates=48000:channel_layouts=stereo"];
              if(piece.reverse)chain.push("areverse","asetpts=PTS-STARTPTS");
              if(speed!==1)chain.push(atempoChain(speed));
              graph.push(`[${inputIndex}:a:0]${chain.join(",")}[${aLabel}]`);
            }
            aparts.push(`[${aLabel}]`);
          }
        });
        graph.push(`${vparts.join("")}concat=n=${vparts.length}:v=1:a=0[vseg${index}]`);
        if(hasAudio)graph.push(`${aparts.join("")}concat=n=${aparts.length}:v=0:a=1[aseg${index}]`);
      } else {
        const v = [`trim=start=${start.toFixed(4)}:end=${end.toFixed(4)}`,"setpts=PTS-STARTPTS"];
        if (clip.reverse) v.push("reverse","setpts=PTS-STARTPTS");
        if (speed !== 1) v.push(`setpts=PTS/${speed}`);
        v.push(...segmentFilters);
        if (freeze > 0) v.push(`tpad=stop_mode=clone:stop_duration=${freeze}`);
        graph.push(`[${inputIndex}:v:0]${v.join(",")}[vseg${index}]`);
        if (hasAudio) {
          if(sourceHasAudio){
            const a = [`atrim=start=${start.toFixed(4)}:end=${end.toFixed(4)}`,"asetpts=PTS-STARTPTS","aformat=sample_rates=48000:channel_layouts=stereo"];
            if (clip.reverse) a.push("areverse","asetpts=PTS-STARTPTS");
            if (speed !== 1) a.push(atempoChain(speed));
            if (freeze > 0) a.push(`apad=pad_dur=${freeze}`);
            graph.push(`[${inputIndex}:a:0]${a.join(",")}[aseg${index}]`);
          } else {
            const silentDuration=(end-start)/speed+freeze;
            graph.push(`anullsrc=r=48000:cl=stereo,atrim=duration=${silentDuration},asetpts=PTS-STARTPTS[aseg${index}]`);
          }
        }
      }
      timelinePieces.push({video:`[vseg${index}]`,audio:hasAudio?`[aseg${index}]`:undefined,start:timelineStart,duration:segmentOutputDuration,transitionDuration,transitionType:transition?.type??"fade"});
      timelineCursor=timelineStart+segmentOutputDuration;
    });
    addGap(Math.max(0,timelineSeconds-timelineCursor),segments.length);
    if(!timelinePieces.length){await cleanup();throw new Error("The timeline contains no renderable clips.");}
    let videoChain=timelinePieces[0]!.video;
    let audioChain=timelinePieces[0]!.audio??"";
    for(let pieceIndex=1;pieceIndex<timelinePieces.length;pieceIndex++){
      const piece=timelinePieces[pieceIndex];if(!piece)continue;
      const videoLabel=`vchain${pieceIndex}`;
      if(piece.transitionDuration>0)graph.push(`${videoChain}${piece.video}xfade=transition=${piece.transitionType}:duration=${piece.transitionDuration}:offset=${piece.start}[${videoLabel}]`);
      else graph.push(`${videoChain}${piece.video}concat=n=2:v=1:a=0[${videoLabel}]`);
      videoChain=`[${videoLabel}]`;
      if(hasAudio&&piece.audio){const audioLabel=`achain${pieceIndex}`;if(piece.transitionDuration>0)graph.push(`${audioChain}${piece.audio}acrossfade=d=${piece.transitionDuration}:c1=tri:c2=tri[${audioLabel}]`);else graph.push(`${audioChain}${piece.audio}concat=n=2:v=0:a=1[${audioLabel}]`);audioChain=`[${audioLabel}]`; }
    }
    const videoBase=hasTextOverlay?"vtext":videoChain.slice(1,-1);
    if(hasTextOverlay)graph.push(`${videoChain}[${inputs.length}:v:0]overlay=x=(W-w)/2:y=H*0.42-h/2:shortest=1:format=auto[vtext]`);
    const motionFilters:string[]=[];
    const keyframes=o.keyframes??[];
    const hasKF=(property:string)=>keyframes.some(point=>point.property===property);
    if(hasKF("scale")||hasKF("positionX")||hasKF("positionY")){
      const zoom='max(1\\,min(3\\,'+keyframeExpression(keyframes,'scale',hasKF("scale")?Number(o.scale??100):100,25,300)+'/100))';
      const x=keyframeExpression(keyframes,'positionX',Number(o.positionX??0),-100,100);
      const y=keyframeExpression(keyframes,'positionY',Number(o.positionY??0),-100,100);
      motionFilters.push('zoompan=z='+zoom+':x=\'iw/2-iw/zoom/2+('+x+')*iw/200\':y=\'ih/2-ih/zoom/2+('+y+')*ih/200\':d=1:s='+outputWidth+'x'+outputHeight+':fps=30');
    }
    if(hasKF("rotation")){
      const angle=keyframeExpression(keyframes,'rotation',Number(o.rotation??0),-180,180);
      motionFilters.push('rotate=angle=\''+angle+'*PI/180\':ow='+outputWidth+':oh='+outputHeight+':c=black');
    }
    if(hasKF("opacity")){
      const alpha=keyframeExpression(keyframes,'opacity',Number(o.opacity??100),0,100);
      motionFilters.push('format=rgb24,geq=r=\'r(X,Y)*('+alpha+'/100)\':g=\'g(X,Y)*('+alpha+'/100)\':b=\'b(X,Y)*('+alpha+'/100)\',format=yuv420p');
    }
    if(motionFilters.length)graph.push("["+videoBase+"]"+motionFilters.join(",")+"[vout]");
    else graph.push("["+videoBase+"]null[vout]");
    if(hasAudio)graph.push(`${audioChain}${audioFilters.join(",")}[aout]`);
    args.push("-filter_complex",graph.join(";"),"-map","[vout]");
    if (hasAudio) args.push("-map","[aout]");
    if (!hasAudio) args.push("-an");
    // Output frame-rate conforming (dup/drop) is supported; this is not AI frame interpolation.
    if (o.targetFps) args.push("-r",String(clamp(Number(o.targetFps),12,120)));
    const preset = o.compression || "BALANCED";
    const crf = preset === "SOCIAL" ? "26" : preset === "HIGH_QUALITY" ? "18" : "22";
    const maxrate = preset === "SOCIAL" ? "5M" : preset === "HIGH_QUALITY" ? "14M" : "8M";
    args.push("-c:v","libx264","-preset","veryfast","-crf",crf,"-maxrate",maxrate,"-bufsize",preset === "SOCIAL" ? "10M" : preset === "HIGH_QUALITY" ? "28M" : "16M","-pix_fmt","yuv420p");
    if (hasAudio) args.push("-c:a","aac","-b:a",preset === "SOCIAL" ? "128k" : "192k");
    args.push("-movflags","+faststart","-y",output);
    try {
      const result = await engine.exec(args);
      if (result !== 0) throw new Error("NEXUS could not assemble the full timeline. Check the source codec and clip ranges.");
      const data = await engine.readFile(output);
      onProgress?.(1);
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      return new Blob([buffer], { type: "video/mp4" });
    } finally {
      await cleanup();
    }
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
    for(const path of inputs) await engine.deleteFile(path).catch(() => undefined);
    await engine.deleteFile(output).catch(() => undefined);
  }
}
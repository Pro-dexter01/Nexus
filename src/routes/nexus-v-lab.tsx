/* NEXUS consolidated deployment: includes the complete editor, timeline, effect-stack, graph, color, and export workspaces. */
import { useEffect, useMemo, useRef, useState, type RefObject, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeftRight, AudioLines, AudioWaveform, Brush, Captions, ChevronDown, Clapperboard, Crop,
  Database, Download, Eraser, Film, FlipHorizontal, FlipVertical, Gauge, GaugeIcon, Image,
  Layers3, Maximize2, Menu, MoreHorizontal, MousePointer2, Music2, Palette, Pause, Play, Plus,
  RotateCcw, ScanSearch, Scissors, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Split,
  Square, Sticker, Trash2, Type, Undo2, Redo2, FileInput, Volume2, VolumeX, Wand2, WandSparkles, X
} from "lucide-react";
import type { SpeedPoint } from "@/lib/nexus-render-v2";
import { NexusEditorDashboard } from "@/components/nexus-editor-dashboard";
import { listNexusProjects, requestNexusPersistentStorage, type NexusProject } from "@/lib/nexus-storage";

const MAX = 650 * 1024 * 1024;
type Tool =
  | "MEDIA" | "EDIT" | "AUDIO" | "TEXT" | "STICKERS" | "EFFECTS" | "TRANSITIONS"
  | "FILTERS" | "ADJUST" | "COLOR" | "SPEED" | "ANIMATION" | "MASK" | "LAYERS" | "GRAPH"
  | "CAPTIONS" | "TRACKING" | "REMOVE_BG" | "RETOUCH" | "TRANSFORM" | "STABILIZE" | "KEYFRAMES"
  | "STOCK" | "SOUND_FX" | "VOICE" | "ENHANCE";
type Effect = "NONE" | "GLOW" | "RGB" | "GLITCH" | "SHAKE" | "BLUR" | "CHROMA" | "VIGNETTE" | "GRAIN" | "WARP" | "ZOOM" | "FLASH" | "BLOOM" | "SCAN" | "NOISE" | "PIXEL" | "EDGE" | "INVERT" | "SEPIA" | "THERMAL" | "DREAM" | "TILT";
type MediaAsset = { id:string; name:string; file:File; url:string; duration:number };
type Clip = { id: string; mediaId:string; name: string; start: number; end: number; sourceStart: number; sourceEnd: number; color: string; reverse?: boolean; freezeAt?: number; freezeDuration?: number; speed?: number };
type BeatMarker = { id: string; time: number; strength: "strong" | "beat"; label?: string };
type EffectLayer = { id: string; effect: Effect; enabled: boolean; opacity: number };

const beginnerTools: { id: Tool; label: string }[] = ([
  ["MEDIA","Media"],["EDIT","Edit"],["AUDIO","Audio"],["TEXT","Text"],["STICKERS","Stickers"],
  ["EFFECTS","Effects"],["TRANSITIONS","Transitions"],["FILTERS","Filters"],["ADJUST","Adjust"],
  ["TRANSFORM","Transform"],["SPEED","Speed"],["ANIMATION","Animation"],["CAPTIONS","Captions"],
  ["MASK","Mask"],["REMOVE_BG","Remove BG"],["RETOUCH","Retouch"],["STABILIZE","Stabilize"],
  ["ENHANCE","Enhance"],["VOICE","Voice"],["SOUND_FX","Sound FX"],["STOCK","Stock"],
] as const).map(([id,label]) => ({id:id as Tool,label}));

const advancedTools: { id: Tool; label: string }[] = ([
  ["TRANSFORM","Transform"],["KEYFRAMES","Keyframes"],["GRAPH","Graph Editor"],["MASK","Advanced Mask"],
  ["TRACKING","Tracking"],["LAYERS","Compositing"],["COLOR","Color"],
  ["EFFECTS","Advanced Effects"],["ANIMATION","Motion"],["CAPTIONS","Text Animation"],
  ["AUDIO","Advanced Audio"],["ENHANCE","Advanced Enhance"],
] as const).map(([id,label]) => ({id:id as Tool,label}));

const tools = beginnerTools;

const effects: Effect[] = ["GLOW","RGB","GLITCH","SHAKE","BLUR","CHROMA","VIGNETTE","GRAIN","WARP","ZOOM","FLASH","BLOOM","SCAN","NOISE","PIXEL","EDGE","INVERT","SEPIA","THERMAL","DREAM","TILT"];
const effectNames: Record<string,string> = { GLOW:"Glow",RGB:"RGB Split",GLITCH:"Glitch",SHAKE:"Shake",BLUR:"Blur",CHROMA:"Chromatic",VIGNETTE:"Vignette",GRAIN:"Film Grain",WARP:"Warp",ZOOM:"Zoom Punch",FLASH:"Flash",BLOOM:"Bloom",SCAN:"Scanlines",NOISE:"Noise",PIXEL:"Pixelate",EDGE:"Edge",INVERT:"Invert",SEPIA:"Sepia",THERMAL:"Thermal",DREAM:"Dream",TILT:"Tilt Shift" };

export default function NexusVLab() {
  const [file,setFile] = useState<File|null>(null);
  const [mediaAssets,setMediaAssets] = useState<MediaAsset[]>([]);
  const [src,setSrc] = useState<string|null>(null);
  const [output,setOutput] = useState<string|null>(null);
  const [tool,setTool] = useState<Tool>("EDIT");
  const [editingLevel,setEditingLevel] = useState<"BEGINNER"|"ADVANCED">("BEGINNER");
  const [subTool,setSubTool] = useState("Select");
  const [projects,setProjects] = useState<Omit<NexusProject,"file">[]>([]);
  const [mediaCollapsed,setMediaCollapsed] = useState(false);
  const [playing,setPlaying] = useState(false);
  const [muted,setMuted] = useState(false);
  const [playhead,setPlayhead] = useState(0);
  const [duration,setDuration] = useState(1);
  const [clips,setClips] = useState<Clip[]>([]);
  const [sceneThumbs,setSceneThumbs] = useState<string[]>([]);
  const [activeClip,setActiveClip] = useState<string|null>(null);
  const [effect,setEffect] = useState<Effect>("NONE");
  const [effectStack,setEffectStack] = useState<EffectLayer[]>([]);
  const [speed,setSpeed] = useState(1);
  const [speedRamp,setSpeedRamp] = useState<SpeedPoint[]>([{position:0,speed:1},{position:.35,speed:1},{position:.55,speed:2},{position:.75,speed:.5},{position:1,speed:1}]);
  const [volume,setVolume] = useState(100);
  const [pan,setPan] = useState(0); const [bass,setBass] = useState(0); const [treble,setTreble] = useState(0); const [compress,setCompress] = useState(0); const [audioFadeIn,setAudioFadeIn] = useState(0); const [audioFadeOut,setAudioFadeOut] = useState(0); const [normalizeAudio,setNormalizeAudio] = useState(false);
  const [adjustment,setAdjustment] = useState({exposure:0,brightness:0,contrast:0,saturation:0,vibrance:0,temperature:0,tint:0,highlights:0,shadows:0,whites:0,blacks:0,clarity:0,texture:0,dehaze:0,sharpness:0,fade:0,vignette:0,grain:0,red:0,green:0,blue:0,structure:0,lift:0,gamma:0,gain:0,midtones:0});
  const [blur,setBlur] = useState(0);
  const [scale,setScale] = useState(100);
  const [posX,setPosX] = useState(0); const [posY,setPosY] = useState(0); const [rotation,setRotation] = useState(0); const [scaleX,setScaleX] = useState(100); const [scaleY,setScaleY] = useState(100); const [anchorX,setAnchorX] = useState(0); const [anchorY,setAnchorY] = useState(0); const [skew,setSkew] = useState(0); const [flipX,setFlipX] = useState(false); const [flipY,setFlipY] = useState(false);
  const [upscale,setUpscale] = useState(100);
  const [opacity,setOpacity] = useState(100);
  const [targetFps,setTargetFps] = useState(60);
  const [enhance,setEnhance] = useState(false);
  const [compression,setCompression] = useState<"SOCIAL"|"BALANCED"|"HIGH_QUALITY">("BALANCED");
  const [text,setText] = useState("");
  const [mask,setMask] = useState<"NONE"|"RECT"|"CIRCLE">("NONE");
  const [maskFeather,setMaskFeather] = useState(0);
  const [blendMode,setBlendMode] = useState("normal");
  const [chromaKey,setChromaKey] = useState(false);
  const [chromaColor,setChromaColor] = useState("#00ff00");
  const [chromaSimilarity,setChromaSimilarity] = useState(0.28);
  const [chromaBlend,setChromaBlend] = useState(0.08);
  const [backgroundRemoved,setBackgroundRemoved] = useState(false);
  const [keyframes,setKeyframes] = useState<{time:number;value:number;property:string}[]>([]);
  const [processing,setProcessing] = useState(false);
  const [progress,setProgress] = useState(0);
  const [error,setError] = useState("");
  const [mobilePanel,setMobilePanel] = useState(false);
  const [autoEditOpen,setAutoEditOpen] = useState(false);
  const [exportOpen,setExportOpen] = useState(false);
  const [exportPlatform,setExportPlatform] = useState("TIKTOK");
  const [exportQuality,setExportQuality] = useState("BALANCED");
  const [qualityShield,setQualityShield] = useState(true);
  const [mediaDragging,setMediaDragging] = useState(false);
  const [beatMarkers,setBeatMarkers] = useState<BeatMarker[]>([]);
  const [waveform,setWaveform] = useState<number[]>([]);
  const [bpm,setBpm] = useState(0);
  const [timelineZoom,setTimelineZoom] = useState(1);
  const [trackState,setTrackState] = useState({videoVisible:true,videoLocked:false,audioMuted:false,audioLocked:false});
  const [rangeStart,setRangeStart] = useState<number|null>(null);
  const [rangeEnd,setRangeEnd] = useState<number|null>(null);
  const [selectedProperty,setSelectedProperty] = useState("scale");
  const [isMobile,setIsMobile] = useState(false);
  useEffect(()=>{const update=()=>setIsMobile(window.innerWidth<768);update();window.addEventListener("resize",update);return()=>window.removeEventListener("resize",update)},[]);
  const fileRef = useRef<HTMLInputElement>(null);
  const addFileRef = useRef<HTMLInputElement>(null);
  const pendingSeekRef = useRef<number|null>(null);
  const resumeAfterSourceLoad = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const draggingPlayhead = useRef(false);

  useEffect(()=>{ void requestNexusPersistentStorage(); void listNexusProjects().then(setProjects).catch(()=>undefined); },[]);
  useEffect(()=>{
    if(!file)return;
    // Keep import lightweight. Decoding a 650 MB video with Web Audio can allocate another
    // full-size ArrayBuffer and crash the browser before the editor has mounted.
    setWaveform(Array.from({length:180},(_,i)=>.2+.22*Math.abs(Math.sin(i*.37))));
    setBeatMarkers([]);
    setBpm(0);
  },[file]);

  useEffect(()=>{
    if(!src)return;
    // The editor video element is the single media decoder. Avoid creating a second
    // decoder for large local files during import.
    setSceneThumbs([]);
  },[src]);
  useEffect(()=>{
    const move=(e:PointerEvent)=>{
      if(!draggingPlayhead.current || !timelineRef.current) return;
      const r=timelineRef.current.getBoundingClientRect();
      const p=Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100));
      setPlayhead(p);
      seek(p);
    };
    const up=()=>{draggingPlayhead.current=false;};
    window.addEventListener("pointermove",move); window.addEventListener("pointerup",up);
    return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);};
  },[duration]);

  const active = clips.find(c=>c.id===activeClip) ?? clips[0];
  const animatedValue=(property:string,fallback:number)=>{
    const points=keyframes.filter(k=>k.property===property).sort((a,b)=>a.time-b.time);
    if(!points.length)return fallback;
    const t=playhead/100*duration;
    const first=points[0],last=points[points.length-1];
    if(!first||!last)return fallback;
    if(t<=first.time)return first.value;
    if(t>=last.time)return last.value;
    for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];if(!a||!b)continue;if(t<=b.time){const q=(t-a.time)/Math.max(.001,b.time-a.time);return a.value+(b.value-a.value)*q;}}
    return fallback;
  };
  const currentAnimatedScale=animatedValue("scale",scale);
  const currentAnimatedOpacity=animatedValue("opacity",opacity);
  const currentAnimatedBlur=animatedValue("blur",blur);
  const currentAnimatedRotation=animatedValue("rotation",rotation);
  const currentAnimatedPosX=animatedValue("positionX",posX);
  const currentAnimatedPosY=animatedValue("positionY",posY);
  const currentAnimatedVolume=animatedValue("volume",volume);

  const readDuration=(source:File)=>new Promise<number>((resolve)=>{
    const probe=document.createElement("video");const url=URL.createObjectURL(source);
    probe.preload="metadata";probe.onloadedmetadata=()=>{const d=Number.isFinite(probe.duration)?probe.duration:1;URL.revokeObjectURL(url);resolve(Math.max(.1,d));};
    probe.onerror=()=>{URL.revokeObjectURL(url);resolve(1);};probe.src=url;
  });
  const chooseFile=(next?:File)=>{
    if(!next)return;
    const name=next.name.toLowerCase();
    const isVideo=next.type.startsWith("video/") || /\.(mp4|mov|webm|m4v|avi|mkv|mpeg|mpg|3gp)$/i.test(name);
    if(!isVideo){setError("Choose a supported video file (MP4, MOV, WEBM, M4V, AVI, MKV, MPEG or 3GP).");return;}
    if(next.size>MAX){setError("NEXUS V LAB supports files up to 650 MB.");return;}
    const url=URL.createObjectURL(next),id=crypto.randomUUID();
    mediaAssets.forEach(asset=>URL.revokeObjectURL(asset.url));
    setMediaAssets([{id,name:next.name,file:next,url,duration:1}]);
    setError("");setOutput(null);setPlaying(false);setPlayhead(0);setDuration(1);
    setBeatMarkers([]);setWaveform([]);setBpm(0);
    setSceneThumbs(previous=>{previous.forEach(u=>URL.revokeObjectURL(u));return[]});
    setClips([{id:crypto.randomUUID(),mediaId:id,name:next.name,start:0,end:100,sourceStart:0,sourceEnd:100,color:"#9a6574"}]);
    setActiveClip(null);setFile(next);setSrc(url);
    void readDuration(next).then(d=>{setDuration(d);setMediaAssets(current=>current.map(a=>a.id===id?{...a,duration:d}:a));});
  };
  const addMediaFile=async(next?:File)=>{
    if(!next)return;
    if(!next.type.startsWith("video/")){setError("Additional timeline media must be a supported video file.");return;}
    if(next.size>MAX){setError("Each source file must be 650 MB or smaller.");return;}
    if(mediaAssets.some(a=>a.name===next.name&&a.file.size===next.size)){setError("That source is already in the media bin.");return;}
    const d=await readDuration(next),id=crypto.randomUUID(),url=URL.createObjectURL(next);
    setMediaAssets(current=>[...current,{id,name:next.name,file:next,url,duration:d}]);
    setOutput(null);setError("");
  };
  const addAssetToTimeline=(id:string)=>{
    const asset=mediaAssets.find(a=>a.id===id);if(!asset)return;
    if(clips.some(c=>c.mediaId===id)){setError("This media is already on the timeline.");return;}
    const previousDuration=Math.max(.1,duration),nextDuration=previousDuration+asset.duration,ratio=previousDuration/nextDuration,clipId=crypto.randomUUID();
    setClips(current=>[...current.map(c=>({...c,start:c.start*ratio,end:c.end*ratio})),{id:clipId,mediaId:id,name:asset.name,start:ratio*100,end:100,sourceStart:0,sourceEnd:100,color:"#638a9a"}]);
    setDuration(nextDuration);setFile(asset.file);pendingSeekRef.current=0;resumeAfterSourceLoad.current=false;setSrc(asset.url);setActiveClip(clipId);setPlayhead(ratio*100);setOutput(null);setError("");
  };
  const activateClip=(clip:Clip)=>{
    const asset=mediaAssets.find(a=>a.id===clip.mediaId);if(!asset)return;
    setActiveClip(clip.id);setFile(asset.file);
    if(src!==asset.url){pendingSeekRef.current=clip.sourceStart/100*asset.duration;resumeAfterSourceLoad.current=playing;setSrc(asset.url);}
    else if(videoRef.current)videoRef.current.currentTime=clip.sourceStart/100*asset.duration;
  };
  const onVideoMetadata=()=>{
    const pending=pendingSeekRef.current;
    if(pending!==null&&videoRef.current){videoRef.current.currentTime=pending;pendingSeekRef.current=null;if(resumeAfterSourceLoad.current){void videoRef.current.play();setPlaying(true);resumeAfterSourceLoad.current=false;}}
  };
  const openProject=async(id:string)=>{
    const {getNexusProject}=await import("@/lib/nexus-storage");
    const p=await getNexusProject(id); if(p)chooseFile(new File([p.file],p.fileName,{type:p.fileType}));
  };
  const seek=(p:number)=>{
    const next=Math.max(0,Math.min(100,p));
    setPlayhead(next);
    if(output&&videoRef.current&&duration){videoRef.current.currentTime=duration*next/100;return;}
    const ordered=[...clips].sort((a,b)=>a.start-b.start);
    const clip=ordered.find(c=>next>=c.start&&next<=c.end)??ordered.reduce<Clip|undefined>((best,c)=>!best||Math.abs(c.start-next)<Math.abs(best.start-next)?c:best,undefined);
    if(clip){
      setActiveClip(clip.id);
      const local=Math.max(0,Math.min(1,(next-clip.start)/Math.max(.001,clip.end-clip.start)));
      const sourcePct=clip.sourceStart+(clip.sourceEnd-clip.sourceStart)*local;
      const asset=mediaAssets.find(a=>a.id===clip.mediaId);if(asset){setFile(asset.file);if(src!==asset.url){pendingSeekRef.current=sourcePct/100*asset.duration;resumeAfterSourceLoad.current=playing;setSrc(asset.url);}else if(videoRef.current)videoRef.current.currentTime=sourcePct/100*asset.duration;}
    }
  };
  const syncPreviewTime=(sourceTime:number)=>{
    if(output){setPlayhead(duration?sourceTime/duration*100:0);return;}
    const ordered=[...clips].sort((a,b)=>a.start-b.start);
    const current=ordered.find(c=>c.id===activeClip)??ordered[0];
    if(!current||!duration)return;
    const asset=mediaAssets.find(a=>a.id===current.mediaId);if(!asset)return;
    const sourceStart=current.sourceStart/100*asset.duration;
    const sourceEnd=current.sourceEnd/100*asset.duration;
    if(sourceTime>=sourceEnd-.04){
      const index=ordered.findIndex(c=>c.id===current.id);
      const next=ordered[index+1];
      if(next&&videoRef.current){
        const nextAsset=mediaAssets.find(a=>a.id===next.mediaId);if(!nextAsset)return;
        setActiveClip(next.id);setFile(nextAsset.file);setPlayhead(next.start);
        if(src!==nextAsset.url){pendingSeekRef.current=next.sourceStart/100*nextAsset.duration;resumeAfterSourceLoad.current=true;setSrc(nextAsset.url);}else videoRef.current.currentTime=next.sourceStart/100*nextAsset.duration;
      }else{
        setPlayhead(current.end);
        videoRef.current?.pause();
        setPlaying(false);
      }
      return;
    }
    const local=Math.max(0,Math.min(1,(sourceTime-sourceStart)/Math.max(.001,sourceEnd-sourceStart)));
    setPlayhead(current.start+local*(current.end-current.start));
  };
  const split=()=>{
    if(!active)return;
    const local=Math.max(0,Math.min(1,(playhead-active.start)/Math.max(.001,active.end-active.start)));
    const cutTimeline=active.start+local*(active.end-active.start);
    const cutSource=active.sourceStart+local*(active.sourceEnd-active.sourceStart);
    if(cutTimeline<=active.start+.5||cutTimeline>=active.end-.5)return;
    const a={...active,id:crypto.randomUUID(),end:cutTimeline,sourceEnd:cutSource};
    const b={...active,id:crypto.randomUUID(),start:cutTimeline,sourceStart:cutSource};
    setClips(cs=>cs.flatMap(x=>x.id===active.id?[a,b]:[x]).sort((x,y)=>x.start-y.start));setActiveClip(b.id);
  };
  const markIn=()=>setRangeStart(playhead);
  const markOut=()=>setRangeEnd(playhead);
  const normalizedRange=()=>{
    if(rangeStart===null||rangeEnd===null)return null;
    return rangeStart<=rangeEnd?[rangeStart,rangeEnd]:[rangeEnd,rangeStart];
  };
  const cutRange=()=>{
    if(!active)return;
    const r=normalizedRange();
    if(!r){setError("Set MARK IN and MARK OUT before using CUT.");return;}
    const [rs,re]=r;
    const s=Math.max(active.start,rs), e=Math.min(active.end,re);
    if(e-s<.5)return;
    const span=active.end-active.start, srcSpan=active.sourceEnd-active.sourceStart;
    const leftRatio=(s-active.start)/Math.max(.001,span), rightRatio=(e-active.start)/Math.max(.001,span);
    const left=s>active.start+.01?{...active,id:crypto.randomUUID(),end:s,sourceEnd:active.sourceStart+srcSpan*leftRatio}:null;
    const right=e<active.end-.01?{...active,id:crypto.randomUUID(),start:e,sourceStart:active.sourceStart+srcSpan*rightRatio}:null;
    setClips(cs=>cs.flatMap(x=>x.id===active.id?[...(left?[left]:[]),...(right?[right]:[])]:[x]).sort((a,b)=>a.start-b.start));
    setActiveClip(right?.id??left?.id??null);
  };
  const rippleDelete=()=>{
    const r=normalizedRange();
    if(r){
      const [rs,re]=r, gap=re-rs;
      if(gap<.01)return;
      setClips(cs=>cs.flatMap(c=>{
        if(c.end<=rs)return [c];
        if(c.start>=re)return [{...c,start:c.start-gap,end:c.end-gap}];
        const span=c.end-c.start, srcSpan=c.sourceEnd-c.sourceStart;
        const pieces:Clip[]=[];
        if(c.start<rs){const ratio=(rs-c.start)/Math.max(.001,span);pieces.push({...c,id:crypto.randomUUID(),end:rs,sourceEnd:c.sourceStart+srcSpan*ratio});}
        if(c.end>re){const ratio=(re-c.start)/Math.max(.001,span);pieces.push({...c,id:crypto.randomUUID(),start:rs,end:c.end-gap,sourceStart:c.sourceStart+srcSpan*ratio});}
        return pieces;
      }).sort((a,b)=>a.start-b.start));
      setRangeStart(null);setRangeEnd(null);setPlayhead(Math.min(100,rs));
      return;
    }
    if(!active)return;
    const width=active.end-active.start;
    setClips(cs=>cs.filter(c=>c.id!==active.id).map(c=>c.start>active.end?{...c,start:c.start-width,end:c.end-width}:c).sort((a,b)=>a.start-b.start));
    setActiveClip(null);
  };
  const trimToPlayhead=(side:"start"|"end")=>{
    if(!active)return;
    if(playhead<=active.start||playhead>=active.end){setError("Place the playhead inside the selected clip to trim.");return;}
    const span=active.end-active.start, srcSpan=active.sourceEnd-active.sourceStart, ratio=(playhead-active.start)/Math.max(.001,span);
    setClips(cs=>cs.map(c=>{
      if(c.id!==active.id)return c;
      return side==="start"
        ? {...c,start:playhead,sourceStart:c.sourceStart+srcSpan*ratio}
        : {...c,end:playhead,sourceEnd:c.sourceStart+srcSpan*ratio};
    }));
  };
  const addManualBeat=()=>{const time=playhead/100*duration;setBeatMarkers(m=>[...m,{id:crypto.randomUUID(),time,strength:"beat" as const,label:"MARK"}].sort((a,b)=>a.time-b.time));};
  const clearBeatMarkers=()=>setBeatMarkers([]);
  const autoBeatMarkers=()=>{setSubTool("Auto Beat Markers");if(!beatMarkers.length)setError("No strong beat peaks were detected. Add a marker manually or use a music track with clearer transients.");};
  const deleteClip=()=>{if(!activeClip)return;setClips(c=>{const n=c.filter(x=>x.id!==activeClip);setActiveClip(n[0]?.id??null);return n;});};
  const duplicateClip=()=>{const s=clips.find(c=>c.id===activeClip);if(!s)return;const w=s.end-s.start,start=Math.min(100-w,s.end+1),copy={...s,id:crypto.randomUUID(),start,end:start+w};setClips(c=>[...c,copy].sort((a,b)=>a.start-b.start));setActiveClip(copy.id);};
  const reverseClip=()=>{if(!activeClip)return;setClips(cs=>cs.map(c=>c.id===activeClip?{...c,reverse:!c.reverse}:c));};
  const freezeFrame=()=>{if(!active)return;const at=Math.max(0,Math.min(1,(playhead-active.start)/Math.max(.001,active.end-active.start)));const sourceAt=active.sourceStart+at*(active.sourceEnd-active.sourceStart);const existing=active.freezeDuration??0;setClips(cs=>cs.map(c=>c.id===activeClip?{...c,freezeAt:sourceAt,freezeDuration:existing>0?0:1.5}:c));};
  const setFreezeDuration=(seconds:number)=>{if(!activeClip)return;setClips(cs=>cs.map(c=>c.id===activeClip?{...c,freezeDuration:Math.max(0,seconds)}:c));};
  const resetAdjustments=()=>setAdjustment({exposure:0,brightness:0,contrast:0,saturation:0,vibrance:0,temperature:0,tint:0,highlights:0,shadows:0,whites:0,blacks:0,clarity:0,texture:0,dehaze:0,sharpness:0,fade:0,vignette:0,grain:0,red:0,green:0,blue:0,structure:0,lift:0,gamma:0,gain:0,midtones:0});
  const addKeyframe=()=>{
    const t=playhead/100*duration;
    const value = selectedProperty==="scale"?scale:selectedProperty==="opacity"?opacity:selectedProperty==="blur"?blur:selectedProperty==="rotation"?rotation:selectedProperty==="positionX"?posX:selectedProperty==="positionY"?posY:selectedProperty==="volume"?volume:scale;
    setKeyframes(k=>[...k.filter(x=>!(x.property===selectedProperty&&Math.abs(x.time-t)<.03)),{time:t,value,property:selectedProperty}].sort((a,b)=>a.time-b.time));
  };
  const updateRamp=(index:number,patch:Partial<SpeedPoint>)=>setSpeedRamp(r=>r.map((p,i)=>i===index?{...p,...patch}:p));
  const selectEffect=(next:Effect)=>{setEffect(next);if(next!=="NONE")setEffectStack(current=>current.some(x=>x.effect===next)?current:[...current,{id:crypto.randomUUID(),effect:next,enabled:true,opacity:100}]);};
  const updateEffectLayer=(id:string,patch:Partial<EffectLayer>)=>setEffectStack(current=>current.map(x=>x.id===id?{...x,...patch}:x));
  const removeEffectLayer=(id:string)=>setEffectStack(current=>{const next=current.filter(x=>x.id!==id);const last=next[next.length-1];setEffect(last?.effect??"NONE");return next;});

  const process=async(mode:"export"|"enhance")=>{
    if(!file)return;
    setProcessing(true);setProgress(0);setError("");setOutput(null);
    try{
      const renderCompression=mode==="enhance"?compression:(exportQuality==="MAXIMUM"?"HIGH_QUALITY":exportQuality==="SMALLER"?"SOCIAL":compression);
      const { renderNexusVideoV2 } = await import("@/lib/nexus-render-v2");
      const blob=await renderNexusVideoV2(mediaAssets.length?mediaAssets.map(a=>a.file):file,{
        timelineSegments:clips.map(c=>({id:c.id,start:c.start,sourceStart:c.sourceStart,sourceEnd:c.sourceEnd,inputIndex:Math.max(0,mediaAssets.findIndex(a=>a.id===c.mediaId)),sourceDuration:mediaAssets.find(a=>a.id===c.mediaId)?.duration??duration,speed:c.speed??speed,reverse:c.reverse??false,freezeAt:c.freezeAt,freezeDuration:c.freezeDuration??0})),
        trimStart:active?.sourceStart??0,trimEnd:active?.sourceEnd??100,speed:active?.speed??speed,speedRamp:tool==="SPEED"?speedRamp:[],reverse:active?.reverse??false,freezeAt:active?.freezeAt,freezeDuration:active?.freezeDuration,
        volume:currentAnimatedVolume,muted,pan,bass,treble,compress,audioFadeIn,audioFadeOut,normalizeAudio,opacity:currentAnimatedOpacity,blur:currentAnimatedBlur,blendMode,maskType:mask,maskFeather,effect:chromaKey?"CHROMA":effect,effects:effectStack.filter(x=>x.enabled).map(x=>({effect:x.effect,enabled:x.enabled,opacity:x.opacity})),chromaColor,chromaSimilarity,chromaBlend,...adjustment,scale:currentAnimatedScale,scaleX,scaleY,positionX:currentAnimatedPosX,positionY:currentAnimatedPosY,rotation:currentAnimatedRotation,flipX,flipY,skew,upscale:mode==="enhance"?upscale:100,
        targetFps,enhance:mode==="enhance"||enhance,compression:renderCompression,durationSeconds:duration
      },setProgress);
      setOutput(URL.createObjectURL(blob));
    }catch(e){setError(e instanceof Error?e.message:"Render failed.");}
    finally{setProcessing(false);}
  };

  if(!file)return <Landing projects={projects} onPick={()=>fileRef.current?.click()} onOpen={openProject} fileRef={fileRef} onChoose={chooseFile}/>;
  return <NexusEditorDashboard p={{file,mediaAssets,addMediaFile,addAssetToTimeline,onVideoMetadata,src,output,videoRef,duration,setDuration,playhead,setPlayhead,seek,playing,setPlaying,muted,setMuted,tool,subTool,setTool,setSubTool,clips,setClips,activeClip,setActiveClip,effect,setEffect:selectEffect,effectStack,updateEffectLayer,removeEffectLayer,speed,setSpeed,speedRamp,updateRamp,volume,setVolume,pan,setPan,bass,setBass,treble,setTreble,adjustment,setAdjustment,resetAdjustments,text,setText,mask,setMask,maskFeather,setMaskFeather,blendMode,setBlendMode,chromaKey,setChromaKey,chromaColor,setChromaColor,scale,setScale,posX,setPosX,posY,setPosY,rotation,setRotation,scaleX,setScaleX,scaleY,setScaleY,opacity,setOpacity,keyframes,addKeyframe,setKeyframes,selectedProperty,setSelectedProperty,waveform,beatMarkers,addManualBeat,autoBeatMarkers,clearBeatMarkers,targetFps,setTargetFps,enhance,setEnhance,compression,setCompression,processing,progress,process,error,setError,split,deleteClip,duplicateClip,cutRange,rippleDelete,trimToPlayhead,reverseClip,freezeFrame,markIn,markOut,rangeStart,rangeEnd,mediaCollapsed,setMediaCollapsed,fileRef,addFileRef,onReplaceFile:chooseFile,onAddMediaFile:addMediaFile,onActivateClip:activateClip,syncPreviewTime}}/>;

  const visualStyle={
    opacity:opacity/100,
    filter:`brightness(${100+(adjustment.exposure*0.55)+adjustment.brightness+(adjustment.shadows*0.12)+(adjustment.highlights*0.06)+(adjustment.whites*0.08)+(adjustment.blacks*0.08)}%) contrast(${100+adjustment.contrast+(adjustment.structure*0.12)+(adjustment.clarity*0.08)+(adjustment.dehaze*0.08)}%) saturate(${100+adjustment.saturation+adjustment.vibrance*0.35+adjustment.texture*0.08}%) hue-rotate(${adjustment.tint*0.25+adjustment.temperature*0.08}deg) sepia(${Math.max(0,adjustment.temperature)/700}%) blur(${blur}px)`,
    transform:`translate(${posX/4}px,${posY/4}px) scale(${(currentAnimatedScale*scaleX)/10000},${scaleY/100}) rotate(${rotation}deg) skew(${skew}deg) ${effect==="ZOOM"?"scale(1.05)":""} ${effect==="SHAKE"?"translate(2px,-2px)":""}`,
    clipPath:mask==="RECT"?"inset(5% round 10px)":mask==="CIRCLE"?"circle(42% at 50% 50%)":"none",
  };

  return <main className="h-screen max-h-screen overflow-hidden bg-[#050204] text-[#e5e7eb] nx-shell-glow nx-desktop-shell">
    <style>{`
      :root{--nx-wine:#16070c;--nx-wine-2:#0b0307;--nx-wine-3:#241019;--nx-pearl:#bdb6b2;--nx-pearl-hi:#ded6cf;--nx-cream:#eee4d9;--nx-metal:#81797a;--nx-accent:#7a4d5a}
      .nx-shell-glow{box-shadow:inset 0 1px 0 #c7cbd114,0 0 50px #5b173022}

      .nx-scroll::-webkit-scrollbar{height:5px;width:5px}.nx-scroll::-webkit-scrollbar-thumb{background:#73798124;border-radius:99px}
      .nx-tool{min-width:58px;height:52px}.nx-tool.active{filter:brightness(1.06);border-color:#d0c4c4!important;box-shadow:inset 0 1px 0 rgba(255,248,239,.22),0 5px 16px rgba(42,18,27,.28)}.nx-grid{background-image:linear-gradient(#73798118 1px,transparent 1px),linear-gradient(90deg,#73798118 1px,transparent 1px);background-size:25px 25px}.nx-tool-icon{width:24px;height:22px;display:flex;align-items:center;justify-content:center}.nx-tool-label{font-size:6px;line-height:1;text-transform:uppercase;letter-spacing:.05em}
      /* NEXUS visual language: deep black-wine chrome + luminous pearl/metal controls. */
      :root{--nx-bg:#050204;--nx-wine:#11060a;--nx-wine-2:#0b0407;--nx-wine-3:#241019;--nx-pearl:#aeb6bf;--nx-pearl-hi:#e1e6eb;--nx-cream:#eef2f5;--nx-metal:#6f7781}
      .nx-shell-glow{box-shadow:inset 0 1px 0 rgba(238,228,217,.06),0 0 80px rgba(91,23,48,.24)}
      button:not([data-nx-ghost]){background:linear-gradient(180deg,#d7d0cc 0%,#b8afb0 24%,#8e777d 58%,#63444f 100%)!important;color:#21191c!important;border:1px solid rgba(235,226,220,.68)!important;box-shadow:inset 0 1px 0 rgba(255,250,246,.72),inset 0 -1px 0 rgba(55,25,34,.48),0 6px 18px rgba(0,0,0,.42);transition:transform 130ms ease,filter 150ms ease,box-shadow 150ms ease,border-color 150ms ease;cursor:pointer}
      button:not([data-nx-ghost]):hover{filter:brightness(1.07);border-color:rgba(245,236,228,.82)!important;box-shadow:inset 0 1px 0 rgba(255,250,245,.68),inset 0 -1px 0 rgba(58,27,36,.32),0 8px 22px rgba(58,20,32,.34);transform:translateY(-1px)}
      button:not([data-nx-ghost]):active{filter:brightness(.91);transform:translateY(1px) scale(.985);box-shadow:inset 0 2px 6px rgba(45,20,28,.38),0 3px 8px rgba(0,0,0,.4)}
      button:not([data-nx-ghost]):focus-visible{outline:2px solid rgba(238,228,217,.72);outline-offset:2px}
      button[data-nx-ghost]{cursor:ew-resize;background:transparent!important;border:0!important;box-shadow:none!important}
      .nx-button-surface{background:linear-gradient(180deg,#d7d0cc 0%,#b8afb0 24%,#8e777d 58%,#63444f 100%)!important;color:#21191c!important;border:1px solid rgba(235,226,220,.68)!important;box-shadow:inset 0 1px 0 rgba(255,250,246,.72),inset 0 -1px 0 rgba(55,25,34,.48),0 6px 18px rgba(0,0,0,.42)!important}
      .nx-button-surface:hover{filter:brightness(1.07);transform:translateY(-1px)}
      .nx-button-surface:active{filter:brightness(.91);transform:translateY(1px) scale(.985)}
      @keyframes nxshake{0%,100%{translate:0}50%{translate:3px -2px}} .nx-shake{animation:nxshake .12s infinite}
      /* NEXUS premium editor chrome — fintech precision + professional post-production. */
      .nx-desktop-shell{background:radial-gradient(900px 520px at 50% -12%,rgba(139,65,88,.22),transparent 62%),radial-gradient(520px 420px at 96% 55%,rgba(54,76,96,.12),transparent 70%),#060709}
      .nx-desktop-toolbar{background:linear-gradient(180deg,#111419,#090b0f);border-color:rgba(225,232,238,.10)!important;box-shadow:0 1px 0 rgba(255,255,255,.025),0 12px 35px rgba(0,0,0,.24)}
      .nx-panel-title{font-size:7px;letter-spacing:.18em;font-weight:900;color:#e6ebef}
      .nx-inspector-rail{background:linear-gradient(180deg,#0d1014,#080a0d);box-shadow:inset 1px 0 0 rgba(231,237,242,.06),-18px 0 42px rgba(0,0,0,.28)}
      .nx-section-card{background:linear-gradient(180deg,rgba(20,24,29,.96),rgba(10,12,15,.98));border:1px solid rgba(225,232,238,.10);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.24)}
      .nx-metal-line{height:1px;background:linear-gradient(90deg,transparent,rgba(214,222,229,.24),transparent)}
      .nx-auto-edit{background:linear-gradient(135deg,#f1eee9,#b7a8ac 48%,#6e4b59);color:#171a1d;border:1px solid rgba(245,241,235,.55);box-shadow:0 10px 30px rgba(88,38,57,.30),inset 0 1px 0 rgba(255,255,255,.65)}
      .nx-auto-edit:hover{filter:brightness(1.08);transform:translateY(-1px)}
      .nx-mobile-toolbar{background:linear-gradient(180deg,#101318,#080a0d);box-shadow:0 -10px 30px rgba(0,0,0,.22)}
      .nx-mobile-tool{min-width:64px;height:58px;border:1px solid rgba(224,231,236,.08);background:linear-gradient(180deg,rgba(24,29,34,.94),rgba(13,16,20,.94));border-radius:13px}
      .nx-mobile-tool-active{background:linear-gradient(180deg,#47202f,#21121a);border-color:rgba(231,204,214,.45);box-shadow:0 7px 22px rgba(80,30,50,.34)}
      .nx-mobile-sheet{background:linear-gradient(180deg,#171b20,#090b0e 72%);border:1px solid rgba(224,231,236,.12);box-shadow:0 -20px 55px rgba(0,0,0,.64)}
      .nx-graph-grid{background-image:linear-gradient(rgba(210,220,228,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(210,220,228,.07) 1px,transparent 1px);background-size:24px 24px}
      .nx-fintech-card{background:linear-gradient(145deg,rgba(24,29,35,.94),rgba(12,15,19,.98));border:1px solid rgba(225,232,238,.10);box-shadow:0 10px 30px rgba(0,0,0,.22)}
      .nx-kpi{font-variant-numeric:tabular-nums;letter-spacing:.02em}
      .nx-viewer-shell{background:radial-gradient(ellipse at center,rgba(42,49,58,.24),transparent 62%),#07090c;border:1px solid rgba(224,231,236,.08);box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 18px 50px rgba(0,0,0,.22)}
      .nx-timeline-shell{background:linear-gradient(180deg,#0c0f13,#07090c);border-top:1px solid rgba(224,231,236,.10);box-shadow:0 -14px 36px rgba(0,0,0,.22)}
      .nx-timeline-ruler{background:linear-gradient(180deg,rgba(255,255,255,.025),transparent)}
      @media(max-width:767px){
        .nx-mobile-editor{font-family:Inter,system-ui,sans-serif}
        .nx-mobile-preview{background:radial-gradient(circle at 50% 50%,#242a31,#080a0d 72%)}
        .nx-mobile-timeline{background:#07090c;border-top:1px solid rgba(224,231,236,.10)}
      }
    `}</style>
    <header className="h-[52px] shrink-0 border-b border-[#737981]/[.12] bg-[#0a0306] nx-desktop-toolbar">
      <div className="h-full flex items-center gap-4 px-4">
        <div className="flex items-center gap-3 shrink-0"><div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#eee9e4] via-[#9b8790] to-[#4e2b39] border border-white/20 flex items-center justify-center shadow-lg"><Film className="h-4 w-4 text-[#17191c]"/></div><div><b className="text-[11px] tracking-[.2em]">NEXUS</b><p className="text-[5px] tracking-[.22em] text-[#9da5ad]/60">CREATIVE FINANCE FOR YOUR FOOTAGE</p></div></div>
        <nav className="flex items-center gap-4 text-[8px] text-[#c7cbd1]/[.68]">
          {["File","Edit","Clip","Timeline","Layer","View","Window","Help"].map(x=><button key={x} data-nx-ghost="true" className="text-[#d7d0cc]/[.72] hover:text-[#f0e8e2]">{x}</button>)}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[7px] text-[#9da2a9]/[.65]"><span className="hidden xl:inline-flex items-center gap-1 rounded-full border border-emerald-300/15 bg-emerald-300/[.04] px-2 py-1 text-emerald-200/70">● LOCAL ENGINE</span><span>LOCAL PROJECT</span><button data-nx-ghost="true" className="px-2 py-1 rounded border border-[#737981]/[.16] text-[#d7d0cc]">100%</button><button onClick={()=>setExportOpen(true)} className="rounded-md border border-[#b8aeb3]/[.55] bg-[linear-gradient(180deg,#c8c9ca,#85878b)] px-3 py-1.5 font-black text-[#171318] shadow-[0_5px_16px_rgba(0,0,0,.32),inset_0_1px_0_rgba(255,255,255,.38)] hover:brightness-110">EXPORT</button><a href="/tools" className="h-7 w-7 rounded-md border border-[#737981]/[.16] flex items-center justify-center"><X className="h-3.5 w-3.5"/></a></div>
      </div>
      
    </header>

    <div className="h-[calc(100vh-52px)] min-h-0 grid grid-rows-[minmax(0,1fr)_228px]">
      <div className="min-h-0 grid grid-cols-[170px_minmax(0,1fr)_300px] max-lg:grid-cols-[1fr]">
        {!mediaCollapsed && <aside className="w-[150px] border-r border-[#737981]/[.14] bg-[#080306] p-3 max-lg:hidden">
          <div className="flex items-center justify-between mb-3"><span className="text-[8px] font-black tracking-[.2em] text-[#bfc4ca]/[.58]">MEDIA POOL</span><button onClick={()=>setMediaCollapsed(true)}><Menu className="h-4 w-4 text-[#bfc4ca]/[.58]"/></button></div>
          <button onClick={()=>fileRef.current?.click()} className="nx-button-surface w-full h-20 rounded-xl flex flex-col items-center justify-center text-[8px] font-black tracking-[.12em]"><Plus className="h-4 w-4 text-[#2a2023] mb-2"/>IMPORT MEDIA</button>
          <div draggable onDragStart={()=>setMediaDragging(true)} onDragEnd={()=>setMediaDragging(false)} className="mt-3 rounded-xl border border-[#737981]/[.16] p-2 cursor-grab active:cursor-grabbing"><div className="aspect-video w-full bg-[linear-gradient(145deg,#241019,#0d080b)] rounded-lg flex items-center justify-center border border-white/5"><Film className="h-6 w-6 text-[#9a6574]/70"/></div><p className="mt-2 truncate text-[8px] text-[#e5e7eb]/[.72]">{file?.name ?? ""}</p><p className="text-[7px] text-[#9da2a9]/[.55]">{((file?.size ?? 0)/1048576).toFixed(1)} MB · DRAG TO V1</p></div>
        </aside>}
        {mediaCollapsed && <button onClick={()=>setMediaCollapsed(false)} className="absolute left-2 top-20 z-30 h-8 w-8 rounded-lg bg-[#090407] border border-[#737981]/[.16] flex items-center justify-center max-lg:hidden"><Menu className="h-4 w-4"/></button>}

        <section className="min-w-0 min-h-0 bg-[#07090c] flex flex-col p-2 gap-2">
          <div className="h-8 shrink-0 rounded-lg border border-[#737981]/[.10] bg-[#0b0e12] flex items-center justify-between px-3 text-[6px] text-[#969ca4]/[.65]"><span>{tool} / {subTool.toUpperCase()}</span><span>FIT · 100% · {Math.round(duration)}s</span></div>
          <div className="flex-1 min-h-0 flex items-center justify-center nx-viewer-shell px-5 py-4 relative">
            <video ref={videoRef} src={output??src??undefined} muted={muted} playsInline preload="metadata" className={`max-h-full max-w-full object-contain ${effect==="SHAKE"?"nx-shake":""}`} style={visualStyle} onLoadedMetadata={e=>setDuration(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration||1:1)} onError={()=>setError("NEXUS could not decode this video in your browser. Try MP4 (H.264/AAC) or another supported format.")} onTimeUpdate={e=>setPlayhead(duration?e.currentTarget.currentTime/duration*100:0)} onEnded={()=>setPlaying(false)}/>{(tool==="GRAPH"||tool==="KEYFRAMES")&&<div className="absolute left-3 right-3 bottom-2 h-[190px] z-20 rounded-xl border border-[#737981]/[.18] bg-[#070305]/[.96] p-3"><GraphWorkspace keyframes={keyframes} duration={duration} add={addKeyframe} setKeyframes={setKeyframes} playhead={playhead}/></div>}{(tool==="COLOR"||tool==="ADJUST")&&<div className="absolute left-3 bottom-2 w-[430px] max-w-[calc(100%-24px)] z-20 rounded-xl border border-[#737981]/[.18] bg-[#070305]/[.96] p-3"><div className="text-[7px] font-black tracking-[.16em] mb-2">LIVE COLOR LAB</div><ColorScopes videoRef={videoRef}/></div>}
            {text&&<div className="absolute pointer-events-none text-4xl font-black drop-shadow-[0_0_20px_rgba(255,255,255,.25)]">{text}</div>}
            
          </div>
          <div className="h-11 shrink-0 rounded-lg border border-[#737981]/[.10] bg-[#0b0e12] flex items-center justify-center gap-3">
            <button onClick={()=>{if(videoRef.current){if(videoRef.current.paused){void videoRef.current.play();setPlaying(true)}else{videoRef.current.pause();setPlaying(false)}}}} className="h-7 w-7 rounded-md bg-[#3a3335] border border-[#737981]/25 flex items-center justify-center">{playing?<Pause className="h-3.5 w-3.5"/>:<Play className="h-3.5 w-3.5"/>}</button>
            <button onClick={()=>setMuted(v=>!v)} className="h-7 w-7 rounded-md bg-[#3a3335] border border-[#737981]/25 flex items-center justify-center">{muted?<VolumeX className="h-3.5 w-3.5"/>:<Volume2 className="h-3.5 w-3.5"/>}</button>
            <button onClick={()=>{setPlayhead(0);if(videoRef.current)videoRef.current.currentTime=0}} className="h-7 px-2 rounded-md bg-[#3a3335] border border-[#737981]/25 text-[7px]">00:00</button>
            <span className="text-[8px] text-[#bfc4ca]/[.58]">{duration?(duration*playhead/100).toFixed(2):"0.00"}s</span>
          </div>
          <div className="rounded-xl border border-[#737981]/[.10] bg-[#0b0e12] overflow-hidden shadow-lg"><ToolDock tool={tool} setTool={setTool} level={editingLevel} setLevel={setEditingLevel} autoEditOpen={autoEditOpen} setAutoEditOpen={setAutoEditOpen}/></div>
        </section>

        <aside className="min-w-0 border-l border-[#737981]/[.18] bg-[#090407] flex flex-col overflow-hidden nx-inspector-rail"><div className="h-11 shrink-0 border-b border-[#737981]/[.14] bg-[#0d0509] px-3 flex items-center justify-between"><div><p className="text-[8px] font-black tracking-[.2em] text-[#eee4dd]">INSPECTOR</p><p className="text-[6px] tracking-[.12em] text-[#969ca4]/[.55] mt-1">{tool} · {subTool}</p></div><span className="rounded border border-[#737981]/[.14] px-1.5 py-1 text-[5px] tracking-[.14em] text-[#9da2a9]/[.48]">CONTEXT</span></div><div className="flex-1 min-h-0 p-3 overflow-y-auto nx-scroll">{processing&&<RenderBattery progress={progress} mode={tool==="ENHANCE"?"ENHANCING":"RENDERING"}/>} {!processing&&output&&<div className="mb-3 rounded-lg border border-[#737981]/[.16] bg-[#160b10]/20 px-3 py-2 text-[7px] text-[#9da2a9]/[.55]">PROCESS COMPLETE · READY</div>}<Inspector src={src} tool={tool} subTool={subTool} setSubTool={setSubTool}
            effect={effect} setEffect={setEffect}
            speed={speed} setSpeed={setSpeed} ramp={speedRamp} updateRamp={updateRamp}
            adjustment={adjustment} setAdjustment={setAdjustment} resetAdjustments={resetAdjustments} blur={blur} setBlur={setBlur}
            volume={volume} setVolume={setVolume} muted={muted} setMuted={setMuted} pan={pan} setPan={setPan} bass={bass} setBass={setBass} treble={treble} setTreble={setTreble} compress={compress} setCompress={setCompress} audioFadeIn={audioFadeIn} setAudioFadeIn={setAudioFadeIn} audioFadeOut={audioFadeOut} setAudioFadeOut={setAudioFadeOut} normalizeAudio={normalizeAudio} setNormalizeAudio={setNormalizeAudio}
            text={text} setText={setText} mask={mask} setMask={setMask} maskFeather={maskFeather} setMaskFeather={setMaskFeather} blendMode={blendMode} setBlendMode={setBlendMode}
            chromaKey={chromaKey} setChromaKey={setChromaKey} chromaColor={chromaColor} setChromaColor={setChromaColor} chromaSimilarity={chromaSimilarity} setChromaSimilarity={setChromaSimilarity} chromaBlend={chromaBlend} setChromaBlend={setChromaBlend} backgroundRemoved={backgroundRemoved} setBackgroundRemoved={setBackgroundRemoved}
            scale={scale} setScale={setScale} posX={posX} setPosX={setPosX} posY={posY} setPosY={setPosY} rotation={rotation} setRotation={setRotation} scaleX={scaleX} setScaleX={setScaleX} scaleY={scaleY} setScaleY={setScaleY} anchorX={anchorX} setAnchorX={setAnchorX} anchorY={anchorY} setAnchorY={setAnchorY} skew={skew} setSkew={setSkew} flipX={flipX} setFlipX={setFlipX} flipY={flipY} setFlipY={setFlipY} upscale={upscale} setUpscale={setUpscale} keyframes={keyframes} addKeyframe={addKeyframe} setKeyframes={setKeyframes} playhead={playhead} selectedProperty={selectedProperty} setSelectedProperty={setSelectedProperty} setTool={setTool} duration={duration} opacity={opacity} setOpacity={setOpacity}
            targetFps={targetFps} setTargetFps={setTargetFps} enhance={enhance} setEnhance={setEnhance}
            compression={compression} setCompression={setCompression} onRender={()=>void process("export")} onEnhance={()=>void process("enhance")} videoRef={videoRef} processing={processing} progress={progress}
          />
          </div>
        </aside>
      </div>

      <div className="nx-timeline-shell rounded-t-xl overflow-hidden"><Timeline onMediaDrop={(position:number)=>{if(file&&timelineRef.current){const rect=timelineRef.current.getBoundingClientRect();const p=Math.max(0,Math.min(90,((position-rect.left)/rect.width)*100));setClips(c=>{const id=crypto.randomUUID();return [...c,{id,name:file.name,start:p,end:Math.min(100,p+20),sourceStart:0,sourceEnd:100,color:"#9a6574"}]});}}} timelineRef={timelineRef} clips={clips} setClips={setClips} activeClip={activeClip} setActiveClip={setActiveClip} playhead={playhead} seek={seek} split={split} deleteClip={deleteClip} duplicateClip={duplicateClip} reverseClip={reverseClip} freezeFrame={freezeFrame} setFreezeDuration={setFreezeDuration} duration={duration} sceneThumbs={sceneThumbs} beatMarkers={beatMarkers} setBeatMarkers={setBeatMarkers} waveform={waveform} bpm={bpm} addManualBeat={addManualBeat} autoBeatMarkers={autoBeatMarkers} clearBeatMarkers={clearBeatMarkers} zoom={timelineZoom} setZoom={setTimelineZoom} trackState={trackState} setTrackState={setTrackState} effectStack={effectStack} keyframes={keyframes} addKeyframe={addKeyframe} speedRamp={speedRamp} cutRange={cutRange} rippleDelete={rippleDelete} trimToPlayhead={trimToPlayhead} markIn={markIn} markOut={markOut} rangeStart={rangeStart} rangeEnd={rangeEnd} />
      </div>
    </div>
    {exportOpen&&<ExportCenter platform={exportPlatform} setPlatform={setExportPlatform} quality={exportQuality} setQuality={setExportQuality} shield={qualityShield} setShield={setQualityShield} duration={duration} targetFps={targetFps} onClose={()=>setExportOpen(false)} onExport={()=>{setExportOpen(false);void process("export")}}/>}
    {autoEditOpen&&<div className="fixed left-1/2 bottom-[270px] -translate-x-1/2 z-50 w-[360px] nx-section-card p-4 shadow-2xl">
      <div className="flex items-center justify-between"><div><p className="nx-panel-title">AUTO EDIT</p><p className="text-[7px] text-[#969ca4]/[.55] mt-1">Assisted workflow — review before rendering.</p></div><button data-nx-ghost="true" onClick={()=>setAutoEditOpen(false)} className="text-lg">×</button></div>
      <div className="nx-metal-line my-3"/>
      <div className="grid grid-cols-2 gap-2">
        {["Beat Sync","Smart Cuts","Auto Captions","Highlight Reel"].map(x=><button key={x} data-nx-ghost="true" onClick={()=>setSubTool(x)} className="rounded-lg border border-white/[.08] bg-[#14070d] px-3 py-3 text-[7px] text-[#d7d0d3] hover:border-[#9a6574]/60">{x}</button>)}
      </div>
      <button onClick={()=>{setSubTool("Auto Edit");setAutoEditOpen(false)}} className="mt-3 w-full rounded-lg py-2.5 text-[8px] font-black tracking-[.12em]">PREPARE AUTO EDIT</button>
    </div>}
    <input ref={fileRef} type="file" accept="video/*,.mp4,.mov,.webm,.m4v,.avi,.mkv,.mpeg,.mpg,.3gp" className="hidden" onChange={e=>{const input=e.currentTarget;chooseFile(input.files?.[0]);input.value=""}}/>
    {error&&<div className="fixed bottom-3 right-3 z-50 max-w-sm rounded-xl border border-red-300/20 bg-[#1b0c0c] px-4 py-3 text-[9px] text-red-100">{error}</div>}
  </main>;
}

function MobileEditor(p:any){
  const [panel,setPanel]=useState("");
  const [graphStyle,setGraphStyle]=useState("");
  const [graphPreset,setGraphPreset]=useState("Smooth");
  const [dragIndex,setDragIndex]=useState<number|null>(null);
  const graphRef=useRef<HTMLDivElement>(null);
  const tools=[
    ["LAYERS","Layers",Layers3],["EDIT","Split",Scissors],["SPEED","Speed",GaugeIcon],["AUDIO","Volume",Volume2],
    ["FILTERS","Filters",Palette],["ADJUST","Adjust",SlidersHorizontal],["TEXT","Text",Type],["STICKERS","Stickers",Sticker],
    ["EFFECTS","Effects",Wand2],["TRANSITIONS","Trans",ArrowLeftRight],["AUDIO","Audio",Music2],["GRAPH","Graph",SlidersHorizontal]
  ] as const;
  const beginner=["Smooth","Fast","Ease In","Ease Out","Ease In-Out","Bounce"];
  const alight=["Linear","Bezier","Overshoot","Elastic","Spring","Custom"];
  const presets=graphStyle===""?beginner:alight;
  const applyPreset=(name:string)=>{
    setGraphPreset(name);
    const t=p.duration||1;
    const shapes:Record<string,{time:number;value:number}[]>={
      "Smooth":[{time:0,value:100},{time:t*.5,value:115},{time:t,value:100}],
      "Fast":[{time:0,value:100},{time:t*.25,value:140},{time:t,value:100}],
      "Ease In":[{time:0,value:100},{time:t*.7,value:110},{time:t,value:125}],
      "Ease Out":[{time:0,value:100},{time:t*.3,value:125},{time:t,value:125}],
      "Ease In-Out":[{time:0,value:100},{time:t*.5,value:135},{time:t,value:100}],
      "Bounce":[{time:0,value:100},{time:t*.45,value:135},{time:t*.7,value:105},{time:t,value:100}],
      "Linear":[{time:0,value:100},{time:t,value:130}],
      "Bezier":[{time:0,value:100},{time:t*.35,value:115},{time:t*.7,value:150},{time:t,value:130}],
      "Overshoot":[{time:0,value:100},{time:t*.55,value:155},{time:t*.75,value:120},{time:t,value:130}],
      "Elastic":[{time:0,value:100},{time:t*.3,value:145},{time:t*.5,value:92},{time:t*.72,value:138},{time:t,value:130}],
      "Spring":[{time:0,value:100},{time:t*.35,value:150},{time:t*.6,value:108},{time:t,value:130}],
      "Custom":[{time:0,value:100},{time:t,value:130}]
    };
    p.setKeyframes((shapes[name]??shapes["Custom"]).map(k=>({...k,property:p.selectedProperty??"scale"})));
  };
  const onGraphPointer=(e:React.PointerEvent)=>{
    if(dragIndex===null||!graphRef.current)return;
    const r=graphRef.current.getBoundingClientRect();
    const time=Math.max(0,Math.min(p.duration,((e.clientX-r.left)/r.width)*p.duration));
    const value=Math.max(50,Math.min(200,200-((e.clientY-r.top)/r.height)*150));
    p.setKeyframes(p.keyframes.map((k:any,i:number)=>i===dragIndex?{...k,time,value}:k).sort((a:any,b:any)=>a.time-b.time));
  };
  const graph=panel==="GRAPH"?(
    <div className="absolute inset-0 z-50 bg-[#080306] flex flex-col nx-mobile-editor">
      <div className="h-12 shrink-0 border-b border-white/[.08] flex items-center px-3 gap-3"><button data-nx-ghost="true" onClick={()=>setPanel("")} className="text-xl text-[#d7d0cc]">‹</button><b className="text-[10px] tracking-[.16em]">GRAPH EDITOR</b><span className="ml-auto text-[7px] text-[#9da2a9]/[.55]">{graphStyle===""?" MODE":" MODE"}</span></div>
      <div className="px-3 pt-3"><div className="grid grid-cols-2 rounded-lg bg-[#12080d] p-1 border border-white/[.08]"><button data-nx-ghost="true" onClick={()=>setGraphStyle("")} className={"rounded-md py-2 text-[8px] font-bold "+(graphStyle===""?"bg-[#521631] text-white":"text-[#8f8790]")}> GRAPHS</button><button data-nx-ghost="true" onClick={()=>setGraphStyle("ALIGHT")} className={"rounded-md py-2 text-[8px] font-bold "+(graphStyle==="ALIGHT"?"bg-[#521631] text-white":"text-[#8f8790]")}></button></div></div>
      <div className="px-3 pt-2 text-[7px] text-[#9da2a9]/[.55]">Tap a graph to apply it, or drag points to create your own.</div>
      <div ref={graphRef} onPointerMove={onGraphPointer} onPointerUp={()=>setDragIndex(null)} className="mx-3 mt-3 h-52 rounded-2xl border border-[#737981]/[.16] bg-[#050204] nx-graph-grid relative touch-none overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,.04)]">
        <svg viewBox="0 0 300 160" className="absolute inset-0 w-full h-full">
          {p.keyframes.length>1&&<path d={p.keyframes.map((k:any,i:number)=>{const x=k.time/Math.max(.001,p.duration)*280+10;const y=145-((k.value-50)/150)*120;return (i?"L":"M")+" "+x+" "+y}).join(" ")} fill="none" stroke="#9a6574" strokeWidth="2.5"/>}
          {p.keyframes.map((k:any,i:number)=>{const x=k.time/Math.max(.001,p.duration)*280+10;const y=145-((k.value-50)/150)*120;return <circle key={i} cx={x} cy={y} r="6" fill={i===dragIndex?"#eee4dd":"#9a6574"} stroke="#eee4dd" strokeWidth="1.5" onPointerDown={e=>{e.stopPropagation();setDragIndex(i)}}/>})}
        </svg>
        <span className="absolute left-3 bottom-2 text-[7px] text-[#9da2a9]/[.5]">DRAG POINTS · {graphPreset.toUpperCase()}</span>
      </div>
      <div className="px-3 pt-3 flex gap-2 overflow-x-auto nx-scroll">{presets.map(name=><button key={name} data-nx-ghost="true" onClick={()=>applyPreset(name)} className={"shrink-0 rounded-lg border px-3 py-2 text-[7px] "+(graphPreset===name?"border-[#9a6574] bg-[#241019] text-white":"border-white/[.08] text-[#aeb3b9]")}>{name}</button>)}</div>
      <div className="mt-auto p-3 grid grid-cols-3 gap-2"><button onClick={p.addKeyframe} className="rounded-lg py-2 text-[7px] font-bold">ADD KEY</button><button onClick={()=>p.setKeyframes(p.keyframes.slice(0,-1))} className="rounded-lg py-2 text-[7px] font-bold">DELETE</button><button onClick={()=>applyPreset("Custom")} className="rounded-lg py-2 text-[7px] font-bold">CREATE GRAPH</button></div>
    </div>
  ):null;
  return <main className="fixed inset-0 z-40 bg-[#050204] text-[#e5e7eb] flex flex-col overflow-hidden">
    {graph}
    <header className="h-12 shrink-0 border-b border-white/[.08] bg-[#0a0306] flex items-center px-3 gap-3"><b className="text-[11px] tracking-[.18em]">NEXUS</b><span className="truncate text-[8px] text-[#9da2a9]/[.55]">{p.file.name}</span><button onClick={()=>void p.process("export")} className="ml-auto rounded-md px-3 py-1.5 text-[7px] font-black">EXPORT</button></header>
    <section className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex items-center justify-center bg-[#090407] p-3"><video ref={p.videoRef} src={p.output??p.src??undefined} muted={p.muted} playsInline preload="metadata" className="max-w-full max-h-full object-contain" onLoadedMetadata={e=>p.setDuration(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration||1:1)} onError={()=>p.setError?.("NEXUS could not decode this video in your browser. Try MP4 (H.264/AAC) or another supported format.")} onTimeUpdate={e=>p.setPlayhead(p.duration?p.videoRef.current?.currentTime/p.duration*100:0)} onEnded={()=>p.setPlaying(false)}/></div>
      <div className="h-11 shrink-0 border-y border-white/[.08] flex items-center justify-center gap-4"><button data-nx-ghost="true" onClick={()=>{if(p.videoRef.current){if(p.videoRef.current.paused){void p.videoRef.current.play();p.setPlaying(true)}else{p.videoRef.current.pause();p.setPlaying(false)}}}}>{p.playing?<Pause className="h-4 w-4"/>:<Play className="h-4 w-4"/>}</button><button data-nx-ghost="true" onClick={()=>p.setMuted(!p.muted)}>{p.muted?<VolumeX className="h-4 w-4"/>:<Volume2 className="h-4 w-4"/>}</button><span className="text-[8px] text-[#9da2a9]/[.55]">{(p.duration*p.playhead/100).toFixed(2)}s / {p.duration.toFixed(2)}s</span></div>
      <div className="h-28 shrink-0 p-2 bg-[#080306] border-b border-white/[.08]"><div className="relative h-16 rounded-lg border border-[#737981]/[.14] bg-[#11060a] overflow-hidden" onPointerDown={e=>p.seek(Math.max(0,Math.min(100,(e.nativeEvent.offsetX/e.currentTarget.clientWidth)*100)))}><div className="absolute inset-y-0 left-0 bg-[#9a6574]/[.18]" style={{width:p.playhead+"%"}}/><div className="absolute top-0 bottom-0 w-px bg-[#d5b9c1]" style={{left:p.playhead+"%"}}/><span className="absolute left-2 top-2 truncate max-w-[80%] text-[7px]">{p.file.name}</span></div></div>
      <div className="h-20 shrink-0 flex items-center gap-1 overflow-x-auto px-2 bg-[#0b0508] border-t border-white/[.08] nx-scroll nx-mobile-toolbar"><button data-nx-ghost="true" onClick={()=>setPanel("Auto Edit")} className={"nx-mobile-tool shrink-0 flex flex-col items-center justify-center gap-1 "+(panel==="Auto Edit"?"nx-mobile-tool-active":"")}><Sparkles className="h-4 w-4"/><span className="text-[7px]">Auto Edit</span></button>{tools.map(([id,label,Icon])=><button key={label} data-nx-ghost="true" onClick={()=>id==="GRAPH"?setPanel("GRAPH"):setPanel(label)} className={"nx-mobile-tool shrink-0 flex flex-col items-center justify-center gap-1 "+(panel===label?"nx-mobile-tool-active":"")}><Icon className="h-4 w-4"/><span className="text-[7px]">{label}</span></button>)}</div>
    </section>
    {panel&&panel!=="GRAPH"&&<div className="absolute left-0 right-0 bottom-20 z-40 max-h-[45%] overflow-y-auto rounded-t-2xl border border-white/[.08] bg-[#10060b] p-4 nx-scroll"><div className="flex items-center justify-between mb-3"><b className="text-[9px] tracking-[.15em]">{panel}</b><button data-nx-ghost="true" onClick={()=>setPanel("")} className="text-lg">×</button></div>{panel==="Auto Edit"&&<div className="grid grid-cols-2 gap-2">{["Beat Sync","Smart Cuts","Auto Captions","Highlights"].map(x=><button key={x} onClick={()=>setPanel(x)} className="rounded-lg py-3 text-[7px] font-bold border border-white/[.08]">{x}</button>)}</div>}{panel==="Split"&&<button onClick={p.split} className="w-full rounded-lg py-3 text-[8px] font-black">SPLIT AT PLAYHEAD</button>}{panel==="Speed"&&<label className="text-[8px]">SPEED<input type="range" min="25" max="400" value={p.speed*100} onChange={e=>p.setSpeed(Number(e.target.value)/100)} className="w-full mt-3"/></label>}{panel==="Volume"&&<label className="text-[8px]">VOLUME<input type="range" min="0" max="200" value={p.volume} onChange={e=>p.setVolume(Number(e.target.value))} className="w-full mt-3"/></label>}{panel==="Adjust"&&<div className="space-y-3">{([["Exposure","exposure"],["Brightness","brightness"],["Contrast","contrast"],["Saturation","saturation"],["Temperature","temperature"],["Tint","tint"]] as const).map(([label,key])=><label key={key} className="block text-[8px]">{label}<input type="range" min="-100" max="100" value={p.adjustment[key]??0} onChange={e=>p.setAdjustment((prev:any)=>({...prev,[key]:Number(e.target.value)}))} className="w-full mt-2"/></label>)}</div>}{panel==="Text"&&<textarea value={p.text} onChange={e=>p.setText(e.target.value)} placeholder="Type text overlay" className="w-full h-24 rounded-lg bg-[#050204] border border-white/[.1] p-3 text-xs"/>}{panel==="Effects"&&<div className="grid grid-cols-2 gap-2">{effects.slice(0,12).map(e=><button key={e} onClick={()=>p.setEffect(e)} className="rounded-lg py-2 text-[7px]">{effectNames[e]}</button>)}</div>}</div>}
    {p.processing&&<div className="absolute top-14 left-3 right-3 z-50 rounded-lg border border-white/[.1] bg-[#160b10] px-3 py-2 text-[7px]">RENDERING · {Math.round(p.progress*100)}%</div>}
  </main>;
}

function ToolGlyph({tool}:{tool:Tool}){const glyphs:Record<Tool,any>={MEDIA:Image,EDIT:Clapperboard,AUDIO:AudioWaveform,TEXT:Type,STICKERS:Sticker,EFFECTS:Wand2,TRANSITIONS:ArrowLeftRight,FILTERS:Palette,ADJUST:SlidersHorizontal,COLOR:Palette,TRANSFORM:Maximize2,SPEED:GaugeIcon,ANIMATION:WandSparkles,MASK:ScanSearch,LAYERS:Layers3,GRAPH:SlidersHorizontal,CAPTIONS:Captions,TRACKING:ScanSearch,REMOVE_BG:Eraser,RETOUCH:Brush,STABILIZE:ShieldCheck,KEYFRAMES:DiamondIcon,STOCK:Database,SOUND_FX:Music2,VOICE:AudioLines,ENHANCE:Sparkles};const Icon=glyphs[tool]??Sparkles;return <span className="nx-tool-icon"><Icon className="h-3.5 w-3.5" strokeWidth={1.7}/></span>;}
function DiamondIcon({className}:{className?:string}){return <span className={className}>◇</span>;}
function RenderBattery({progress,mode}:{progress:number;mode:string}){const pct=Math.round(Math.max(0,Math.min(1,progress))*100);return <div className="mb-3 rounded-xl border border-[#737981]/[.16] bg-[#0b0307] p-3"><div className="flex items-center justify-between mb-2"><span className="text-[7px] font-black tracking-[.18em] text-[#c7cbd1]/[.68]">{mode}</span><span className="text-[9px] font-black text-white">{pct}%</span></div><div className="flex items-center gap-1.5"><div className="flex-1 h-5 rounded-[5px] border border-white/15 p-0.5 flex gap-0.5 overflow-hidden">{Array.from({length:20}).map((_,i)=><span key={i} className={i<Math.ceil(pct/5)?"flex-1 rounded-[2px] bg-[#241019]":"flex-1 rounded-[2px] bg-[#241019]/[.06]"}/>)}</div><span className="w-1.5 h-2.5 rounded-r-sm bg-[#3a3335]/30"/></div><p className="mt-2 text-[6px] text-[#9da3aa]/[.34]">NEXUS PROCESSING</p></div>;}
function Inspector(p:any){
  const R=({label,value,min=-100,max=100,set,property}:any)=><label className="block text-[8px] text-[#aeb3b9]/[.60] mb-3"><div className="flex items-center justify-between"><span>{label}</span>{property&&<button type="button" title="Animate this property" onClick={()=>{p.setSelectedProperty(property);p.setTool("KEYFRAMES");p.setSubTool(label);}} className="text-[#eee4dd] text-[11px]">◇</button>}</div><div className="flex items-center gap-2 mt-1"><input type="range" min={min} max={max} value={value} onChange={e=>set(Number(e.target.value))} className="w-full accent-[#9da2a9]"/><span className="w-8 text-right text-[#e5e7eb]/[.72]">{Math.round(value)}</span></div></label>;
  const Btn=({children,onClick,active}:any)=><button onClick={onClick} className={`w-full rounded-lg border px-3 py-2 text-[8px] font-bold tracking-widest ${active?"border-[#9a6574]/30 bg-[#241019]/10 text-[#e5e7eb]":"border-[#737981]/[.12] bg-[#160b10]/20 text-[#e5e7eb]/[.72]"}`}>{children}</button>;
  if(p.tool==="EDIT") return <div className="space-y-4"><p className="text-[8px] leading-5 text-[#9da2a9]/[.62]">Quick clip controls. Split, Trim and Freeze stay on the timeline.</p><R label="OPACITY" property="opacity" value={p.opacity??100} min={0} max={100} set={p.setOpacity}/><Btn onClick={()=>p.setSubTool("Transform")}>TRANSFORM</Btn><Btn onClick={()=>p.setSubTool("Adjustment")} active={p.subTool==="Adjustment"}>ADJUSTMENT</Btn>{p.subTool==="Transform"&&<TransformPanel p={p} advanced={false}/>} {p.subTool==="Adjustment"&&<AdjustmentPanel p={p}/>}</div>;
  if(p.tool==="TRANSFORM") return <TransformPanel p={p} advanced={true}/>;
  if(p.tool==="LAYERS") return <div className="space-y-3"><p className="text-[8px] font-black tracking-[.16em] text-[#c7cbd1]">COMPOSITING</p><label className="block text-[8px] text-[#aeb3b9]/[.60]">BLEND MODE<select value={p.blendMode} onChange={e=>p.setBlendMode(e.target.value)} className="mt-1 w-full rounded-lg border border-[#737981]/[.16] bg-[#11060a] p-2 text-[8px] text-white"><option value="normal">Normal</option><option value="multiply">Multiply</option><option value="screen">Screen</option><option value="overlay">Overlay</option><option value="darken">Darken</option><option value="lighten">Lighten</option></select></label><R label="COMPOSITE OPACITY" value={p.opacity??100} min={0} max={100} set={p.setOpacity}/><Btn onClick={()=>p.setSubTool("Track Matte")}>TRACK MATTE / ALPHA</Btn><Btn onClick={()=>p.setSubTool("Precompose")}>PRECOMPOSE / GROUP</Btn><p className="text-[7px] leading-4 text-[#969ca4]/[.55]">Blend modes and opacity render directly into the exported clip.</p></div>;
  if(p.tool==="TRACKING") return <div className="space-y-3"><p className="text-[8px] leading-5 text-[#bfc4ca]/[.58]">Advanced motion analysis workspace.</p><Btn onClick={()=>p.setSubTool("Point Track")}>POINT TRACK</Btn><Btn onClick={()=>p.setSubTool("Planar Track")}>PLANAR TRACK</Btn><Btn onClick={()=>p.setSubTool("Object Track")}>OBJECT TRACK</Btn><Btn onClick={()=>p.setSubTool("Stabilize Track")}>TRACK + STABILIZE</Btn></div>;
  if(p.tool==="KEYFRAMES") return <GraphEditor keyframes={p.keyframes} add={p.addKeyframe} duration={p.duration} setKeyframes={p.setKeyframes}/>;
  if(p.tool==="EFFECTS") return <div className="space-y-4"><div><div className="flex items-center justify-between mb-2"><p className="text-[8px] font-black tracking-[.16em] text-[#c7cbd1]">EFFECT STACK</p><span className="text-[6px] text-[#969ca4]">{p.effectStack.length} LAYERS</span></div><div className="space-y-1.5">{p.effectStack.length?p.effectStack.map((layer:any,i:number)=><div key={layer.id} className="rounded-lg border border-[#737981]/[.12] bg-[#160b10]/30 p-2"><div className="flex items-center gap-2"><button onClick={()=>p.updateEffectLayer(layer.id,{enabled:!layer.enabled})} className="w-7 h-7 rounded border text-[7px]">{layer.enabled?"ON":"OFF"}</button><span className="flex-1 text-[8px] font-semibold">{effectNames[layer.effect]}</span><button onClick={()=>p.removeEffectLayer(layer.id)} className="w-7 h-7 rounded border text-[8px]">×</button></div><div className="flex items-center gap-2 mt-2"><input type="range" min={0} max={100} value={layer.opacity} onChange={e=>p.updateEffectLayer(layer.id,{opacity:Number(e.target.value)})} className="w-full accent-[#9da2a9]"/><span className="w-7 text-right text-[7px]">{layer.opacity}</span></div><p className="mt-1 text-[6px] text-[#7f858d]">Layer {i+1} · applied in render order</p></div>):<p className="text-[7px] text-[#7f858d]">Choose an effect below to add it to the stack.</p>}</div></div><PresetPanel title="ADD EFFECT" items={effects.map(e=>({id:e,label:effectNames[e]??e}))} src={p.src} active={p.effect} onSelect={(id:string)=>p.setEffect(id as Effect)}/></div>;
  if(p.tool==="ADJUST") return <AdjustmentPanel p={p} scopes/>;
  if(p.tool==="COLOR") return <AdjustmentPanel p={p} scopes/>;
  if(p.tool==="SPEED") return <div><R label="BASE SPEED" value={p.speed*100} min={25} max={400} set={(v:number)=>p.setSpeed(v/100)}/><p className="text-[8px] font-black tracking-[.18em] text-[#bfc4ca]/[.58] mb-2">SPEED GRAPH / VELOCITY CURVE</p><SpeedGraph ramp={p.ramp} update={p.updateRamp}/><p className="mt-2 text-[8px] text-[#bfc4ca]/[.58]">Drag graph points vertically to change velocity and horizontally to change timing. This graph is used by the render engine.</p></div>;
  if(p.tool==="GRAPH") return <GraphEditor keyframes={p.keyframes} add={p.addKeyframe} duration={p.duration} setKeyframes={p.setKeyframes}/>;
  if(p.tool==="ANIMATION") return <div><p className="text-[8px] text-[#969ca4]/[.55] mb-3">Real property keyframes. The viewer interpolates the animated scale while you scrub.</p><Btn onClick={p.addKeyframe}>◇ ADD KEYFRAME AT PLAYHEAD</Btn><div className="mt-3 space-y-2">{p.keyframes.map((k:any,i:number)=><div key={i} className="flex justify-between text-[8px] text-[#aeb3b9]/[.60]"><span>{k.time.toFixed(2)}s</span><span>{Math.round(k.value)}%</span></div>)}</div></div>;
  if(p.tool==="AUDIO") return <div className="space-y-2"><R label="VOLUME" property="volume" value={p.volume} min={0} max={200} set={p.setVolume}/><R label="PAN" value={p.pan} min={-100} max={100} set={p.setPan}/><R label="BASS" value={p.bass} min={-12} max={12} set={p.setBass}/><R label="TREBLE" value={p.treble} min={-12} max={12} set={p.setTreble}/><R label="COMPRESSOR" value={p.compress} min={0} max={100} set={p.setCompress}/><R label="FADE IN" value={p.audioFadeIn} min={0} max={10} set={p.setAudioFadeIn}/><R label="FADE OUT" value={p.audioFadeOut} min={0} max={10} set={p.setAudioFadeOut}/><Btn onClick={()=>p.setNormalizeAudio(!p.normalizeAudio)} active={p.normalizeAudio}>NORMALIZE AUDIO</Btn><Btn onClick={()=>p.setMuted(!p.muted)} active={p.muted}>{p.muted?<VolumeX className="inline h-3 w-3 mr-1"/>:<Volume2 className="inline h-3 w-3 mr-1"/>}{p.muted?"MUTED":"MUTE AUDIO"}</Btn></div>;
  if(p.tool==="TEXT") return <div><textarea value={p.text} onChange={e=>p.setText(e.target.value)} placeholder="Type text overlay" className="w-full h-24 rounded-lg border border-[#737981]/[.16] bg-[#11060a] p-3 text-xs outline-none"/><p className="mt-2 text-[8px] text-[#bfc4ca]/[.58]">Text is visible in the live viewer. Typography controls can be expanded without changing the core timeline.</p></div>;
  if(p.tool==="REMOVE_BG") return <div className="space-y-3"><p className="text-[8px] leading-5 text-[#bfc4ca]/[.58]">Background removal and chroma key are exposed here. Automatic subject segmentation needs a local AI segmentation model; chroma key renders through FFmpeg.</p><Btn onClick={()=>{const next=!p.backgroundRemoved;p.setBackgroundRemoved(next);p.setChromaKey(next)}} active={p.backgroundRemoved}>{p.backgroundRemoved?"BACKGROUND REMOVAL ACTIVE":"REMOVE BACKGROUND"}</Btn><Btn onClick={()=>p.setSubTool("Chroma Key")} active={p.subTool==="Chroma Key"}>CHROMA KEY</Btn>{p.subTool==="Chroma Key"&&<><label className="text-[8px] text-[#aeb3b9]/[.60]">KEY COLOR<input type="color" value={p.chromaColor} onChange={e=>p.setChromaColor(e.target.value)} className="mt-2 block w-full h-8 rounded bg-[#11060a]"/></label><R label="SIMILARITY" value={p.chromaSimilarity*100} min={0} max={100} set={(v:number)=>p.setChromaSimilarity(v/100)}/><R label="BLEND" value={p.chromaBlend*100} min={0} max={30} set={(v:number)=>p.setChromaBlend(v/100)}/><Btn onClick={()=>p.setChromaKey(!p.chromaKey)} active={p.chromaKey}>{p.chromaKey?"CHROMA KEY ON":"ENABLE CHROMA KEY"}</Btn></>}</div>;
  if(p.tool==="MASK") return <div className="space-y-2"><Btn onClick={()=>p.setMask("RECT")} active={p.mask==="RECT"}>RECTANGLE MASK</Btn><Btn onClick={()=>p.setMask("CIRCLE")} active={p.mask==="CIRCLE"}>CIRCLE MASK</Btn><Btn onClick={()=>p.setMask("NONE")} active={p.mask==="NONE"}>REMOVE MASK</Btn><R label="FEATHER" value={p.maskFeather} min={0} max={100} set={p.setMaskFeather}/></div>;
  if(p.tool==="ENHANCE") return <div><Btn onClick={()=>p.setEnhance(!p.enhance)} active={p.enhance}>{p.enhance?"ENHANCEMENT ENABLED":"ENABLE DETAIL ENHANCEMENT"}</Btn><div className="mt-4"><R label="UPSCALE" value={p.upscale} min={100} max={200} set={p.setUpscale}/><label className="text-[8px] text-[#aeb3b9]/[.60]">OUTPUT FPS<select value={p.targetFps} onChange={e=>p.setTargetFps(Number(e.target.value))} className="mt-2 w-full bg-[#11060a] border border-[#737981]/[.16] rounded-lg p-2 text-white"><option value={60}>60 FPS</option><option value={90}>90 FPS</option><option value={120}>120 FPS</option></select></label></div><button onClick={p.onEnhance} className="nx-button-surface mt-4 w-full rounded-lg py-3 text-[8px] font-black tracking-widest shadow-[0_8px_22px_rgba(0,0,0,.32),inset_0_1px_0_rgba(255,247,237,.34)]"><WandSparkles className="inline h-3 w-3 mr-1"/> ENHANCE + RENDER</button><p className="mt-3 text-[8px] leading-5 text-[#bfc4ca]/[.58]">NEXUS currently uses local FFmpeg denoise/detail recovery. The architecture is ready for a WebGPU Real-ESRGAN/RIFE worker; those neural models should be loaded only when their licensed model assets are available.</p></div>;
  if(p.tool==="FILTERS") return <PresetPanel title="FILTERS" items={["Cinema","Vivid","Noir","Warm","Cool","Faded","Game","Clean","Mono","Retro","Night","Food"].map(x=>({id:x,label:x}))} src={p.src} active={p.subTool} onSelect={(id)=>{p.setSubTool(id);const presets:Record<string,any>={Cinema:{contrast:14,saturation:-8,temperature:6,fade:3},Vivid:{contrast:8,saturation:22,vibrance:18},Noir:{contrast:24,saturation:-45,shadows:-8,blacks:-20},Warm:{temperature:28,saturation:8},Cool:{temperature:-28,saturation:5},Faded:{contrast:-12,fade:22,saturation:-8},Game:{contrast:18,saturation:18,sharpness:20,structure:12},Clean:{contrast:4,saturation:2,sharpness:8},Mono:{saturation:-100,contrast:8},Retro:{fade:16,temperature:10,saturation:-6,grain:10},Night:{brightness:-12,contrast:12,temperature:-8,shadows:12},Food:{saturation:20,vibrance:24,temperature:8}};p.setAdjustment((prev:any)=>({...prev,...(presets[id]??{})}))}}/>;
  if(p.tool==="TRANSITIONS") return <PresetPanel title="TRANSITIONS" items={["Fade","Blur","Overlay","Moment","Camera","Whirl","Glitch","Slide","Mask","Split","Flash","Spin"].map(x=>({id:x,label:x}))} src={p.src} active={p.subTool} onSelect={(id)=>{p.setSubTool(id);if(id==="Blur")p.setBlur(8);else if(id==="Fade")p.setAdjustment((prev:any)=>({...prev,fade:28}));else if(id==="Flash")p.setAdjustment((prev:any)=>({...prev,brightness:22}));else if(id==="Glitch")p.setEffect("GLITCH");else if(id==="Spin")p.setRotation((p.rotation??0)+180);}}/>;
  return <div className="space-y-2 text-[8px] text-[#969ca4]/[.55]"><Btn onClick={()=>p.setSubTool("Overview")}>OVERVIEW</Btn><p>Choose a tool from the silver graphite dock below the viewer. Contextual controls stay in this inspector.</p></div>;
}

function AdjustmentPanel({p,scopes=false}:{p:any;scopes?:boolean}){
  const R=({label,key,min=-100,max=100}:any)=><label className="block text-[8px] text-[#aeb3b9]/[.60] mb-3">{label}<div className="flex items-center gap-2 mt-1"><input type="range" min={min} max={max} value={p.adjustment[key]??0} onChange={e=>p.setAdjustment((prev:any)=>({...prev,[key]:Number(e.target.value)}))} className="w-full accent-[#9da2a9]"/><span className="w-8 text-right text-[#e5e7eb]/[.72]">{Math.round(p.adjustment[key]??0)}</span></div></label>;
  return <div className="space-y-4"><div className="flex items-center justify-between"><p className="text-[8px] font-black tracking-[.18em] text-[#c7cbd1]/[.72]">ADJUSTMENT</p><button data-nx-ghost="true" onClick={p.resetAdjustments} className="rounded border border-white/[.08] px-2 py-1 text-[6px] text-[#c7cbd1]/[.7] hover:text-white">RESET</button></div><div className="space-y-1"><R label="EXPOSURE" key="exposure" min={-100} max={100}/><R label="BRIGHTNESS" key="brightness"/><R label="CONTRAST" key="contrast"/><R label="SATURATION" key="saturation"/><R label="VIBRANCE" key="vibrance"/><R label="TEMPERATURE" key="temperature"/><R label="TINT" key="tint"/></div><p className="pt-2 text-[8px] font-black tracking-[.18em] text-[#c7cbd1]/[.72]">LIGHT</p><R label="HIGHLIGHTS" key="highlights"/><R label="SHADOWS" key="shadows"/><R label="WHITES" key="whites"/><R label="BLACKS" key="blacks"/><p className="pt-2 text-[8px] font-black tracking-[.18em] text-[#c7cbd1]/[.72]">DETAIL /  STRUCTURE</p><R label="STRUCTURE · " key="structure"/><R label="CLARITY" key="clarity"/><R label="TEXTURE" key="texture"/><R label="DEHAZE" key="dehaze"/><R label="SHARPNESS" key="sharpness" min={0} max={100}/><p className="pt-2 text-[8px] font-black tracking-[.18em] text-[#c7cbd1]/[.72]">FINISH</p><R label="FADE" key="fade" min={0} max={100}/><R label="VIGNETTE" key="vignette" min={0} max={100}/><R label="GRAIN" key="grain" min={0} max={100}/><p className="pt-2 text-[8px] font-black tracking-[.18em] text-[#c7cbd1]/[.72]">RGB / COLOR CHANNELS</p><R label="RED" key="red"/><R label="GREEN" key="green"/><R label="BLUE" key="blue"/><p className="pt-2 text-[8px] font-black tracking-[.18em] text-[#c7cbd1]/[.72]">TONAL /  STYLE</p><R label="LIFT" key="lift"/><R label="GAMMA" key="gamma"/><R label="GAIN" key="gain"/><R label="MIDTONES" key="midtones"/>{scopes&&<><p className="pt-2 text-[8px] font-black tracking-[.18em] text-[#c7cbd1]/[.72]">SCOPES</p><ColorScopes videoRef={p.videoRef}/></>}</div>;
}

function ColorScopes({videoRef}:{videoRef:RefObject<HTMLVideoElement|null>}){
  const refs=useRef<HTMLCanvasElement[]>([]);
  useEffect(()=>{
    let raf=0;
    const draw=()=>{
      const v=videoRef.current;
      if(v&&v.readyState>=2){
        const w=96,h=54; const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");
        if(x){x.drawImage(v,0,0,w,h);const d=x.getImageData(0,0,w,h).data; const channel=(index:number)=>d[index]??0;
          refs.current.forEach((cv,i)=>{if(!cv)return;const g=cv.getContext("2d");if(!g)return;g.clearRect(0,0,cv.width,cv.height);g.fillStyle="#050505";g.fillRect(0,0,cv.width,cv.height);g.strokeStyle="#73798120";for(let q=1;q<4;q++){g.beginPath();g.moveTo(0,q*cv.height/4);g.lineTo(cv.width,q*cv.height/4);g.stroke()}g.strokeStyle="#9a6574";g.globalAlpha=.65;g.beginPath();
            if(i===0){for(let px=0;px<w;px++){let sum=0;for(let py=0;py<h;py++){const k=(py*w+px)*4;sum+=.2126*channel(k)+.7152*channel(k+1)+.0722*channel(k+2)}const lum=sum/h;g.lineTo(px/w*cv.width,cv.height-(lum/255)*cv.height)}}
            else if(i===1){for(let px=0;px<w;px++){let rr=0,gg=0,bb=0;for(let py=0;py<h;py++){const k=(py*w+px)*4;rr+=channel(k);gg+=channel(k+1);bb+=channel(k+2)}const val=(i===1?rr:i===2?gg:bb)/(h*255);g.lineTo(px/w*cv.width,cv.height-val*cv.height)}}
            else if(i===2){for(let py=0;py<h;py++)for(let px=0;px<w;px++){const k=(py*w+px)*4;const mx=Math.max(channel(k),channel(k+1),channel(k+2)),mn=Math.min(channel(k),channel(k+1),channel(k+2));if(mx-mn>20){const yy=(mx+mn)/510;g.lineTo((channel(k+1)-channel(k)+255)/510*cv.width,cv.height-yy*cv.height)}}}
            else {const bins=new Array(16).fill(0);for(let n=0;n<d.length;n+=4)bins[Math.min(15,Math.floor((channel(n)+channel(n+1)+channel(n+2))/3/256*16))]++;const m=Math.max(...bins);for(let b=0;b<16;b++){const bh=(bins[b]??0)/m*cv.height;g.moveTo((b+.5)/16*cv.width,cv.height);g.lineTo((b+.5)/16*cv.width,cv.height-bh)}}g.stroke();g.globalAlpha=1;});
        }
      } raf=requestAnimationFrame(draw);
    };raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);
  },[videoRef]);
  return <div className="grid grid-cols-2 gap-1"><div><p className="text-[6px] text-[#969ca4]/[.55] mb-1">WAVEFORM</p><canvas ref={e=>{if(e)refs.current[0]=e}} width="180" height="76" className="w-full rounded border border-[#737981]/[.12]"/></div><div><p className="text-[6px] text-[#969ca4]/[.55] mb-1">RGB PARADE</p><canvas ref={e=>{if(e)refs.current[1]=e}} width="180" height="76" className="w-full rounded border border-[#737981]/[.12]"/></div><div><p className="text-[6px] text-[#969ca4]/[.55] mb-1">VECTORSCOPE</p><canvas ref={e=>{if(e)refs.current[2]=e}} width="180" height="76" className="w-full rounded border border-[#737981]/[.12]"/></div><div><p className="text-[6px] text-[#969ca4]/[.55] mb-1">HISTOGRAM</p><canvas ref={e=>{if(e)refs.current[3]=e}} width="180" height="76" className="w-full rounded border border-[#737981]/[.12]"/></div></div>;
}

function SpeedGraph({ramp,update}:{ramp:SpeedPoint[];update:(i:number,p:Partial<SpeedPoint>)=>void}){
  const [drag,setDrag]=useState<{i:number;h:"point"|"in"|"out"}|null>(null);
  const [mode,setMode]=useState<"SPEED"|"VALUE">("SPEED");
  useEffect(()=>{const mv=(e:PointerEvent)=>{if(!drag)return;const el=document.getElementById("nx-speed-graph");if(!el)return;const r=el.getBoundingClientRect();const x=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));const y=Math.max(.25,Math.min(4,4-((e.clientY-r.top)/r.height)*3.75));update(drag.i,{position:x,speed:y})};const up=()=>setDrag(null);window.addEventListener("pointermove",mv);window.addEventListener("pointerup",up);return()=>{window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up)}},[drag,update]);
  const path=ramp.map((p,i)=>`${i?"L":"M"} ${p.position*280+10} ${110-(p.speed/4)*90}`).join(" ");
  return <div><div className="flex items-center gap-1 mb-2"><button onClick={()=>setMode("SPEED")} className={`px-2 py-1 rounded text-[7px] ${mode==="SPEED"?"bg-[#241019]/10 text-white":"text-[#969ca4]/[.55]"}`}>SPEED GRAPH</button><button onClick={()=>setMode("VALUE")} className={`px-2 py-1 rounded text-[7px] ${mode==="VALUE"?"bg-[#241019]/10 text-white":"text-[#969ca4]/[.55]"}`}>VALUE GRAPH</button><span className="ml-auto text-[7px] text-[#9da2a9]/[.55]">AUTO ZOOM</span></div><div id="nx-speed-graph" className="relative h-48 rounded-lg border border-[#737981]/[.16] bg-[#050204] nx-grid overflow-hidden"><svg viewBox="0 0 300 120" className="absolute inset-0 w-full h-full"><path d={path} fill="none" stroke="#9a6574" strokeWidth="2.5"/>{ramp.map((p,i)=>{const x=p.position*280+10,y=110-(p.speed/4)*90;return <g key={i}><line x1={x-28} y1={y} x2={x+28} y2={y} stroke="#9a6574" opacity=".25"/><circle cx={x-28} cy={y} r="3" fill="#9a6574" opacity=".55"/><circle cx={x+28} cy={y} r="3" fill="#9a6574" opacity=".55"/><rect x={x-4} y={y-4} width="8" height="8" transform={`rotate(45 ${x} ${y})`} fill="#9a6574" onPointerDown={()=>setDrag({i,h:"point"})}/></g>})}</svg><span className="absolute left-2 top-2 text-[7px] text-[#9da2a9]/[.55]">{mode==="SPEED"?"VELOCITY":"VALUE"}</span><span className="absolute left-2 bottom-2 text-[7px] text-[#9da2a9]/[.55]">TIME</span></div><div className="grid grid-cols-5 gap-1 mt-2">{["LINEAR","EASE IN","EASE OUT","EASY EASE","BEZIER"].map(x=><button key={x} className="rounded border border-[#737981]/[.12] py-1 text-[6px] text-[#aeb3b9]/[.60]">{x}</button>)}</div></div>;
}

function TransformPanel({p,advanced}:{p:any;advanced:boolean}){
  const Btn=({children,onClick,active}:any)=><button onClick={onClick} className={`w-full rounded-lg border px-3 py-2 text-[8px] font-bold tracking-widest ${active?"border-[#9a6574]/30 bg-[#241019]/10 text-[#e5e7eb]":"border-[#737981]/[.12] bg-[#160b10]/20 text-[#e5e7eb]/[.72]"}`}>{children}</button>;
  const R=({label,value,min=-100,max=100,set,property}:any)=><label className="block text-[8px] text-[#aeb3b9]/[.60] mb-3"><div className="flex items-center justify-between"><span>{label}</span>{property&&<button type="button" title="Select property for keyframing" onClick={()=>p.setSelectedProperty(property)} className="text-[12px] text-[#eee4dd] hover:text-white">◇</button>}</div><div className="flex items-center gap-2 mt-1"><input type="range" min={min} max={max} value={value} onChange={e=>set(Number(e.target.value))} className="w-full accent-[#9da2a9]"/><span className="w-10 text-right text-[#e5e7eb]/[.72]">{Math.round(value)}</span></div></label>;
  return <div className="space-y-3">
    <div><p className="text-[8px] font-black tracking-[.16em] text-[#c7cbd1]">TRANSFORM {advanced?"· ADVANCED":"· QUICK"}</p><p className="mt-1 text-[7px] text-[#969ca4]/[.52]">{advanced?"Professional transform controls with keyframe-ready properties.":"Fast /InShot-style transform controls."}</p></div>
    <R label="POSITION X" property="positionX" value={p.posX??0} min={-100} max={100} set={(v:number)=>p.setPosX(v)}/><R label="POSITION Y" property="positionY" value={p.posY??0} min={-100} max={100} set={(v:number)=>p.setPosY(v)}/>
    <R label="SCALE / ZOOM" property="scale" value={p.scale} min={50} max={300} set={p.setScale}/><R label="ROTATION" property="rotation" value={p.rotation??0} min={-180} max={180} set={(v:number)=>p.setRotation(v)}/>
    {advanced&&<><R label="SCALE X" value={p.scaleX??100} min={25} max={300} set={(v:number)=>p.setScaleX(v)}/><R label="SCALE Y" value={p.scaleY??100} min={25} max={300} set={(v:number)=>p.setScaleY(v)}/><R label="ANCHOR X" value={p.anchorX??0} min={-100} max={100} set={(v:number)=>p.setAnchorX(v)}/><R label="ANCHOR Y" value={p.anchorY??0} min={-100} max={100} set={(v:number)=>p.setAnchorY(v)}/><R label="SKEW" value={p.skew??0} min={-45} max={45} set={(v:number)=>p.setSkew(v)}/><Btn onClick={()=>p.setSubTool("Motion Blur")} active={p.subTool==="Motion Blur"}>MOTION BLUR</Btn><Btn onClick={p.addKeyframe}>◇ ADD TRANSFORM KEYFRAME</Btn></>}
    <div className="grid grid-cols-2 gap-2"><Btn onClick={()=>p.setFlipX?.(!p.flipX)}>FLIP H</Btn><Btn onClick={()=>p.setFlipY?.(!p.flipY)}>FLIP V</Btn></div>
  </div>;
}

function GraphEditor({keyframes,add,duration,setKeyframes}:{keyframes:{time:number;value:number;property:string}[];add:()=>void;duration:number;setKeyframes:(k:{time:number;value:number;property:string}[])=>void}){
  const [mode,setMode]=useState<"VALUE"|"SPEED">("VALUE");
  const drag=useRef<number|null>(null);

  useEffect(()=>{
    const move=(e:PointerEvent)=>{
      if(drag.current===null)return;
      const el=document.getElementById("nx-keyframe-graph");
      if(!el)return;
      const r=el.getBoundingClientRect();
      const t=Math.max(0,Math.min(duration,((e.clientX-r.left)/r.width)*duration));
      const v=Math.max(50,Math.min(200,200-((e.clientY-r.top)/r.height)*150));
      setKeyframes(keyframes.map((k,i)=>i===drag.current?{...k,time:t,value:v}:k).sort((a,b)=>a.time-b.time));
    };
    const up=()=>{drag.current=null};
    window.addEventListener("pointermove",move);
    window.addEventListener("pointerup",up);
    return()=>{
      window.removeEventListener("pointermove",move);
      window.removeEventListener("pointerup",up);
    };
  },[keyframes,duration,setKeyframes]);

  const points=keyframes.map((k,i)=>{
    const x=(k.time/Math.max(.001,duration))*280+10;
    const y=145-((k.value-50)/150)*120;
    return {k,i,x,y};
  });

  const path=points.map((p,i)=>`${i?"L":"M"} ${p.x} ${p.y}`).join(" ");

  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        <button data-nx-ghost="true" onClick={()=>setMode("VALUE")} className={`px-2 py-1 rounded text-[7px] ${mode==="VALUE"?"text-white":"text-[#969ca4]/[.55]"}`}>VALUE GRAPH</button>
        <button data-nx-ghost="true" onClick={()=>setMode("SPEED")} className={`px-2 py-1 rounded text-[7px] ${mode==="SPEED"?"text-white":"text-[#969ca4]/[.55]"}`}>SPEED GRAPH</button>
        <button onClick={add} className="ml-auto px-2 py-1 rounded border border-[#737981]/[.16] text-[7px]">◇ KEYFRAME</button>
      </div>
      <div id="nx-keyframe-graph" className="h-56 rounded-lg border border-[#737981]/[.16] bg-[#050204] nx-grid relative overflow-hidden">
        <svg viewBox="0 0 300 160" className="w-full h-full">
          {points.length>1&&<path d={path} fill="none" stroke="#9a6574" strokeWidth="2"/>}
          {points.map(({i,x,y})=>(
            <g key={i}>
              <line x1={x-25} y1={y} x2={x+25} y2={y} stroke="#9a6574" opacity=".25"/>
              <circle cx={x-25} cy={y} r="3" fill="#9a6574" opacity=".55"/>
              <circle cx={x+25} cy={y} r="3" fill="#9a6574" opacity=".55"/>
              <rect
                x={x-4}
                y={y-4}
                width="8"
                height="8"
                transform={`rotate(45 ${x} ${y})`}
                fill="#9a6574"
                onPointerDown={()=>{drag.current=i}}
              />
            </g>
          ))}
        </svg>
        <span className="absolute left-2 bottom-2 text-[7px] text-[#9da2a9]/[.55]">{mode==="VALUE"?"VALUE":"SPEED"} GRAPH · DRAG POINTS</span>
      </div>
      <div className="grid grid-cols-3 gap-1 mt-2">
        {["LINEAR","AUTO BEZIER","HOLD"].map(x=><button key={x} className="rounded border border-[#737981]/[.12] py-1 text-[6px] text-[#aeb3b9]/[.60]">{x}</button>)}
      </div>
    </div>
  );
}
function GraphWorkspace({keyframes,duration,add,setKeyframes,playhead}:{keyframes:{time:number;value:number;property:string}[];duration:number;add:()=>void;setKeyframes:(k:{time:number;value:number;property:string}[])=>void;playhead:number}){
  const ref=useRef<HTMLDivElement>(null); const drag=useRef<number|null>(null); const [ease,setEase]=useState("EASE IN OUT");
  useEffect(()=>{const move=(e:PointerEvent)=>{if(drag.current===null||!ref.current)return;const r=ref.current.getBoundingClientRect();const time=Math.max(0,Math.min(duration,((e.clientX-r.left)/r.width)*duration));const value=Math.max(50,Math.min(200,200-((e.clientY-r.top)/r.height)*150));setKeyframes(keyframes.map((k,i)=>i===drag.current?{...k,time,value}:k).sort((a,b)=>a.time-b.time))};const up=()=>{drag.current=null};window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);return()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up)}},[duration,keyframes,setKeyframes]);
  const pts=keyframes.map((k,i)=>({i,x:k.time/Math.max(.001,duration)*100,y:100-(k.value-50)/150*80})); const path=pts.map((p,i)=>(i?"L":"M")+" "+p.x+" "+p.y).join(" ");
  return <div className="h-full flex flex-col"><div className="flex items-center gap-2 mb-2"><b className="text-[7px] tracking-[.16em]">DESKTOP GRAPH EDITOR</b><span className="text-[6px] text-[#7f858d]">SCALE PROPERTY</span><button onClick={add} className="ml-auto rounded px-2 py-1 text-[6px]">+ KEYFRAME</button></div><div className="flex-1 min-h-0 flex gap-2"><div ref={ref} className="relative flex-1 rounded-lg border border-[#737981]/[.12] bg-[#030204] nx-grid"><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">{pts.length>1&&<path d={path} fill="none" stroke="#b58b98" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>}{pts.map(p=><circle key={p.i} cx={p.x} cy={p.y} r="2" fill="#ded6cf" stroke="#9a6574" strokeWidth=".8" onPointerDown={e=>{e.stopPropagation();drag.current=p.i}}/> )}</svg><span className="absolute left-2 bottom-1 text-[6px] text-[#7f858d]">PLAYHEAD {(duration*playhead/100).toFixed(2)}s</span></div><div className="w-28 rounded-lg border border-[#737981]/[.12] bg-[#0b0407] p-2"><p className="text-[6px] tracking-[.14em]">EASING</p>{["LINEAR","EASE IN","EASE OUT","EASE IN OUT","BEZIER","HOLD"].map(x=><button key={x} data-nx-ghost="true" onClick={()=>setEase(x)} className={"block w-full text-left mt-1 px-2 py-1 text-[6px] "+(ease===x?"bg-[#241019] text-white":"text-[#8e949c]")}>{x}</button>)}</div></div></div>;
}

function ExportCenter({platform,setPlatform,quality,setQuality,shield,setShield,duration,targetFps,onClose,onExport}:{platform:string;setPlatform:(x:string)=>void;quality:string;setQuality:(x:string)=>void;shield:boolean;setShield:(x:boolean)=>void;duration:number;targetFps:number;onClose:()=>void;onExport:()=>void}){
  const profiles:any={TIKTOK:["1080x1920","H.264","9:16"],YOUTUBE:["3840x2160","H.264","16:9"],INSTAGRAM:["1080x1920","H.264","9:16"],X:["1920x1080","H.264","16:9"],CUSTOM:["SOURCE","H.264","SOURCE"]}; const p=profiles[platform]||profiles.CUSTOM;
  return <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4"><div className="w-full max-w-xl rounded-2xl border border-[#737981]/[.18] bg-[#0b0407] shadow-2xl"><div className="p-4 border-b border-white/[.08] flex items-center"><div><b className="text-[9px] tracking-[.18em]">NEXUS EXPORT CENTER</b><p className="text-[6px] text-[#7f858d]">PLATFORM DELIVERY + QUALITY SHIELD</p></div><button data-nx-ghost="true" onClick={onClose} className="ml-auto text-xl">x</button></div><div className="p-4 grid grid-cols-2 gap-3"><div><p className="text-[7px] tracking-[.15em]">PLATFORM</p><div className="grid grid-cols-2 gap-1 mt-2">{Object.keys(profiles).map(x=><button key={x} onClick={()=>setPlatform(x)} className={"rounded px-2 py-2 text-[6px] "+(platform===x?"ring-1 ring-white":"")}>{x}</button>)}</div><p className="text-[7px] tracking-[.15em] mt-4">QUALITY</p><div className="grid grid-cols-3 gap-1 mt-2">{["MAXIMUM","BALANCED","SMALLER"].map(x=><button key={x} onClick={()=>setQuality(x)} className={"rounded py-2 text-[6px] "+(quality===x?"ring-1 ring-white":"")}>{x}</button>)}</div></div><div className="rounded-lg border border-white/[.08] p-3"><div className="flex justify-between"><b className="text-[7px]">QUALITY SHIELD</b><button onClick={()=>setShield(!shield)} className="rounded px-2 py-1 text-[6px]">{shield?"ON":"OFF"}</button></div><div className="grid grid-cols-2 gap-1 mt-3 text-[6px]"><span className="bg-[#11060a] p-2">PROFILE<br/><b>{p[0]}</b></span><span className="bg-[#11060a] p-2">ENCODE<br/><b>{p[1]}</b></span><span className="bg-[#11060a] p-2">ASPECT<br/><b>{p[2]}</b></span><span className="bg-[#11060a] p-2">FPS<br/><b>{targetFps}</b></span></div><p className="mt-3 text-[6px] leading-4 text-[#7f858d]">NEXUS prepares compatible H.264/yuv420p delivery with fast-start. Platforms can still recompress uploads.</p></div></div><div className="p-4 flex justify-end gap-2"><button data-nx-ghost="true" onClick={onClose} className="text-[7px]">CANCEL</button><button onClick={onExport} className="rounded px-4 py-2 text-[7px] font-black">EXPORT {platform}</button></div></div></div>;
}
function Timeline({onMediaDrop,timelineRef,clips,setClips,activeClip,setActiveClip,playhead,seek,split,deleteClip,duplicateClip,cutRange,rippleDelete,trimToPlayhead,markIn,markOut,reverseClip,freezeFrame,setFreezeDuration,duration,sceneThumbs,beatMarkers,setBeatMarkers,waveform,bpm,addManualBeat,autoBeatMarkers,clearBeatMarkers,zoom,setZoom,trackState,setTrackState,effectStack,keyframes,addKeyframe,speedRamp,rangeStart,rangeEnd}:{onMediaDrop:(x:number)=>void;timelineRef:RefObject<HTMLDivElement|null>;clips:Clip[];setClips:Dispatch<SetStateAction<Clip[]>>;activeClip:string|null;setActiveClip:(x:string|null)=>void;playhead:number;seek:(x:number)=>void;split:()=>void;deleteClip:()=>void;duplicateClip:()=>void;cutRange:()=>void;rippleDelete:()=>void;trimToPlayhead:(side:"start"|"end")=>void;markIn:()=>void;markOut:()=>void;reverseClip:()=>void;freezeFrame:()=>void;setFreezeDuration:(seconds:number)=>void;duration:number;sceneThumbs:string[];beatMarkers:BeatMarker[];setBeatMarkers:Dispatch<SetStateAction<BeatMarker[]>>;waveform:number[];bpm:number;addManualBeat:()=>void;autoBeatMarkers:()=>void;clearBeatMarkers:()=>void;zoom:number;setZoom:(x:number)=>void;trackState:{videoVisible:boolean;videoLocked:boolean;audioMuted:boolean;audioLocked:boolean};setTrackState:Dispatch<SetStateAction<{videoVisible:boolean;videoLocked:boolean;audioMuted:boolean;audioLocked:boolean}>>;effectStack:EffectLayer[];rangeStart:number|null;rangeEnd:number|null;keyframes:{time:number;value:number;property:string}[];addKeyframe:()=>void;speedRamp:SpeedPoint[]}) {
  const drag=useRef<{kind:"move"|"trimL"|"trimR";id:string;startX:number;start:number;end:number}|null>(null); const playheadDrag=useRef(false);
  useEffect(()=>{const mv=(e:PointerEvent)=>{const d=drag.current;if(!d||!timelineRef.current)return;const r=timelineRef.current.getBoundingClientRect(),delta=e.clientX-d.startX;const pct=delta/r.width*100;setClips(cs=>cs.map(c=>{if(c.id!==d.id)return c;if(d.kind==="trimL"){const ns=Math.max(0,Math.min(d.end-.5,d.start+pct)),sd=ns-d.start;return {...c,start:ns,sourceStart:Math.max(0,Math.min(c.sourceEnd-.5,c.sourceStart+sd))};}if(d.kind==="trimR"){const ne=Math.min(100,Math.max(d.start+.5,d.end+pct)),sd=ne-d.end;return {...c,end:ne,sourceEnd:Math.min(100,Math.max(c.sourceStart+.5,c.sourceEnd+sd))};}const w=d.end-d.start,ns=Math.max(0,Math.min(100-w,d.start+pct));return {...c,start:ns,end:ns+w};}));};const up=()=>{drag.current=null};window.addEventListener("pointermove",mv);window.addEventListener("pointerup",up);return()=>{window.removeEventListener("pointermove",mv);window.removeEventListener("pointerup",up)}},[timelineRef,setClips]);
  const begin=(kind:"move"|"trimL"|"trimR",c:Clip,e:React.PointerEvent)=>{e.preventDefault();e.stopPropagation();setActiveClip(c.id);drag.current={kind,id:c.id,startX:e.clientX,start:c.start,end:c.end};};
  const pos=(x:number)=>{if(!timelineRef.current)return;const r=timelineRef.current.getBoundingClientRect();seek(Math.max(0,Math.min(100,(x-r.left)/r.width*100)));};
  const addMarkerAt=(x:number)=>{if(!timelineRef.current)return;const r=timelineRef.current.getBoundingClientRect(),time=Math.max(0,Math.min(duration,(x-r.left)/r.width*duration));setBeatMarkers(m=>[...m,{id:crypto.randomUUID(),time,strength:"beat" as const,label:"MARK"}].sort((a,b)=>a.time-b.time));};
  const marker=(m:BeatMarker)=><button key={m.id} data-nx-ghost="true" title={m.label??"Beat"} onClick={e=>{e.stopPropagation();seek(m.time/Math.max(.001,duration)*100)}} className="absolute top-0 z-30 -translate-x-1/2" style={{left:`${m.time/Math.max(.001,duration)*100}%`}}><span className={`block w-0.5 h-3 ${m.strength==="strong"?"bg-[#eee4d9]":"bg-[#9a6574]"}`}/><span className="text-[4px] text-[#cfc7c2]">{m.strength==="strong"?"◆":"•"}</span></button>;
  const btn=(label:string,fn:()=>void)=><button data-nx-ghost="true" onClick={fn} className="rounded px-2 py-1 text-[6px] text-[#bfc4ca] hover:text-white">{label}</button>;
  return <div className="bg-[#050204] border-t border-white/[.10] min-h-0">
    <div className="h-8 flex items-center justify-between px-2 border-b border-white/[.08] bg-[#0b0307]"><div className="flex items-center gap-1"><span className="text-[6px] font-black tracking-[.16em]">TIMELINE</span><span className="text-[5px] text-[#7f858d]">{bpm?bpm+" BPM":"AUDIO READY"}</span>{btn("AUTO BEAT",autoBeatMarkers)}{btn("+ BEAT",addManualBeat)}{btn("CLEAR",clearBeatMarkers)}</div><div className="flex items-center gap-1">{btn("−",()=>setZoom(Math.max(.75,zoom-.25)))}<span className="text-[5px]">{Math.round(zoom*100)}%</span>{btn("+",()=>setZoom(Math.min(2.5,zoom+.25)))}{btn("IN",markIn)}{btn("OUT",markOut)}{btn("SPLIT",split)}{btn("CUT",cutRange)}{btn("TRIM END",()=>trimToPlayhead("end"))}{btn("RIPPLE DELETE",rippleDelete)}{btn("DELETE",deleteClip)}{btn("DUP",duplicateClip)}{btn("REVERSE",reverseClip)}{btn("FREEZE",freezeFrame)}{btn("KEYFRAME +",addKeyframe)}</div></div>
    <div ref={timelineRef} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();onMediaDrop(e.clientX)}} className="relative h-[197px] overflow-x-auto overflow-y-hidden nx-scroll select-none">
      <div className="relative h-full" style={{width:`${Math.max(100,zoom*100)}%`}}>
        <div className="absolute inset-x-0 top-0 h-6 border-b border-white/[.08] bg-[#0b0307]">{[0,10,20,30,40,50,60,70,80,90,100].map(p=><span key={p} className="absolute top-1 text-[5px] text-[#d7d0cc]/[.58]" style={{left:`${p}%`}}>{(duration*p/100).toFixed(2)}s</span>)}</div>
        <div className="absolute inset-x-0 top-6 h-5 border-b border-white/[.06] bg-[#080306]">{rangeStart!==null&&rangeEnd!==null&&<div className="absolute top-0 bottom-0 bg-[#9a6574]/20 border-x border-[#9a6574]/60 pointer-events-none" style={{left:`${Math.min(rangeStart,rangeEnd)}%`,width:`${Math.abs(rangeEnd-rangeStart)}%`}}/>}<div className="absolute left-0 top-0 w-10 text-[5px] text-center py-1">MARK</div><div className="absolute left-10 right-0 top-0 h-full" onDoubleClick={e=>addMarkerAt(e.clientX)}>{beatMarkers.map(marker)}</div></div>
        <div className="absolute inset-x-0 top-11 h-8 flex border-b border-white/[.08]"><div className="w-10 shrink-0 border-r border-white/[.10] flex items-center justify-center gap-1"><button data-nx-ghost="true" onClick={()=>setTrackState(s=>({...s,videoVisible:!s.videoVisible}))}>{trackState.videoVisible?"◉":"○"}</button><span className="text-[5px] font-black">V1</span></div><div className="relative flex-1 overflow-hidden opacity-50">{sceneThumbs.map((s,i)=><img key={i} src={s} alt="" className="h-full flex-1 min-w-0 object-cover" />)}</div></div>
        <div className="absolute inset-x-0 top-[91px] h-[70px] flex border-b border-white/[.08] bg-[#070306]"><div className="w-10 shrink-0 border-r border-white/[.10] flex flex-col items-center justify-center"><span className="text-[5px] font-black">V1</span><button data-nx-ghost="true" onClick={()=>setTrackState(s=>({...s,videoLocked:!s.videoLocked}))} className="text-[5px]">{trackState.videoLocked?"🔒":"🔓"}</button></div><div className="relative flex-1" onPointerDown={e=>{if((e.target as HTMLElement).closest(".nx-clip,.nx-handle"))return;pos(e.clientX)}}>{clips.map(c=><div key={c.id} className={`nx-clip absolute top-2 bottom-2 rounded-md overflow-hidden border cursor-grab ${activeClip===c.id?"border-[#eee4dd] ring-1 ring-[#9a6574]/60":"border-[#737981]/20"}`} style={{left:`${c.start}%`,width:`${c.end-c.start}%`,backgroundColor:c.color+"30"}} onPointerDown={e=>begin("move",c,e)}><div className="absolute inset-0 flex pointer-events-none">{sceneThumbs.length?sceneThumbs.map((s,i)=><img key={i} src={s} alt="" className="h-full flex-1 min-w-0 object-cover opacity-65"/>):<div className="w-full h-full bg-[#241019]"/>}</div><div className="relative z-10 flex justify-between"><span className="truncate px-2 py-1 text-[6px] font-black bg-[#11060a]/75 max-w-[70%]">{c.name}</span><span className="m-1 px-1 rounded bg-black/60 text-[5px]">{((c.end-c.start)/100*duration).toFixed(2)}s {c.reverse?"↔":""} {c.freezeDuration?"❄":""}</span></div>{activeClip===c.id&&<><div className="nx-handle absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize bg-[#9a6574]/80 z-20" onPointerDown={e=>begin("trimL",c,e)}/><div className="nx-handle absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize bg-[#9a6574]/70 z-20" onPointerDown={e=>begin("trimR",c,e)}/></>}</div>)}{clips.slice(0,-1).map((c,i)=>{const n=clips[i+1];return n&&Math.abs(c.end-n.start)<=.8?<button key={c.id+"tr"} data-nx-ghost="true" title="Transition" className="absolute z-30 top-7 -translate-x-1/2 rounded bg-[#9a6574] text-[#16070b] px-1 text-[4px]" style={{left:`${n.start}%`}}>TR</button>:null})}</div></div>
        <div className="absolute inset-x-0 top-[161px] h-9 flex border-b border-white/[.08] bg-[#070306]"><div className="w-10 shrink-0 border-r border-white/[.10] flex items-center justify-center gap-1"><button data-nx-ghost="true" onClick={()=>setTrackState(s=>({...s,audioMuted:!s.audioMuted}))}>{trackState.audioMuted?"🔇":"🔊"}</button><span className="text-[5px] font-black">A1</span></div><div className="relative flex-1 overflow-hidden">{waveform.map((v,i)=><span key={i} className="absolute bottom-0 w-[.45%] min-w-[1px] rounded-t bg-[#9a6574]/55" style={{left:`${i/waveform.length*100}%`,height:`${Math.max(3,v*28)}px`}}/>)}{!waveform.length&&<span className="absolute inset-2 rounded bg-[#11060a]"/>}</div></div>
        <div className="absolute inset-x-0 top-[170px] h-7 flex bg-[#080306]"><div className="w-10 shrink-0 border-r border-white/[.10] text-[5px] flex items-center justify-center">FX</div><div className="relative flex-1">{effectStack.map((e,i)=><span key={e.id} className="absolute top-1 px-1 rounded bg-[#9a6574]/45 text-[4px]" style={{left:`${Math.min(96,i*8)}%`}}>{effectNames[e.effect]??e.effect}</span>)}{keyframes.map(k=><button key={k.time} data-nx-ghost="true" title="Keyframe" onClick={e=>{e.stopPropagation();seek(k.time/Math.max(.001,duration)*100)}} className="absolute bottom-0.5 w-2 h-2 rotate-45 bg-[#eee4dd]" style={{left:`${k.time/Math.max(.001,duration)*100}%`}}/>)}{speedRamp.map(p=><span key={p.position} className="absolute bottom-1 w-1 h-1 rounded-full bg-[#9a6574]" style={{left:`${p.position*100}%`}}/>)}</div></div>
        <div className="absolute top-0 bottom-0 w-px bg-[#e1d4d8] z-40 pointer-events-none" style={{left:`${playhead}%`}}/><button data-nx-ghost="true" aria-label="Move playhead" className="absolute top-0 bottom-0 w-7 -ml-3.5 cursor-ew-resize z-50 bg-transparent" style={{left:`${playhead}%`}} onPointerDown={e=>{e.preventDefault();e.stopPropagation();playheadDrag.current=true;pos(e.clientX)}} onPointerMove={e=>{if(playheadDrag.current)pos(e.clientX)}} onPointerUp={()=>{playheadDrag.current=false}} onPointerCancel={()=>{playheadDrag.current=false}}/>
      </div>
    </div>
  </div>;
}
function ToolDock({tool,setTool,level,setLevel,autoEditOpen,setAutoEditOpen}:{tool:Tool;setTool:(x:Tool)=>void;level:"BEGINNER"|"ADVANCED";setLevel:(x:"BEGINNER"|"ADVANCED")=>void;autoEditOpen:boolean;setAutoEditOpen:(x:boolean)=>void}){
  const items=level==="BEGINNER"?beginnerTools:advancedTools;
  return <div className="h-[76px] shrink-0 border-y border-white/[.08] bg-[#0b0508] flex flex-col">
    <div className="h-7 shrink-0 flex items-center gap-1 px-2 border-b border-white/[.06]">
      <span className="text-[6px] font-black tracking-[.18em] text-[#aeb4bc]/[.55] mr-1">TOOL LEVEL</span>
      <button data-nx-ghost="true" onClick={()=>setLevel("BEGINNER")} className={`px-2 py-1 text-[7px] tracking-wider ${level==="BEGINNER"?"text-[#eee4dd]":"text-[#969ca4]/[.48]"}`}>BEGINNER / INTERMEDIATE</button>
      <button data-nx-ghost="true" onClick={()=>setLevel("ADVANCED")} className={`px-2 py-1 text-[7px] tracking-wider ${level==="ADVANCED"?"text-[#eee4dd]":"text-[#969ca4]/[.48]"}`}>ADVANCED / PRO</button>
      <span className="ml-auto text-[6px] text-[#7f858d]/[.42]">ALL TOOLS AVAILABLE</span>
    </div>
    <div className="flex-1 flex items-center gap-1.5 px-2 overflow-x-auto nx-scroll">
      <button data-nx-ghost="true" onClick={()=>setAutoEditOpen(!autoEditOpen)} className="nx-auto-edit shrink-0 h-[52px] min-w-[82px] rounded-md flex flex-col items-center justify-center gap-0.5 font-black">
        <Sparkles className="h-4 w-4"/><span className="nx-tool-label !text-[#24191d]">Auto Edit</span>
      </button>
      {items.map(t=><button key={`${level}-${t.id}-${t.label}`} data-nx-ghost="true" title={t.label} onClick={()=>setTool(t.id)} className={`nx-tool shrink-0 rounded-md flex flex-col items-center justify-center gap-0.5 text-[#bfc4ca] ${tool===t.id?"active":"hover:bg-[#2f3237]"}`}><ToolGlyph tool={t.id}/><span className="nx-tool-label">{t.label}</span></button>)}
    </div>
  </div>;
}
function PresetPanel({title,items,src,active,onSelect}:{title:string;items:{id:string;label:string}[];src:string|null;active:string;onSelect:(id:string)=>void}){
  return <div><div className="flex items-center justify-between mb-2"><p className="text-[8px] font-black tracking-[.16em] text-[#c7cbd1]">{title}</p><span className="text-[6px] text-[#92979e]">PREVIEW</span></div><div className="grid grid-cols-2 gap-2">{items.map(item=><button key={item.id} onClick={()=>onSelect(item.id)} className={`group rounded-lg overflow-hidden border text-left ${active===item.id?"border-[#9a6574] bg-[#11060a]":"border-white/[.08] bg-[#160b10]"}`}><div className="h-16 relative bg-[#11060a]">{src?<video src={src} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover opacity-80"/>:<div className="absolute inset-0 bg-[#11060a]"/>}<div className="absolute inset-0 bg-gradient-to-br from-transparent via-[#ffffff]/[.04] to-[#000000]/40"/><span className="absolute bottom-1 left-1 rounded bg-[#111214]/70 px-1 py-0.5 text-[6px] text-[#d4d7dc]">{item.label}</span></div><div className="px-2 py-1.5 text-[7px] font-semibold text-[#c7cbd1] truncate">{item.label}</div></button>)}</div></div>;
}
function Landing({projects,onPick,onOpen,fileRef,onChoose}:{projects:any[];onPick:()=>void;onOpen:(id:string)=>void;fileRef:any;onChoose:(f?:File)=>void}){
  const [dragging,setDragging]=useState(false);
  const handleDrop=(e:React.DragEvent<HTMLDivElement>)=>{e.preventDefault();setDragging(false);const file=e.dataTransfer.files?.[0];if(file)onChoose(file);};
  return <main className="nx-home min-h-screen text-[#f5f0ed] flex flex-col">
    <header className="nx-home-header h-[68px] shrink-0 px-5 sm:px-9 flex items-center justify-between">
      <div className="flex items-center gap-3"><div className="nx-brand-mark"><Clapperboard className="h-5 w-5"/></div><div><b className="text-[15px] tracking-[.22em]">NEXUS</b><p className="text-[9px] tracking-[.24em] text-[#b8a9ae]">CREATIVE STUDIO</p></div></div>
      <div className="hidden sm:flex items-center gap-7 text-[11px] text-[#b9b0b2]"><span>VIDEO EDITING</span><span>MOTION DESIGN</span><span>LOCAL-FIRST WORKSPACE</span></div>
      <span className="nx-status-pill"><span/> READY TO CREATE</span>
    </header>
    <section className="nx-home-main flex-1 w-full max-w-[1480px] mx-auto px-5 sm:px-9 py-8 sm:py-12">
      <div className="max-w-3xl mb-8 sm:mb-10"><p className="nx-eyebrow">YOUR CREATIVE WORKSPACE</p><h1 className="mt-3 text-4xl sm:text-5xl lg:text-[62px] leading-[1.04] font-semibold tracking-[-.055em]">Make every frame<br/><span>move with purpose.</span></h1><p className="mt-5 max-w-2xl text-sm sm:text-base leading-7 text-[#b9afb2]">Cut with speed. Shape motion with precision. Build your next video in one flexible timeline — from quick edits to detailed keyframe animation.</p></div>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_350px] gap-5 lg:gap-7 min-h-[430px]">
        <div onDragOver={e=>{e.preventDefault();setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={handleDrop} className={"nx-import-card relative overflow-hidden rounded-[26px] border transition-all "+(dragging?"is-dragging":"")}>
          <div className="nx-import-glow"/><div className="relative z-10 h-full min-h-[420px] p-6 sm:p-10 flex flex-col">
            <div className="flex items-center justify-between"><span className="nx-eyebrow">START A NEW PROJECT</span><span className="nx-format-tag">UP TO 650 MB</span></div>
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <div className="nx-import-icon"><FileInput className="h-8 w-8"/></div>
              <h2 className="mt-6 text-2xl sm:text-3xl font-semibold tracking-tight">{dragging?"Drop your footage here":"Bring your story to life."}</h2>
              <p className="mt-3 text-sm text-[#b9afb2]">Drag a video into this space, or browse files on your device.</p>
              <button onClick={onPick} className="nx-primary-button mt-7"><Plus className="h-4 w-4"/> Import media</button>
              <p className="mt-5 text-[10px] tracking-[.16em] text-[#93868b]">MP4 · MOV · WEBM · M4V · AVI · MKV</p>
            </div>
            <div className="nx-workflow-strip"><div><Clapperboard/><span>QUICK EDITS</span></div><div><AudioWaveform/><span>AUDIO & RHYTHM</span></div><div><Layers3/><span>LAYERS & KEYFRAMES</span></div><div><Sparkles/><span>EFFECTS & COLOR</span></div></div>
          </div>
        </div>
        <aside className="nx-projects-panel rounded-[24px] overflow-hidden flex flex-col">
          <div className="p-5 sm:p-6 border-b border-white/[.08]"><div className="flex items-center justify-between"><div><p className="nx-eyebrow">PICK UP WHERE YOU LEFT OFF</p><h3 className="mt-2 text-xl font-semibold">Recent projects</h3></div><span className="nx-project-count">{projects.length}</span></div><p className="mt-2 text-xs leading-5 text-[#a99da1]">Projects are saved locally in this browser.</p></div>
          <div className="flex-1 min-h-[180px] overflow-auto p-4">{projects.length?projects.map(p=><button key={p.id} onClick={()=>onOpen(p.id)} className="nx-project-row w-full text-left rounded-xl p-3 mb-2 flex items-center gap-3"><div className="nx-project-thumb"><Film className="h-5 w-5"/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#eee6e4]">{p.name}</p><p className="mt-1 text-[10px] text-[#a99da1]">{(p.fileSize/1048576).toFixed(1)} MB · LOCAL PROJECT</p></div><ChevronDown className="h-4 w-4 -rotate-90 text-[#a99da1]"/></button>):<div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center px-5"><div className="nx-empty-icon"><Film className="h-5 w-5"/></div><p className="mt-4 text-sm font-medium">Your next project starts here</p><p className="mt-2 max-w-[220px] text-xs leading-5 text-[#a99da1]">Import footage to create a project. Your recent work will appear in this space.</p></div>}</div>
          <div className="p-4 border-t border-white/[.08]"><div className="flex items-center justify-between text-[10px] text-[#a99da1]"><span>BUILT FOR CREATORS</span><span>CAPCUT SPEED · MOTION DEPTH</span></div></div>
        </aside>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mt-6"><div className="nx-feature-tile"><Scissors/><div><b>Fast editing</b><p>Trim, split, arrange and refine clips.</p></div></div><div className="nx-feature-tile"><Gauge/><div><b>Motion control</b><p>Animate properties with keyframes and curves.</p></div></div><div className="nx-feature-tile"><Palette/><div><b>Creative finishing</b><p>Shape color, sound, effects and delivery.</p></div></div></div>
    </section>
    <footer className="px-5 sm:px-9 py-5 border-t border-white/[.07] text-[10px] text-[#887c81] flex justify-between"><span>NEXUS CREATIVE STUDIO</span><span>YOUR MEDIA STAYS ON THIS DEVICE</span></footer>
    <input ref={fileRef} type="file" accept="video/*,.mp4,.mov,.webm,.m4v,.avi,.mkv,.mpeg,.mpg,.3gp" className="hidden" onChange={e=>{const input=e.currentTarget;onChoose(input.files?.[0]);input.value="";}}/>
  </main>;
}

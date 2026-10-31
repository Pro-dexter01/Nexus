import { useEffect, useMemo, useState, type RefObject, type Dispatch, type SetStateAction } from "react";
import {
  Activity, AudioLines, AudioWaveform, Captions, ChevronDown, CircleDot, Clapperboard, Crop,
  Crosshair, Diamond, Download, Eraser, Eye, Film, Gauge, Grid3X3, Layers3, Lock, Maximize2,
  Mic2, Move3D, Music2, Palette, Pause, Play, Plus, RotateCcw, Scissors, Search, Settings2,
  SlidersHorizontal, Sparkles, Split, Star, Sticker, Trash2, Type, Undo2, Volume2, VolumeX,
  Wand2, Waves, X, ZoomIn
} from "lucide-react";

type ToolId =
  | "MEDIA"|"EDIT"|"AUDIO"|"TEXT"|"STICKERS"|"EFFECTS"|"TRANSITIONS"|"FILTERS"|"ADJUST"
  | "COLOR"|"TRANSFORM"|"SPEED"|"ANIMATION"|"MASK"|"LAYERS"|"GRAPH"|"CAPTIONS"|"TRACKING"
  | "REMOVE_BG"|"RETOUCH"|"STABILIZE"|"KEYFRAMES"|"STOCK"|"SOUND_FX"|"VOICE"|"ENHANCE";

type Clip = { id:string; name:string; start:number; end:number; sourceStart:number; sourceEnd:number; color:string; reverse?:boolean; freezeAt?:number; freezeDuration?:number; speed?:number };
type BeatMarker = { id:string; time:number; strength:"strong"|"beat"; label?:string };
type EffectLayer = { id:string; effect:string; enabled:boolean; opacity:number };
type SpeedPoint = { position:number; speed:number };

export type NexusEditorDashboardProps = {
  file: File; src:string|null; output:string|null; videoRef:RefObject<HTMLVideoElement|null>;
  duration:number; setDuration:(v:number)=>void; playhead:number; setPlayhead:(v:number)=>void;
  seek:(v:number)=>void; playing:boolean; setPlaying:(v:boolean)=>void; muted:boolean; setMuted:(v:boolean)=>void;
  tool:string; setTool:(v:ToolId)=>void; subTool:string; setSubTool:(v:string)=>void;
  clips:Clip[]; setClips:Dispatch<SetStateAction<Clip[]>>; activeClip:string|null; setActiveClip:(v:string|null)=>void;
  effect:string; setEffect:(v:any)=>void; effectStack:EffectLayer[]; updateEffectLayer:(id:string,p:Partial<EffectLayer>)=>void; removeEffectLayer:(id:string)=>void;
  speed:number; setSpeed:(v:number)=>void; speedRamp:SpeedPoint[]; updateRamp:(i:number,p:Partial<SpeedPoint>)=>void;
  volume:number; setVolume:(v:number)=>void; pan:number; setPan:(v:number)=>void; bass:number; setBass:(v:number)=>void; treble:number; setTreble:(v:number)=>void;
  adjustment:any; setAdjustment:Dispatch<SetStateAction<any>>; resetAdjustments:()=>void;
  text:string; setText:(v:string)=>void; mask:string; setMask:(v:any)=>void; maskFeather:number; setMaskFeather:(v:number)=>void;
  blendMode:string; setBlendMode:(v:string)=>void; chromaKey:boolean; setChromaKey:(v:boolean)=>void; chromaColor:string; setChromaColor:(v:string)=>void;
  scale:number; setScale:(v:number)=>void; posX:number; setPosX:(v:number)=>void; posY:number; setPosY:(v:number)=>void; rotation:number; setRotation:(v:number)=>void;
  scaleX:number; setScaleX:(v:number)=>void; scaleY:number; setScaleY:(v:number)=>void; opacity:number; setOpacity:(v:number)=>void;
  keyframes:{time:number;value:number;property:string}[]; addKeyframe:()=>void; setKeyframes:Dispatch<SetStateAction<any[]>>; selectedProperty:string; setSelectedProperty:(v:string)=>void;
  waveform:number[]; beatMarkers:BeatMarker[]; addManualBeat:()=>void; autoBeatMarkers:()=>void; clearBeatMarkers:()=>void;
  targetFps:number; setTargetFps:(v:number)=>void; enhance:boolean; setEnhance:(v:boolean)=>void;
  compression:string; setCompression:(v:any)=>void; processing:boolean; progress:number; process:(mode:"export"|"enhance")=>Promise<void>|void;
  error:string; setError:(v:string)=>void;
  split:()=>void; deleteClip:()=>void; duplicateClip:()=>void; cutRange:()=>void; rippleDelete:()=>void; trimToPlayhead:(side:"start"|"end")=>void;
  reverseClip:()=>void; freezeFrame:()=>void; markIn:()=>void; markOut:()=>void; rangeStart:number|null; rangeEnd:number|null;
  mediaCollapsed:boolean; setMediaCollapsed:(v:boolean)=>void; fileRef:RefObject<HTMLInputElement|null>;
};

const toolGroups:{title:string;items:[ToolId,string,any][]}[] = [
  {title:"PROJECT",items:[["MEDIA","Media",Film],["EDIT","Edit",Scissors],["LAYERS","Layers",Layers3],["TRANSFORM","Transform",Maximize2]]},
  {title:"MOTION",items:[["KEYFRAMES","Keyframes",Diamond],["GRAPH","Graph",Waves],["ANIMATION","Animation",Activity],["SPEED","Speed",Gauge],["TRACKING","Tracking",Crosshair],["STABILIZE","Stabilize",CircleDot]]},
  {title:"VISUAL",items:[["EFFECTS","Effects",Wand2],["TRANSITIONS","Transitions",Split],["FILTERS","Filters",Star],["ADJUST","Adjust",SlidersHorizontal],["COLOR","Color",Palette],["MASK","Masks",Crop],["REMOVE_BG","Remove BG",Eraser],["RETOUCH","Retouch",Sparkles],["ENHANCE","Enhance",Sparkles]]},
  {title:"AUDIO",items:[["AUDIO","Audio",AudioWaveform],["SOUND_FX","Sound FX",Music2],["VOICE","Voice",Mic2]]},
  {title:"TYPE & ASSETS",items:[["TEXT","Text",Type],["CAPTIONS","Captions",Captions],["STICKERS","Stickers",Sticker],["STOCK","Stock",Grid3X3]]}
];

const effectNames = ["Glow","RGB Split","Glitch","Shake","Blur","Chromatic","Vignette","Film Grain","Warp","Zoom Punch","Flash","Bloom","Scanlines","Noise","Pixelate","Edge","Invert","Sepia","Thermal","Dream","Tilt Shift"];

function Section({title,children,action}:{title:string;children:any;action?:any}) {
  return <section className="border-b border-white/[.07] pb-4 mb-4"><div className="flex items-center justify-between mb-3"><h3 className="text-[10px] font-bold tracking-[.16em] text-[#ddd5d3]">{title}</h3>{action}</div>{children}</section>;
}
function Range({label,value,min,max,onChange,step=1,unit=""}:{label:string;value:number;min:number;max:number;onChange:(v:number)=>void;step?:number;unit?:string}) {
  return <label className="block mb-4"><div className="flex justify-between text-[11px] text-[#a8a2a5] mb-2"><span>{label}</span><span className="text-[#e7e0df] tabular-nums">{Number(value).toFixed(step<1?2:0)}{unit}</span></div><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} className="w-full accent-[#a76b7e]"/></label>;
}
function ToolRail({active,onSelect}:{active:string;onSelect:(v:ToolId)=>void}) {
  return <aside className="w-[84px] shrink-0 border-r border-white/[.08] bg-[#080507] overflow-y-auto px-2 py-3">
    <button onClick={()=>onSelect("MEDIA")} className="w-full h-10 rounded-lg border border-white/[.08] bg-[#12090d] flex items-center justify-center mb-4"><Clapperboard className="h-4 w-4 text-[#d8cdca]"/></button>
    {toolGroups.map(g=><div key={g.title} className="mb-4"><div className="px-1 mb-2 text-[7px] tracking-[.12em] text-[#6f686c]">{g.title}</div>{g.items.map(([id,label,Icon])=><button key={id} title={label} onClick={()=>onSelect(id)} className={`w-full h-[58px] rounded-lg mb-1 flex flex-col items-center justify-center gap-1 border transition-colors ${active===id?"bg-[#2a141d] border-[#9b6476]/60 text-[#f1e7e4]":"border-transparent text-[#8e888b] hover:bg-[#130b0f] hover:text-[#d9d1d0]"}`}><Icon className="h-[17px] w-[17px]"/><span className="text-[8px]">{label}</span></button>)}</div>)}
  </aside>;
}
function MediaPool({p}:{p:NexusEditorDashboardProps}) {
  return <aside className="w-[224px] shrink-0 border-r border-white/[.08] bg-[#090608] flex flex-col">
    <div className="h-12 px-4 border-b border-white/[.07] flex items-center justify-between"><span className="text-[10px] font-bold tracking-[.16em]">MEDIA POOL</span><button onClick={()=>p.fileRef.current?.click()} className="h-7 w-7 rounded-md border border-white/[.1] flex items-center justify-center"><Plus className="h-4 w-4"/></button></div>
    <div className="p-3"><button onClick={()=>p.fileRef.current?.click()} className="w-full rounded-xl border border-dashed border-[#8f6370]/45 bg-[#130a0e] py-6 text-center hover:bg-[#1b0e14]"><Film className="mx-auto h-7 w-7 text-[#9e6879]"/><span className="mt-2 block text-[9px] font-semibold text-[#d6cecf]">IMPORT MEDIA</span><span className="mt-1 block text-[8px] text-[#716b6f]">Add footage to project</span></button></div>
    <div className="px-3"><div className="rounded-xl border border-white/[.08] bg-[#10090c] overflow-hidden"><div className="aspect-video bg-gradient-to-br from-[#28131d] to-[#090507] flex items-center justify-center"><Film className="h-8 w-8 text-[#9b6878]/60"/></div><div className="p-3"><p className="truncate text-[10px] text-[#ddd7d7]">{p.file.name}</p><p className="mt-1 text-[8px] text-[#777174]">{(p.file.size/1048576).toFixed(1)} MB · SOURCE</p></div></div></div>
    <div className="mt-auto p-3 border-t border-white/[.07] text-[8px] text-[#666064]"><div className="flex justify-between"><span>PROJECT MEDIA</span><span>01</span></div></div>
  </aside>;
}
function Viewer({p}:{p:NexusEditorDashboardProps}) {
  return <div className="min-h-0 flex-1 bg-[#060507] flex flex-col">
    <div className="h-11 shrink-0 border-b border-white/[.07] px-4 flex items-center justify-between"><div className="flex items-center gap-3"><span className="text-[9px] text-[#8c8589]">VIEWER</span><span className="h-1 w-1 rounded-full bg-[#a76b7e]"/><span className="text-[9px] text-[#777074]">{p.tool} / {p.subTool || "DEFAULT"}</span></div><div className="flex items-center gap-3 text-[9px] text-[#777074]"><span>FIT</span><span>100%</span><span>{p.duration.toFixed(2)}s</span></div></div>
    <div className="min-h-0 flex-1 relative flex items-center justify-center p-8 bg-[radial-gradient(circle,#21141a_0%,#080609_55%)]"><div className="relative max-h-full max-w-full aspect-video min-w-[280px] rounded-sm overflow-hidden shadow-2xl border border-white/[.06]"><video ref={p.videoRef} src={p.output??p.src??undefined} muted={p.muted} playsInline preload="metadata" className="h-full w-full object-contain bg-black" onLoadedMetadata={e=>p.setDuration(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration||1:1)} onError={()=>p.setError("NEXUS could not decode this video in your browser. Try MP4 (H.264/AAC) or another supported format.")} onTimeUpdate={e=>p.setPlayhead(p.duration?(p.videoRef.current?.currentTime ?? 0)/p.duration*100:0)} onEnded={()=>p.setPlaying(false)}/>{p.text&&<div className="absolute inset-0 flex items-center justify-center pointer-events-none"><span className="text-4xl font-black text-white drop-shadow-[0_3px_18px_rgba(0,0,0,.8)]">{p.text}</span></div>}</div></div>
    <div className="h-12 shrink-0 border-t border-white/[.07] flex items-center justify-center gap-4"><button onClick={()=>{const v=p.videoRef.current;if(!v)return;if(v.paused){void v.play();p.setPlaying(true)}else{v.pause();p.setPlaying(false)}}} className="h-8 w-8 rounded-full bg-[#ded5d2] text-[#171114] flex items-center justify-center">{p.playing?<Pause className="h-4 w-4"/>:<Play className="h-4 w-4"/>}</button><button onClick={()=>p.setMuted(!p.muted)} className="h-8 w-8 rounded-md border border-white/[.1] flex items-center justify-center">{p.muted?<VolumeX className="h-4 w-4"/>:<Volume2 className="h-4 w-4"/>}</button><button onClick={()=>p.seek(0)} className="text-[9px] text-[#8f888c]">00:00</button><span className="text-[10px] tabular-nums text-[#bcb5b8]">{(p.duration*p.playhead/100).toFixed(2)} / {p.duration.toFixed(2)}</span></div>
  </div>;
}
function Inspector({p}:{p:NexusEditorDashboardProps}) {
  const [tab,setTab]=useState<"INSPECTOR"|"EFFECTS">("INSPECTOR");
  const setAdj=(key:string,v:number)=>p.setAdjustment(a=>({...a,[key]:v}));
  const properties = useMemo(()=>[
    ["Scale",p.scale,25,300,p.setScale,"scale"],["Position X",p.posX,-100,100,p.setPosX,"positionX"],["Position Y",p.posY,-100,100,p.setPosY,"positionY"],["Rotation",p.rotation,-180,180,p.setRotation,"rotation"],["Opacity",p.opacity,0,100,p.setOpacity,"opacity"]
  ] as const,[p.scale,p.posX,p.posY,p.rotation,p.opacity]);
  return <aside className="w-[300px] shrink-0 border-l border-white/[.08] bg-[#090608] flex flex-col">
    <div className="h-12 shrink-0 border-b border-white/[.07] grid grid-cols-2"><button onClick={()=>setTab("INSPECTOR")} className={`text-[9px] font-bold tracking-[.14em] ${tab==="INSPECTOR"?"text-white border-b border-[#b07182]":"text-[#70696d]"}`}>INSPECTOR</button><button onClick={()=>setTab("EFFECTS")} className={`text-[9px] font-bold tracking-[.14em] ${tab==="EFFECTS"?"text-white border-b border-[#b07182]":"text-[#70696d]"}`}>EFFECT STACK</button></div>
    <div className="flex-1 overflow-y-auto p-4">
      {tab==="EFFECTS"?<><Section title="ACTIVE EFFECTS" action={<button onClick={()=>p.setEffect("GLOW")} className="text-[9px] text-[#bd7d8f]">+ ADD</button>}>{p.effectStack.length? p.effectStack.map(e=><div key={e.id} className="mb-2 rounded-lg border border-white/[.08] bg-[#10090c] p-3"><div className="flex items-center gap-2"><button onClick={()=>p.updateEffectLayer(e.id,{enabled:!e.enabled})}><Eye className={`h-3.5 w-3.5 ${e.enabled?"text-[#d8d0d0]":"text-[#4e484c]"}`}/></button><span className="text-[10px] flex-1">{e.effect}</span><button onClick={()=>p.removeEffectLayer(e.id)}><Trash2 className="h-3.5 w-3.5 text-[#777074]"/></button></div><Range label="Opacity" value={e.opacity} min={0} max={100} onChange={v=>p.updateEffectLayer(e.id,{opacity:v})}/></div>):<p className="text-[9px] text-[#686166]">No effects applied. Choose Effects from the tool rail.</p>}</Section></>:<InspectorContent p={p} setAdj={setAdj} properties={properties}/>}
    </div>
  </aside>;
}
function InspectorContent({p,setAdj,properties}:{p:NexusEditorDashboardProps;setAdj:(k:string,v:number)=>void;properties:readonly any[]}) {
  if(p.tool==="GRAPH"||p.tool==="KEYFRAMES") return <GraphPanel p={p}/>;
  if(p.tool==="COLOR"||p.tool==="ADJUST") return <><Section title="COLOR / ADJUST"><Range label="Exposure" value={p.adjustment.exposure} min={-100} max={100} onChange={v=>setAdj("exposure",v)}/><Range label="Contrast" value={p.adjustment.contrast} min={-100} max={100} onChange={v=>setAdj("contrast",v)}/><Range label="Saturation" value={p.adjustment.saturation} min={-100} max={100} onChange={v=>setAdj("saturation",v)}/><Range label="Temperature" value={p.adjustment.temperature} min={-100} max={100} onChange={v=>setAdj("temperature",v)}/><Range label="Tint" value={p.adjustment.tint} min={-100} max={100} onChange={v=>setAdj("tint",v)}/><button onClick={p.resetAdjustments} className="w-full rounded-lg border border-white/[.1] py-2 text-[9px]">RESET</button></Section><Section title="SCOPES"><div className="h-28 rounded-lg border border-white/[.08] bg-[#050305] grid grid-cols-8 items-end gap-1 p-3">{Array.from({length:32},(_,i)=><span key={i} className="bg-[#9c6878]/50 rounded-sm" style={{height:`${20+Math.abs(Math.sin(i*.7))*70}%`}}/>)}</div></Section></>;
  if(p.tool==="AUDIO"||p.tool==="SOUND_FX"||p.tool==="VOICE") return <><Section title="AUDIO MIX"><Range label="Volume" value={p.volume} min={0} max={200} onChange={p.setVolume} unit="%"/><Range label="Pan" value={p.pan} min={-100} max={100} onChange={p.setPan}/><Range label="Bass" value={p.bass} min={-100} max={100} onChange={p.setBass}/><Range label="Treble" value={p.treble} min={-100} max={100} onChange={p.setTreble}/></Section><Section title="AUDIO TOOLS"><button className="w-full rounded-lg border border-white/[.1] py-2 mb-2">NOISE REDUCTION</button><button className="w-full rounded-lg border border-white/[.1] py-2">NORMALIZE</button></Section></>;
  if(p.tool==="SPEED") return <><Section title="TIME REMAPPING"><Range label="Speed" value={p.speed} min={.25} max={4} step={.05} onChange={p.setSpeed} unit="×"/><div className="rounded-lg border border-white/[.08] p-3 bg-[#10090c]"><p className="text-[9px] text-[#8d8589] mb-3">SPEED RAMP</p>{p.speedRamp.map((r,i)=><div key={i} className="grid grid-cols-[1fr_70px] gap-2 items-center mb-2"><span className="text-[8px] text-[#7c7478]">{Math.round(r.position*100)}%</span><input type="range" min=".25" max="4" step=".05" value={r.speed} onChange={e=>p.updateRamp(i,{speed:Number(e.target.value)})} className="w-full accent-[#a76b7e]"/></div>)}</div><button onClick={p.reverseClip} className="w-full mt-3 rounded-lg border border-white/[.1] py-2 text-[9px]">REVERSE</button></Section></>;
  if(p.tool==="TRANSFORM") return <><Section title="TRANSFORM">{properties.map(([label,value,min,max,set,property]:any)=><Range key={property} label={label} value={value} min={min} max={max} onChange={set}/>)}</Section><Section title="FLIP"><div className="grid grid-cols-2 gap-2"><button className="rounded-lg border border-white/[.1] py-2 text-[9px]">FLIP H</button><button className="rounded-lg border border-white/[.1] py-2 text-[9px]">FLIP V</button></div></Section></>;
  if(p.tool==="LAYERS") return <><Section title="COMPOSITING"><label className="text-[9px] text-[#888084]">Blend Mode<select value={p.blendMode} onChange={e=>p.setBlendMode(e.target.value)} className="mt-2 w-full rounded-lg border border-white/[.1] bg-[#10090c] p-2 text-[10px]"><option>normal</option><option>multiply</option><option>screen</option><option>overlay</option><option>darken</option><option>lighten</option></select></label><Range label="Opacity" value={p.opacity} min={0} max={100} onChange={p.setOpacity} unit="%"/></Section><Section title="LAYER SYSTEM"><button className="w-full rounded-lg border border-white/[.1] py-2 mb-2 text-[9px]">ADJUSTMENT LAYER</button><button className="w-full rounded-lg border border-white/[.1] py-2 mb-2 text-[9px]">TRACK MATTE</button><button className="w-full rounded-lg border border-white/[.1] py-2 text-[9px]">PRECOMPOSE</button></Section></>;
  if(p.tool==="MASK") return <><Section title="MASKS"><div className="grid grid-cols-3 gap-2">{["NONE","RECT","CIRCLE"].map(x=><button key={x} onClick={()=>p.setMask(x)} className={`rounded-lg border py-3 text-[8px] ${p.mask===x?"border-[#a76b7e] bg-[#241019]":"border-white/[.1]"}`}>{x}</button>)}</div><Range label="Feather" value={p.maskFeather} min={0} max={100} onChange={p.setMaskFeather}/><button className="w-full rounded-lg border border-white/[.1] py-2 text-[9px]">ADD MASK POINT</button></Section></>;
  if(p.tool==="EFFECTS"||p.tool==="FILTERS") return <Section title={p.tool==="FILTERS"?"FILTER LIBRARY":"EFFECT LIBRARY"}><div className="grid grid-cols-2 gap-2">{effectNames.map(e=><button key={e} onClick={()=>p.setEffect(e.toUpperCase().replaceAll(" ","_"))} className="rounded-lg border border-white/[.08] bg-[#10090c] px-2 py-3 text-left text-[9px] text-[#bcb4b7] hover:border-[#a76b7e]/50">{e}</button>)}</div></Section>;
  if(p.tool==="TEXT"||p.tool==="CAPTIONS") return <><Section title="TYPE"><textarea value={p.text} onChange={e=>p.setText(e.target.value)} placeholder="Type your title or caption" className="w-full h-24 rounded-lg border border-white/[.1] bg-[#050305] p-3 text-[11px] resize-none"/><div className="grid grid-cols-2 gap-2 mt-3"><button className="rounded-lg border border-white/[.1] py-2 text-[9px]">FONT</button><button className="rounded-lg border border-white/[.1] py-2 text-[9px]">STYLE</button></div></Section><Section title="ANIMATION"><button onClick={()=>p.setTool("GRAPH")} className="w-full rounded-lg border border-white/[.1] py-2 text-[9px]">EDIT MOTION CURVE</button></Section></>;
  if(p.tool==="ENHANCE"||p.tool==="REMOVE_BG"||p.tool==="RETOUCH"||p.tool==="TRACKING"||p.tool==="STABILIZE") return <><Section title={p.tool.replace("_"," ")}><p className="text-[9px] leading-5 text-[#777074]">Advanced workspace ready for project-level processing. Controls stay here without crowding the viewer.</p><button onClick={()=>p.setEnhance(true)} className="mt-3 w-full rounded-lg border border-[#a76b7e]/45 bg-[#1b0e14] py-3 text-[9px] font-semibold">OPEN WORKSPACE</button></Section><Section title="ANALYSIS"><div className="grid grid-cols-2 gap-2"><div className="rounded-lg border border-white/[.08] p-3"><span className="text-[8px] text-[#666064]">SOURCE</span><b className="block mt-1 text-[11px]">LOCAL</b></div><div className="rounded-lg border border-white/[.08] p-3"><span className="text-[8px] text-[#666064]">STATUS</span><b className="block mt-1 text-[11px]">READY</b></div></div></Section></>;
  return <><Section title="TRANSFORM">{properties.map(([label,value,min,max,set,property]:any)=><div key={property}><Range label={label} value={value} min={min} max={max} onChange={set}/><button onClick={()=>{p.setSelectedProperty(property);p.setTool("GRAPH")}} className="text-[8px] text-[#9d6a79] -mt-3 mb-3">◇ KEYFRAME {property.toUpperCase()}</button></div>)}</Section><Section title="QUICK ACTIONS"><div className="grid grid-cols-2 gap-2"><button onClick={p.split} className="rounded-lg border border-white/[.1] py-2 text-[9px]">SPLIT</button><button onClick={p.duplicateClip} className="rounded-lg border border-white/[.1] py-2 text-[9px]">DUPLICATE</button><button onClick={p.freezeFrame} className="rounded-lg border border-white/[.1] py-2 text-[9px]">FREEZE</button><button onClick={p.deleteClip} className="rounded-lg border border-white/[.1] py-2 text-[9px]">DELETE</button></div></Section></>;
}
function GraphPanel({p}:{p:NexusEditorDashboardProps}) {
  const [mode,setMode]=useState<"PRESETS"|"CUSTOM">("PRESETS");
  const presets=["Smooth","Fast","Ease In","Ease Out","Ease In-Out","Bounce","Linear","Bezier","Overshoot","Elastic","Spring","Custom"];
  const apply=(name:string)=>{const t=p.duration||1;const shapes:any={Smooth:[0,1,0],Fast:[0,1.4,0],"Ease In":[0,.5,1],"Ease Out":[0,1,1],"Ease In-Out":[0,1.3,0],Bounce:[0,1.3,.3,0],Linear:[0,1],Bezier:[0,.4,1.2,1],Overshoot:[0,1.5,.7,1],Elastic:[0,1.5,-.1,1.2,1],Spring:[0,1.5,.2,1],Custom:[0,1]};const vals=shapes[name]??shapes.Custom;p.setKeyframes(vals.map((v:number,i:number)=>({time:vals.length===1?0:i/(vals.length-1)*t,value:100+v*40,property:p.selectedProperty||"scale"})));};
  return <><Section title="GRAPH EDITOR" action={<span className="text-[8px] text-[#756e72]">{p.selectedProperty.toUpperCase()}</span>}><div className="grid grid-cols-2 gap-1 rounded-lg bg-[#10090c] p-1 border border-white/[.07] mb-3"><button onClick={()=>setMode("PRESETS")} className={`rounded-md py-2 text-[8px] ${mode==="PRESETS"?"bg-[#321923] text-white":"text-[#777074]"}`}>CURVE PRESETS</button><button onClick={()=>setMode("CUSTOM")} className={`rounded-md py-2 text-[8px] ${mode==="CUSTOM"?"bg-[#321923] text-white":"text-[#777074]"}`}>CUSTOM</button></div><div className="h-40 rounded-lg border border-white/[.08] bg-[#040304] relative overflow-hidden" style={{backgroundImage:"linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)",backgroundSize:"25px 25px"}}><svg viewBox="0 0 300 150" className="absolute inset-0 w-full h-full"><path d="M10 140 C80 130 130 45 205 65 S260 110 290 20" fill="none" stroke="#a76b7e" strokeWidth="3"/><circle cx="10" cy="140" r="5" fill="#eee4df"/><circle cx="290" cy="20" r="5" fill="#eee4df"/></svg><span className="absolute left-2 bottom-2 text-[7px] text-[#625b5f]">TIME</span><span className="absolute right-2 top-2 text-[7px] text-[#625b5f]">VALUE</span></div></Section>{mode==="PRESETS"&&<div className="grid grid-cols-2 gap-2">{presets.map(x=><button key={x} onClick={()=>apply(x)} className="rounded-lg border border-white/[.08] bg-[#10090c] py-2.5 text-[8px] hover:border-[#a76b7e]/50">{x}</button>)}</div>}<Section title="KEYFRAMES"><div className="space-y-2">{p.keyframes.filter(k=>k.property===p.selectedProperty).map((k,i)=><div key={i} className="flex items-center justify-between rounded-lg bg-[#10090c] border border-white/[.06] px-3 py-2 text-[8px]"><span>{k.time.toFixed(2)}s</span><span>{k.value.toFixed(1)}</span><button onClick={()=>p.setKeyframes(x=>x.filter((_:any,j:number)=>j!==i))}><Trash2 className="h-3 w-3"/></button></div>)}</div><button onClick={p.addKeyframe} className="w-full mt-2 rounded-lg border border-[#a76b7e]/40 py-2 text-[9px]">+ ADD KEYFRAME</button></Section></>;
}
function EditorMenuBar({p}:{p:NexusEditorDashboardProps}) {
  const [open,setOpen]=useState<string|null>(null);
  const menu=(name:string,items:{label:string;action:()=>void;disabled?:boolean}[]) => (
    <div className="relative">
      <button onClick={()=>setOpen(open===name?null:name)} className={`px-2 py-1.5 rounded text-[8px] ${open===name?"bg-[#1d0d14] text-white":"text-[#9b9498] hover:text-white hover:bg-white/[.04]"}`}>{name}</button>
      {open===name&&<div className="absolute top-8 left-0 z-[100] min-w-[170px] rounded-lg border border-white/[.12] bg-[#10080c] shadow-2xl p-1">
        {items.map((it,i)=><button key={i} disabled={it.disabled} onClick={()=>{setOpen(null);it.action()}} className="w-full flex items-center justify-between rounded px-3 py-2 text-left text-[8px] text-[#c9c1c4] hover:bg-[#241119] disabled:opacity-30">{it.label}<span className="text-[6px] text-[#655d61]">{i<9?[["Ctrl+O"],["Ctrl+Z"],["Ctrl+Y"],["S"],["Delete"],["Ctrl+D"],["I"],["O"],["Ctrl+E"]][i]?.[0]:""}</span></button>)}
      </div>}
    </div>
  );
  return <div className="h-9 shrink-0 border-b border-white/[.07] bg-[#080507] flex items-center px-3 gap-0.5">
    {menu("File",[
      {label:"Open Media",action:()=>p.fileRef.current?.click()},
      {label:"Save Project",action:()=>p.setError("Project state is saved locally when the project is updated.")},
      {label:"Export",action:()=>void p.process("export")},
      {label:"Close",action:()=>window.location.assign("/tools")}
    ])}
    {menu("Edit",[
      {label:"Undo",action:()=>p.setError("Undo history will be enabled as timeline history is committed.")},
      {label:"Redo",action:()=>p.setError("Redo history will be enabled as timeline history is committed.")},
      {label:"Duplicate Clip",action:p.duplicateClip},
      {label:"Delete Clip",action:p.deleteClip}
    ])}
    {menu("Clip",[
      {label:"Split at Playhead",action:p.split},
      {label:"Trim End to Playhead",action:()=>p.trimToPlayhead("end")},
      {label:"Reverse",action:p.reverseClip},
      {label:"Freeze Frame",action:p.freezeFrame}
    ])}
    {menu("Timeline",[
      {label:"Zoom In",action:()=>window.dispatchEvent(new CustomEvent("nexus-timeline-zoom",{detail:1}))},
      {label:"Zoom Out",action:()=>window.dispatchEvent(new CustomEvent("nexus-timeline-zoom",{detail:-1}))},
      {label:"Mark In",action:p.markIn},
      {label:"Mark Out",action:p.markOut},
      {label:"Split",action:p.split}
    ])}
    {menu("Layer",[
      {label:"Add Keyframe",action:p.addKeyframe},
      {label:"Duplicate Clip Layer",action:p.duplicateClip},
      {label:"Delete Selected Layer",action:p.deleteClip}
    ])}
    {menu("View",[
      {label:"Focus Timeline",action:()=>window.dispatchEvent(new CustomEvent("nexus-focus-timeline"))},
      {label:"Fit Timeline",action:()=>window.dispatchEvent(new CustomEvent("nexus-timeline-fit"))}
    ])}
    {menu("Window",[
      {label:"Toggle Full Screen",action:()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen()}}
    ])}
    {menu("Help",[
      {label:"Keyboard Shortcuts",action:()=>p.setError("Shortcuts: V Select · S Split · I Mark In · O Mark Out · Delete Remove · Ctrl+D Duplicate.")},
      {label:"About NEXUS",action:()=>p.setError("NEXUS — professional video creative workspace.")}
    ])}
    <div className="ml-auto flex items-center gap-2 text-[6px] tracking-[.12em] text-[#666064]">PROJECT · {p.file.name}</div>
  </div>;
}
function TimelineToolStrip({p}:{p:NexusEditorDashboardProps}) {
  const [mode,setMode]=useState("SELECT");
  const [snap,setSnap]=useState(true);
  const [zoom,setZoom]=useState(1);
  useEffect(()=>{
    const zoomHandler=(e:Event)=>{const d=(e as CustomEvent<number>).detail;setZoom(z=>Math.max(.75,Math.min(3,z+d*.25)))};
    const fitHandler=()=>setZoom(1);
    window.addEventListener("nexus-timeline-zoom",zoomHandler);
    window.addEventListener("nexus-timeline-fit",fitHandler);
    return()=>{window.removeEventListener("nexus-timeline-zoom",zoomHandler);window.removeEventListener("nexus-timeline-fit",fitHandler)};
  },[]);
  return <div className="h-10 shrink-0 border-b border-white/[.07] bg-[#0b0609] flex items-center px-3 gap-1.5">
    <div className="flex items-center gap-0.5">
      {[
        ["SELECT","V"],["BLADE","C"],["HAND","H"],["ZOOM","Z"]
      ].map(([id,key])=><button key={id} title={`${id} tool · ${key}`} onClick={()=>setMode(id)} className={`h-7 min-w-7 px-1.5 rounded text-[7px] border ${mode===id?"bg-[#2b141d] border-[#a76b7e]/60 text-white":"border-white/[.06] text-[#81797d] hover:text-white"}`}>{id}</button>)}
    </div>
    <div className="h-5 w-px bg-white/[.08] mx-1"/>
    <button onClick={()=>setSnap(!snap)} className={`h-7 px-2 rounded border text-[7px] ${snap?"border-[#a76b7e]/50 bg-[#1d0d14] text-[#ddd3d0]":"border-white/[.06] text-[#777074]"}`}>SNAP {snap?"ON":"OFF"}</button>
    <button onClick={p.markIn} className="h-7 px-2 rounded border border-white/[.06] text-[7px] text-[#8e868a] hover:text-white">IN</button>
    <button onClick={p.markOut} className="h-7 px-2 rounded border border-white/[.06] text-[7px] text-[#8e868a] hover:text-white">OUT</button>
    <button onClick={p.split} className="h-7 px-2 rounded border border-white/[.06] text-[7px] text-[#8e868a] hover:text-white">SPLIT</button>
    <button onClick={p.addKeyframe} className="h-7 px-2 rounded border border-white/[.06] text-[7px] text-[#8e868a] hover:text-white">◇ KEYFRAME</button>
    <button onClick={p.addManualBeat} className="h-7 px-2 rounded border border-white/[.06] text-[7px] text-[#8e868a] hover:text-white">+ MARKER</button>
    <div className="ml-auto flex items-center gap-1">
      <button onClick={()=>setZoom(z=>Math.max(.75,z-.25))} className="h-7 w-7 rounded border border-white/[.06] text-[8px]">−</button>
      <span className="w-9 text-center text-[7px] text-[#777074]">{Math.round(zoom*100)}%</span>
      <button onClick={()=>setZoom(z=>Math.min(3,z+.25))} className="h-7 w-7 rounded border border-white/[.06] text-[8px]">+</button>
    </div>
  </div>;
}
function Timeline({p}:{p:NexusEditorDashboardProps}) {
  const [zoom,setZoom]=useState(1);
  const active=p.clips.find(c=>c.id===p.activeClip)||p.clips[0];
  const play=(x:number)=>{const r=(document.getElementById("nexus-new-timeline") as HTMLElement|null)?.getBoundingClientRect();if(r)p.seek(Math.max(0,Math.min(100,(x-r.left)/r.width*100)));};
  return <section className="h-[250px] shrink-0 border-t border-white/[.09] bg-[#080507] flex flex-col">
    <div className="h-11 shrink-0 px-3 border-b border-white/[.07] flex items-center gap-2"><span className="text-[10px] font-bold tracking-[.15em] mr-2">TIMELINE</span><button onClick={()=>setZoom(Math.max(.75,zoom-.25))} className="h-7 w-7 rounded border border-white/[.08]">−</button><span className="text-[9px] text-[#777074] w-10 text-center">{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(Math.min(3,zoom+.25))} className="h-7 w-7 rounded border border-white/[.08]">+</button><div className="h-5 w-px bg-white/[.08] mx-1"/>{[["IN",p.markIn],["OUT",p.markOut],["SPLIT",p.split],["CUT",p.cutRange],["TRIM",()=>p.trimToPlayhead("end")],["RIPPLE",p.rippleDelete],["DELETE",p.deleteClip],["DUP",p.duplicateClip],["REVERSE",p.reverseClip],["FREEZE",p.freezeFrame]].map(([label,fn])=><button key={String(label)} onClick={fn as any} className="px-2.5 h-7 rounded border border-white/[.08] text-[8px] text-[#a8a0a4] hover:bg-[#160b10]">{String(label)}</button>)}<div className="ml-auto flex items-center gap-2"><button onClick={p.autoBeatMarkers} className="text-[8px] text-[#a76b7e]">AUTO BEAT</button><button onClick={p.addManualBeat} className="text-[8px] text-[#a76b7e]">+ BEAT</button><button onClick={p.clearBeatMarkers} className="text-[8px] text-[#777074]">CLEAR</button></div></div>
    <div id="nexus-new-timeline" className="flex-1 min-h-0 overflow-auto" onPointerDown={e=>play(e.clientX)}>
      <div className="min-w-[760px] h-full relative" style={{width:`${Math.max(100,zoom*100)}%`}}>
        <div className="h-8 border-b border-white/[.06] relative bg-[#0b0709]">{Array.from({length:21},(_,i)=><span key={i} className="absolute top-2 text-[7px] text-[#625b5f]" style={{left:`${i*5}%`}}>{(p.duration*i/20).toFixed(1)}s</span>)}</div>
        <Track label="V2" top={8} p={p} muted={false}/><Track label="V1" top={72} p={p} muted={false}/><Track label="A2" top={136} p={p} muted={false}/><Track label="A1" top={200} p={p} muted={p.muted}/>
        {p.beatMarkers.map(m=><div key={m.id} className="absolute top-0 bottom-0 w-px bg-[#b07182]/70 z-20" style={{left:`${m.time/Math.max(.001,p.duration)*100}%`}}/>)}
        <div className="absolute top-0 bottom-0 w-px bg-[#eee5e1] z-30" style={{left:`${p.playhead}%`}}/><div className="absolute top-0 w-3 h-3 -ml-1.5 bg-[#eee5e1] rotate-45 z-40" style={{left:`${p.playhead}%`}}/>
      </div>
    </div>
  </section>;
}
function Track({label,top,p,muted}:{label:string;top:number;p:NexusEditorDashboardProps;muted:boolean}) {
  return <div className="absolute left-0 right-0 h-14 border-b border-white/[.06] flex" style={{top}}><div className="w-14 shrink-0 border-r border-white/[.07] flex items-center justify-center gap-1"><span className="text-[8px] font-bold">{label}</span><button className="text-[#6f686c]">{muted?<VolumeX className="h-3 w-3"/>:<Eye className="h-3 w-3"/>}</button></div><div className="relative flex-1 bg-[#0a0709]">{label==="V1"&&p.clips.map(c=><button key={c.id} onClick={e=>{e.stopPropagation();p.setActiveClip(c.id)}} className={`absolute top-2 bottom-2 rounded-md border text-left overflow-hidden ${p.activeClip===c.id?"border-[#e5dcd9] ring-1 ring-[#a76b7e]/50":"border-[#5e5559]/50"}`} style={{left:`${c.start}%`,width:`${Math.max(1,c.end-c.start)}%`,background:`linear-gradient(135deg,${c.color}55,#1a0c12)`}}><span className="block truncate px-2 py-1 text-[8px] text-[#e6dfdf]">{c.name}</span><span className="block px-2 text-[7px] text-[#9c9498]">{((c.end-c.start)/100*p.duration).toFixed(2)}s</span></button>)}</div></div>;
}
function MobileEditor({p}:{p:NexusEditorDashboardProps}) {
  const [panel,setPanel]=useState<string|null>(null);
  const items=toolGroups.flatMap(g=>g.items).filter((x,i)=>i<16);
  return <main className="nx-editor-shell fixed inset-0 bg-[#050305] text-[#eee7e5] flex flex-col">
    <header className="nx-editor-topbar h-12 shrink-0 border-b border-white/[.08] flex items-center px-3 gap-3"><b className="text-[12px] tracking-[.18em]">NEXUS</b><span className="truncate text-[9px] text-[#777074]">{p.file.name}</span><button onClick={()=>void p.process("export")} className="ml-auto px-3 py-2 rounded-lg bg-[#ddd4d1] text-[#1a1215] text-[8px] font-bold">EXPORT</button></header>
    <div className="flex-1 min-h-0 flex flex-col"><div className="flex-1 min-h-0 flex items-center justify-center p-3 bg-[#090609]"><video ref={p.videoRef} src={p.output??p.src??undefined} muted={p.muted} playsInline preload="metadata" className="max-w-full max-h-full object-contain" onLoadedMetadata={e=>p.setDuration(Number.isFinite(e.currentTarget.duration)?e.currentTarget.duration||1:1)} onError={()=>p.setError("NEXUS could not decode this video in your browser.")} onTimeUpdate={e=>p.setPlayhead(p.duration?(e.currentTarget.currentTime/p.duration)*100:0)} onEnded={()=>p.setPlaying(false)}/></div><div className="h-11 border-y border-white/[.08] flex items-center justify-center gap-5"><button onClick={()=>{const v=p.videoRef.current;if(!v)return;if(v.paused){void v.play();p.setPlaying(true)}else{v.pause();p.setPlaying(false)}}}>{p.playing?<Pause/>:<Play/>}</button><button onClick={()=>p.setMuted(!p.muted)}>{p.muted?<VolumeX/>:<Volume2/>}</button><span className="text-[9px] text-[#888084]">{(p.duration*p.playhead/100).toFixed(2)}s</span></div><div className="h-20 border-b border-white/[.08] p-2"><div className="h-full rounded-lg bg-[#120a0e] border border-white/[.08] relative" onPointerDown={e=>{const r=e.currentTarget.getBoundingClientRect();p.seek((e.clientX-r.left)/r.width*100)}}><div className="absolute inset-y-0 left-0 bg-[#a76b7e]/20" style={{width:`${p.playhead}%`}}/><div className="absolute top-0 bottom-0 w-px bg-white" style={{left:`${p.playhead}%`}}/></div></div><div className="h-[78px] shrink-0 overflow-x-auto flex gap-1 p-2 bg-[#0b0709]">{items.map(([id,label,Icon])=><button key={id} onClick={()=>{p.setTool(id);setPanel(label)}} className="min-w-[64px] rounded-lg border border-white/[.08] bg-[#120a0e] flex flex-col items-center justify-center gap-1"><Icon className="h-4 w-4 text-[#b47686]"/><span className="text-[7px]">{label}</span></button>)}</div></div>
    {panel&&<div className="absolute left-0 right-0 bottom-[78px] max-h-[52%] overflow-auto rounded-t-2xl border border-white/[.1] bg-[#10080c] p-4 shadow-2xl"><div className="flex items-center justify-between mb-4"><b className="text-[10px] tracking-[.14em]">{panel.toUpperCase()}</b><button onClick={()=>setPanel(null)}><X className="h-4 w-4"/></button></div>{panel==="Graph"||panel==="Keyframes"?<GraphPanel p={p}/>:<InspectorContent p={p} setAdj={(k,v)=>p.setAdjustment(a=>({...a,[k]:v}))} properties={[]}/>}</div>}
    {p.processing&&<div className="absolute top-14 left-3 right-3 rounded-lg bg-[#1b0e14] border border-[#a76b7e]/30 p-3 text-[9px]">RENDERING · {Math.round(p.progress*100)}%</div>}
  </main>;
}
export function NexusEditorDashboard({p}:{p:NexusEditorDashboardProps}) {
  if(typeof window!=="undefined" && window.innerWidth<768) return <MobileEditor p={p}/>;
  return <main className="nx-editor-shell h-screen max-h-screen overflow-hidden bg-[#050305] text-[#eee7e5] flex flex-col">
    <header className="h-12 shrink-0 border-b border-white/[.08] bg-[#090608] flex items-center px-4 gap-5">
      <div className="flex items-center gap-3 shrink-0"><div className="h-7 w-7 rounded-md bg-gradient-to-br from-[#eee7e4] via-[#9c8990] to-[#4a2836] flex items-center justify-center"><Clapperboard className="h-3.5 w-3.5 text-[#1a1215]"/></div><div><b className="text-[11px] tracking-[.2em]">NEXUS</b><p className="text-[6px] tracking-[.18em] text-[#686166]">VIDEO CREATIVE WORKSPACE</p></div></div>
      <nav className="hidden lg:flex"><EditorMenuBar p={p}/></nav>
      <div className="ml-auto flex items-center gap-3"><span className="hidden xl:block text-[8px] text-[#666064]">LOCAL PROJECT</span><button className="h-7 px-3 rounded-md border border-white/[.1] text-[8px]">SAVE</button><button onClick={()=>void p.process("export")} className="h-8 px-4 rounded-md bg-gradient-to-b from-[#eee7e3] to-[#9f8e92] text-[#1b1215] text-[8px] font-black">EXPORT</button><a href="/" aria-label="Back to projects" className="h-8 px-3 rounded-md border border-white/[.1] flex items-center justify-center text-[9px] text-[#d4c9cb] hover:bg-white/[.06]">PROJECTS</a></div>
    </header>
    <div className="flex-1 min-h-0 flex">
      <ToolRail active={p.tool} onSelect={p.setTool}/>
      {!p.mediaCollapsed&&<MediaPool p={p}/>}
      <div className="min-w-0 min-h-0 flex-1 flex flex-col"><Viewer p={p}/><TimelineToolStrip p={p}/><Timeline p={p}/></div>
      <Inspector p={p}/>
    </div>
    {p.processing&&<div className="absolute top-16 right-4 w-72 rounded-xl border border-[#a76b7e]/30 bg-[#12090d] p-4 shadow-2xl"><div className="flex justify-between text-[9px]"><span>{p.tool==="ENHANCE"?"ENHANCING":"RENDERING"}</span><b>{Math.round(p.progress*100)}%</b></div><div className="mt-3 h-1.5 bg-white/[.08] rounded-full overflow-hidden"><div className="h-full bg-[#a76b7e]" style={{width:`${p.progress*100}%`}}/></div></div>}
    {p.error&&<div className="absolute bottom-4 right-4 max-w-md rounded-xl border border-red-300/20 bg-[#1b0b0d] px-4 py-3 text-[10px] text-red-100">{p.error}</div>}
  </main>;
}

import { useState } from "react";
import {
  type LucideIcon, Activity, AudioLines, Captions, Crop, Diamond, Download, Film, Gauge, Layers3,
  Maximize2, Mic2, Music2, Palette, Pause, Play, Plus, Scissors, Settings2,
  SlidersHorizontal, Sparkles, Split, Sticker, Type, Volume2, VolumeX, WandSparkles, X
} from "lucide-react";
import { Inspector, Timeline, type NexusEditorDashboardProps } from "./nexus-editor-dashboard";

type MobileTool = [string, string, LucideIcon];
const mobileTools: MobileTool[] = [
  ["MEDIA","Media",Film],["EDIT","Cut",Scissors],["TRANSFORM","Transform",Maximize2],
  ["KEYFRAMES","Keyframes",Diamond],["GRAPH","Graph",Activity],["SPEED","Speed",Gauge],
  ["EFFECTS","Effects",WandSparkles],["TRANSITIONS","Transitions",Split],["FILTERS","Looks",Palette],
  ["COLOR","Color",Palette],["AUDIO","Audio",AudioLines],["TEXT","Text",Type],
  ["CAPTIONS","Captions",Captions],["MASK","Mask",Crop],["LAYERS","Layers",Layers3],
  ["STICKERS","Stickers",Sticker],["VOICE","Voice",Mic2],["SOUND_FX","Sound FX",Music2],
  ["ENHANCE","Enhance",Sparkles]
];

export function NexusMobileEditor({p}:{p:NexusEditorDashboardProps}){
  const [panel,setPanel]=useState("MEDIA");
  const [showTimeline,setShowTimeline]=useState(true);
  const active=p.clips.find(c=>c.id===p.activeClip)??p.clips[0];
  const play=()=>{
    const video=p.videoRef.current;
    if(!video)return;
    if(video.paused){
      video.volume=Math.max(0,Math.min(1,p.animatedVolume/100));
      void video.play().then(()=>p.setPlaying(true)).catch(()=>p.setError("Playback could not start for this source."));
    }else{video.pause();p.setPlaying(false);}
  };
  const chooseTool=(id:string)=>{
    if(id==="MEDIA"){setPanel("MEDIA");return;}
    p.setTool(id as any);
    setPanel(id);
  };
  const title=panel==="MEDIA"?"Media bin":panel==="EDIT"?"Clip editing":panel==="KEYFRAMES"||panel==="GRAPH"?"Motion studio":panel==="AUDIO"||panel==="VOICE"||panel==="SOUND_FX"?"Audio controls":panel==="EFFECTS"?"Effect studio":panel==="COLOR"||panel==="ADJUST"?"Color lab":panel==="TRANSFORM"?"Transform":panel==="SPEED"?"Time remapping":panel==="LAYERS"?"Compositing":panel==="MASK"?"Mask controls":panel==="TEXT"?"Typography":panel==="CAPTIONS"?"Captions":panel==="ENHANCE"?"Enhancement":panel;
  return <main className="nx-mobile-studio">
    <header className="nx-mobile-topbar">
      <div className="nx-mobile-brand"><span className="nx-mobile-mark">N<span>×</span></span><div><b>NEXUS</b><small>FLUX CREATIVE STUDIO</small></div></div>
      <div className="nx-mobile-project"><i/> <span>{p.file.name}</span></div>
      <button className="nx-mobile-export" onClick={()=>void p.process("export")} disabled={p.processing}><Download size={15}/><span>{p.processing?"Rendering":"Export"}</span></button>
    </header>

    <section className="nx-mobile-preview-shell">
      <div className="nx-mobile-preview-head"><span><i/> PROGRAM PREVIEW</span><button onClick={()=>setPanel("TRANSFORM")}><Maximize2 size={14}/> Fit</button></div>
      <div className="nx-mobile-preview">
        <video ref={p.videoRef} src={p.output??p.src??undefined} muted={p.muted} playsInline preload="metadata"
          onLoadedMetadata={p.onVideoMetadata}
          onTimeUpdate={e=>{e.currentTarget.volume=Math.max(0,Math.min(1,p.animatedVolume/100));p.syncPreviewTime(e.currentTarget.currentTime);}}
          onEnded={()=>p.setPlaying(false)}
          onError={()=>p.setError("NEXUS could not decode this source. Try MP4 (H.264/AAC).")}
          style={{opacity:p.animatedOpacity/100,filter:"blur("+p.animatedBlur+"px)",transform:"translate("+p.animatedPosX/4+"px,"+p.animatedPosY/4+"px) scale("+p.animatedScale/100+") rotate("+p.animatedRotation+"deg)"}}
        />
        {p.textLayers.filter(layer=>p.playhead/100*p.duration>=layer.start&&p.playhead/100*p.duration<=layer.end).map(layer=><div key={layer.id} className="nx-mobile-preview-text">{layer.text}</div>)}
      </div>
      <div className="nx-mobile-transport">
        <button onClick={()=>p.seek(0)} aria-label="Go to start">↤</button>
        <button className="nx-mobile-play" onClick={play} aria-label={p.playing?"Pause":"Play"}>{p.playing?<Pause size={18}/>:<Play size={18} fill="currentColor"/>}</button>
        <button onClick={()=>p.setMuted(!p.muted)} aria-label={p.muted?"Unmute":"Mute"}>{p.muted?<VolumeX size={17}/>:<Volume2 size={17}/>}</button>
        <span className="nx-mobile-timecode">{(p.duration*p.playhead/100).toFixed(2)} <i>/ {p.duration.toFixed(2)} sec</i></span>
        <button className="nx-mobile-key" onClick={p.addKeyframe}><Diamond size={16}/></button>
      </div>
    </section>

    <section className="nx-mobile-timeline-wrap">
      <div className="nx-mobile-section-head">
        <div><small>SEQUENCE TIMELINE</small><b>{active?.name??p.file.name}</b></div>
        <div><button onClick={()=>setShowTimeline(v=>!v)}>{showTimeline?"Collapse":"Expand"} <span>{showTimeline?"⌄":"⌃"}</span></button><button onClick={p.split}><Scissors size={14}/></button><button onClick={p.duplicateClip}><Plus size={15}/></button></div>
      </div>
      {showTimeline&&<Timeline p={p}/>}
    </section>

    <nav className="nx-mobile-tool-dock" aria-label="Editing tools">
      <div className="nx-mobile-dock-label"><span>EDITING TOOLS</span><span>SWIPE TO EXPLORE →</span></div>
      <div className="nx-mobile-tool-scroll">
        {mobileTools.map(([id,label,Icon])=><button key={id} className={panel===id?"active":""} onClick={()=>chooseTool(id)}><Icon size={19} strokeWidth={1.8}/><span>{label}</span></button>)}
      </div>
    </nav>

    {panel&&<section className="nx-mobile-inspector">
      <div className="nx-mobile-inspector-head">
        <div><small>CONTEXTUAL CONTROLS</small><b>{title}</b></div>
        <button onClick={()=>setPanel("")} aria-label="Close controls"><X size={18}/></button>
      </div>
      {panel==="MEDIA"?<div className="nx-mobile-media-bin">
        <button className="nx-mobile-import" onClick={()=>p.addFileRef.current?.click()}><Plus size={18}/> Import more media</button>
        {p.mediaAssets.map(asset=><div className="nx-mobile-media-item" key={asset.id}><span><Film size={17}/></span><div><b>{asset.name}</b><small>{(asset.file.size/1048576).toFixed(1)} MB · {asset.duration.toFixed(1)}s</small></div>{p.clips.some(c=>c.mediaId===asset.id)?<i>IN TIMELINE</i>:<button onClick={()=>p.addAssetToTimeline(asset.id)}>＋ Add</button>}</div>)}
        <button className="nx-mobile-import nx-mobile-audio-import" onClick={()=>p.audioFileRef.current?.click()}><AudioLines size={17}/> Import audio</button>
        {p.audioAssets.map(asset=><div className="nx-mobile-media-item" key={asset.id}><span><AudioLines size={17}/></span><div><b>{asset.name}</b><small>AUDIO · {asset.duration.toFixed(1)}s</small></div><button onClick={()=>p.addAudioClip(asset.id)}>＋ Add</button></div>)}
      </div>:<div className="nx-mobile-inspector-content"><Inspector p={p}/></div>}
    </section>}

    {p.processing&&<div className="nx-mobile-progress"><div><WandSparkles size={15}/><b>Rendering your video</b><strong>{Math.round(p.progress*100)}%</strong></div><span><i style={{width:(p.progress*100)+"%"}}/></span></div>}
    {p.error&&<div className="nx-mobile-error" role="alert"><span>{p.error}</span><button onClick={()=>p.setError("")}><X size={16}/></button></div>}
  </main>;
}

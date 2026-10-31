export type BeatPoint = { time: number; strength: number; kind: "beat" | "drop" | "phrase" };
export type AutoEditSegment = {
  start: number;
  end: number;
  speed: number;
  score: number;
  emphasis: "HEADSHOT" | "ACTION" | "MOTION" | "DETAIL";
};
export type AutoEditPlan = {
  bpm: number;
  beats: BeatPoint[];
  segments: AutoEditSegment[];
  grade: { brightness: number; contrast: number; saturation: number; temperature: number; clarity: number; texture: number };
  enhancement: { scale: 100 | 125 | 150 | 200; denoise: number; sharpen: number; interpolation: boolean; targetFps: 60 | 90 | 120 };
  deviceProfile: string;
};

function clamp(n:number,a:number,b:number){return Math.max(a,Math.min(b,n));}

async function decodeAudio(file: File) {
  const ctx = new AudioContext();
  const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
  await ctx.close();
  return buffer;
}

function detectBeats(buffer: AudioBuffer): BeatPoint[] {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  const hop = Math.max(256, Math.floor(sr * 0.02));
  const energies:number[] = [];
  for(let i=0;i<data.length;i+=hop){
    let sum=0;
    const end=Math.min(data.length,i+hop);
    for(let j=i;j<end;j++) sum += data[j]*data[j];
    energies.push(Math.sqrt(sum/Math.max(1,end-i)));
  }
  const smooth = energies.map((v,i)=> (energies[i-2]||v)+(energies[i-1]||v)+v+(energies[i+1]||v)+(energies[i+2]||v)).map(v=>v/5);
  const peaks:BeatPoint[]=[];
  const minGap=Math.max(4,Math.round(0.22/(hop/sr)));
  let last=-minGap;
  for(let i=2;i<smooth.length-2;i++){
    const v=smooth[i];
    if(v>smooth[i-1]&&v>=smooth[i+1]&&v>smooth[i-2]&&v>=smooth[i+2]&&v>0.035&&i-last>=minGap){
      const strength=clamp(v/(Math.max(...smooth)*0.7||1),0,1);
      peaks.push({time:i*hop/sr,strength,kind:strength>0.72?"drop":"beat"});
      last=i;
    }
  }
  const intervals=peaks.slice(1).map((p,i)=>p.time-peaks[i].time).filter(v=>v>0.22&&v<1.5);
  const bpm=intervals.length?clamp(Math.round(60/(intervals.sort((a,b)=>a-b)[Math.floor(intervals.length/2)]||0.5)),70,180):120;
  for(let i=1;i<peaks.length;i+=8) peaks[i].kind="phrase";
  return peaks.slice(0,900);
}

async function scoreVideo(video: File, times:number[]) {
  const url=URL.createObjectURL(video);
  const v=document.createElement("video");
  v.muted=true; v.preload="metadata"; v.src=url;
  await new Promise<void>((resolve,reject)=>{v.onloadedmetadata=()=>resolve();v.onerror=()=>reject(new Error("Could not analyze the video."));});
  const canvas=document.createElement("canvas");
  canvas.width=320; canvas.height=180;
  const ctx=canvas.getContext("2d",{willReadFrequently:true});
  const scores:number[]=[];
  for(const t of times){
    v.currentTime=clamp(t,0,Math.max(0,v.duration-0.03));
    await new Promise<void>(resolve=>{v.onseeked=()=>resolve();});
    ctx?.drawImage(v,0,0,320,180);
    const d=ctx?.getImageData(0,0,320,180).data;
    if(!d){scores.push(0.5);continue;}
    let lum=0, edge=0;
    for(let i=0;i<d.length;i+=16){const y=(0.2126*d[i]+0.7152*d[i+1]+0.0722*d[i+2])/255;lum+=y;edge+=Math.abs(d[i]-d[Math.min(d.length-4,i+4)])/255;}
    const count=Math.max(1,Math.floor(d.length/16));
    scores.push(clamp((lum/count)*0.35+(edge/count)*0.65,0,1));
  }
  URL.revokeObjectURL(url);
  return {duration:v.duration,scores};
}

export async function analyzeAudioBeats(video: File, audio: File): Promise<AutoEditPlan> {
  const buffer=await decodeAudio(audio);
  const beats=detectBeats(buffer);
  const sampleTimes=beats.map(b=>b.time);
  const {duration,scores}=await scoreVideo(video,sampleTimes);
  const segments:AutoEditSegment[]=[];
  const maxSegments=Math.min(24,Math.max(8,Math.floor(duration/1.25)));
  const ranked=beats.map((b,i)=>({b,i,score:(b.strength*0.55)+(scores[i]||0.5)*0.45})).sort((a,b)=>b.score-a.score);
  const selected=ranked.slice(0,maxSegments).sort((a,b)=>a.b.time-b.b.time);
  for(const item of selected){
    const start=clamp(item.b.time-0.22,0,Math.max(0,duration-0.45));
    const end=clamp(item.b.time+0.68,start+0.35,duration);
    const energy=item.score;
    segments.push({
      start,end,
      speed:energy>0.82?1.35:energy<0.42?0.7:1,
      score:energy,
      emphasis:energy>0.82?"HEADSHOT":energy>0.67?"ACTION":energy<0.45?"DETAIL":"MOTION",
    });
  }
  segments.sort((a,b)=>a.start-b.start);
  const avg=beats.reduce((s,b)=>s+b.strength,0)/Math.max(1,beats.length);
  const deviceMemory=(navigator as Navigator & {deviceMemory?:number}).deviceMemory||4;
  const cores=navigator.hardwareConcurrency||4;
  const webgpu="gpu" in navigator;
  const strong=deviceMemory>=8&&cores>=8;
  return {
    bpm: beats.length>1 ? Math.round(60/Math.max(0.25,(beats[1]?.time-beats[0]?.time)||0.5)) : 120,
    beats,
    segments,
    grade:{
      brightness:clamp(Math.round((0.5-avg)*10),-8,8),
      contrast:clamp(Math.round(8+avg*8),0,18),
      saturation:clamp(Math.round(6+avg*10),0,18),
      temperature:clamp(Math.round((0.5-avg)*12),-10,10),
      clarity:strong?12:8,
      texture:strong?8:5,
    },
    enhancement:{
      scale:strong?150:125,
      denoise:strong?0.35:0.55,
      sharpen:strong?0.8:0.6,
      interpolation:strong||webgpu,
      targetFps:strong?120:90,
    },
    deviceProfile: strong?"HIGH PERFORMANCE":webgpu?"WEBGPU CAPABLE":"DEVICE SAFE",
  };
}

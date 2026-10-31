import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { AutoEditPlan } from "@/lib/nexus-auto-edit";

let ff: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

async function engine() {
  if (ff) return ff;
  if (loading) return loading;
  loading=(async()=>{
    const f=new FFmpeg();
    const base="https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
    await f.load({
      coreURL:await toBlobURL(`${base}/ffmpeg-core.js`,"text/javascript"),
      wasmURL:await toBlobURL(`${base}/ffmpeg-core.wasm`,"application/wasm"),
      workerURL:await toBlobURL(`${base}/ffmpeg-core.worker.js`,"text/javascript"),
    });
    ff=f; return f;
  })();
  try{return await loading;}finally{loading=null;}
}

export async function renderAutoEdit(video: File, music: File, plan: AutoEditPlan, compression:"SOCIAL"|"BALANCED"|"HIGH_QUALITY"="BALANCED", onProgress?:(p:number)=>void){
  const f=await engine();
  const stamp=Date.now();
  const input=`nx-auto-video-${stamp}.${video.name.split(".").pop()||"mp4"}`;
  const audio=`nx-auto-audio-${stamp}.${music.name.split(".").pop()||"mp3"}`;
  const output=`nx-auto-output-${stamp}.mp4`;
  f.on("progress",({progress})=>onProgress?.(Math.max(0,Math.min(1,progress))));
  await f.writeFile(input,await fetchFile(video));
  await f.writeFile(audio,await fetchFile(music));

  const grade=`eq=brightness:${plan.grade.brightness/100}:contrast:${1+plan.grade.contrast/100}:saturation:${1+plan.grade.saturation/100}`;
  const parts=plan.segments.length?plan.segments:[{start:0,end:Math.min(12,60),speed:1,score:0.5,emphasis:"MOTION" as const}];
  const chains=parts.map((s,i)=>`[0:v]trim=start=${s.start.toFixed(3)}:end=${s.end.toFixed(3)},setpts=PTS-STARTPTS,setpts=PTS/${Math.max(.5,Math.min(2,s.speed))},${grade}[v${i}]`);
  const concat=parts.map((_,i)=>`[v${i}]`).join("")+`concat=n=${parts.length}:v=1:a=0[outv]`;
  const filter=chains.join(";")+";"+concat;
  const crf=compression==="SOCIAL"?26:compression==="HIGH_QUALITY"?18:22;
  const result=await f.exec(["-i",input,"-stream_loop","-1","-i",audio,"-filter_complex",filter,"-map","[outv]","-map","1:a:0","-shortest","-c:v","libx264","-preset","veryfast","-crf",String(crf),"-c:a","aac","-b:a",compression==="SOCIAL"?"128k":"192k","-movflags","+faststart","-y",output]);
  if(result!==0) throw new Error("NEXUS Auto-Edit could not render this project.");
  const data=await f.readFile(output);
  if(!(data instanceof Uint8Array)) throw new Error("NEXUS Auto-Edit returned an invalid file.");
  await f.deleteFile(input).catch(()=>undefined); await f.deleteFile(audio).catch(()=>undefined); await f.deleteFile(output).catch(()=>undefined);
  onProgress?.(1);
  return new Blob([data as unknown as BlobPart],{type:"video/mp4"});
}

export type NexusEngineTier = "AI_WEBGPU" | "AI_WEBGL" | "FFMPEG_FALLBACK";
export type NexusEngineProfile = {
  tier: NexusEngineTier;
  scale: 100|125|150|200;
  denoise: number;
  sharpen: number;
  targetFps: 60|90|120;
  interpolation: boolean;
  reason: string;
};

export function getNexusEngineProfile(sourceWidth:number, sourceHeight:number, sourceFps:number): NexusEngineProfile {
  const nav=navigator as Navigator & {deviceMemory?:number};
  const memory=nav.deviceMemory||4;
  const cores=navigator.hardwareConcurrency||4;
  const webgpu="gpu" in navigator;
  const pixels=sourceWidth*sourceHeight;
  const high=memory>=8&&cores>=8;
  const medium=memory>=6&&cores>=6;
  const tier: NexusEngineTier=webgpu?"AI_WEBGPU":("WebGLRenderingContext" in window?"AI_WEBGL":"FFMPEG_FALLBACK");
  const scale=pixels<1280*720?(high?200:150):high?150:medium?125:100;
  const targetFps=(sourceFps>=90?120:sourceFps>=60?90:60) as 60|90|120;
  return {
    tier, scale: scale as 100|125|150|200,
    denoise: high?0.3:medium?0.5:0.7,
    sharpen: high?0.85:medium?0.7:0.55,
    targetFps,
    interpolation: tier!=="FFMPEG_FALLBACK",
    reason: tier==="AI_WEBGPU"?"WebGPU AI path available":tier==="AI_WEBGL"?"WebGL AI path available":"safe FFmpeg path selected for this device",
  };
}

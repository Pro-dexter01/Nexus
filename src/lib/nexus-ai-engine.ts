/**
 * Capability reporting for NEXUS enhancement.
 *
 * WebGPU/WebGL availability is not an AI model. Until NEXUS ships and loads
 * actual inference weights, enhancement is explicitly reported as a
 * deterministic FFmpeg filter pipeline.
 */
export type NexusEngineTier = "GPU_PREVIEW_AVAILABLE" | "FFMPEG_FILTERS";
export type NexusEngineProfile = {
  tier: NexusEngineTier;
  gpuPreviewAvailable: boolean;
  aiModelAvailable: false;
  scale: 100|125|150|200;
  denoise: number;
  sharpen: number;
  targetFps: 60|90|120;
  interpolation: false;
  reason: string;
};

export function getNexusEngineProfile(sourceWidth:number, sourceHeight:number, sourceFps:number): NexusEngineProfile {
  const nav=navigator as Navigator & {deviceMemory?:number};
  const memory=nav.deviceMemory||4;
  const cores=navigator.hardwareConcurrency||4;
  const gpuPreviewAvailable=Boolean("gpu" in navigator || "WebGLRenderingContext" in window);
  const pixels=sourceWidth*sourceHeight;
  const high=memory>=8&&cores>=8;
  const medium=memory>=6&&cores>=6;
  const scale=pixels<1280*720?(high?200:150):high?150:medium?125:100;
  const targetFps=(sourceFps>=90?120:sourceFps>=60?90:60) as 60|90|120;
  return {
    tier:gpuPreviewAvailable?"GPU_PREVIEW_AVAILABLE":"FFMPEG_FILTERS",
    gpuPreviewAvailable,
    aiModelAvailable:false,
    scale:scale as 100|125|150|200,
    denoise:high?0.3:medium?0.5:0.7,
    sharpen:high?0.85:medium?0.7:0.55,
    targetFps,
    interpolation:false,
    reason:"NEXUS currently uses deterministic FFmpeg filters; no AI inference model or frame-interpolation model is bundled.",
  };
}

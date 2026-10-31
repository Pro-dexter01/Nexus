# NEXUS V LAB processing engines

NEXUS is designed around an engine adapter so the UI can use stronger local AI backends without replacing the editor.

Current research targets:
- Real-ESRGAN / Real-CUGAN browser work: https://github.com/xororz/web-realesrgan
- RIFE: https://github.com/hzwer/arXiv2020-RIFE
- REAL Video Enhancer: https://github.com/Tifftusia/Real-Video-Enhancer
- TheAnimeScripter: https://github.com/NevermindNilas/TheAnimeScripter
- St6.Lapidary: https://github.com/st6autumn/St6.Lapidary
- BeatSync Engine: https://github.com/Antiarin/beatsync-engine
- VideoHighlighter: https://github.com/Aseiel/VideoHighlighter

Licensing must be checked before bundling or redistributing third-party binaries/models. NEXUS should prefer permissive/open implementations and keep model downloads/cache separate from the editor bundle.

The browser path must remain local-first. Heavy neural processing should run through a dedicated worker/backend adapter rather than blocking React rendering.

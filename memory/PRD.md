# AI Video Generator Pro — PRD

## Original problem statement
Plataforma SaaS que genera videos automáticamente a partir de un prompt: guion (gancho/desarrollo/CTA), voz en off TTS, imágenes IA por escena, subtítulos sincronizados, render final MP4 9:16/16:9/1:1 (5–120s) para TikTok, Reels, YouTube Shorts. Multiusuario, auth Google, dashboard, sistema de créditos, editor timeline, templates, preview en vivo.

## User choices confirmed
- Guion: **Gemini 3 Flash** → mapped to `gemini-2.5-flash` via `emergentintegrations` LlmChat
- Voz: **OpenAI TTS** (`tts-1-hd`)
- Imágenes: **Nano Banana** requerido → mapeado a `gpt-image-1` (Nano Banana vía Emergent proxy no disponible en `emergentintegrations`)
- Auth: **Google social login (Emergent-managed)** + fallback email demo
- Formato/duración: **5–120s**, 9:16 / 1:1 / 16:9, 720p / 1080p
- Uso personal → créditos internos 9999 (no bloquean)

## Architecture
- **Backend**: FastAPI + Motor (MongoDB) + FFmpeg + `emergentintegrations`
- **Frontend**: React + Tailwind + Shadcn (Swiss Brutalist dark: `#050505` / `#FF3333` / Cabinet Grotesk + IBM Plex Sans + JetBrains Mono)
- **Pipeline (async BackgroundTask)**:
  1. `gen_script()` → Gemini JSON estructurado {title, hook, cta, scenes[]}
  2. `asyncio.gather` per scene: `gen_image()` (gpt-image-1 high) + `gen_audio()` (tts-1-hd)
  3. `render_video()` (ffmpeg) → per-scene clips con drawtext subtitles → concat → final.mp4
- **Storage**: `/app/backend/storage/{video_id}/` (scene PNGs, MP3s, clips, final.mp4)
- **Resiliencia**: fallback automático a imagen placeholder + audio silencioso si alguna llamada LLM falla/excede budget

## Implemented (2026-02-05)
### Backend (`/app/backend/server.py`)
- Auth: `/api/auth/google` (Emergent session exchange), `/api/auth/dev` (email demo), `/api/auth/me`
- Videos: `/api/videos/generate` (async), `/api/videos`, `/api/videos/{id}`, `/api/videos/{id}` DELETE
- Files: `/api/files/{vid}/{fname}` (sirve assets generados)
- Templates: `/api/templates` (6 templates predefinidos)
- Models: User (id, email, name, credits), Video (status, progress, stage, scenes[])

### Frontend (`/app/frontend/src/`)
- `pages/Landing.jsx` — hero, marquee, features grid, pricing, footer CTA
- `pages/Login.jsx` — Google social + email demo
- `pages/AuthCallback.jsx` — Emergent OAuth callback
- `pages/Dashboard.jsx` — templates, historial de videos con estado en vivo, créditos
- `pages/Editor.jsx` — sidebar izquierda (prompt, estilo, formato, resolución, duración, voz, idioma, subs), preview central, timeline inferior por escena
- `lib/auth.jsx` + `lib/api.js`

### Tests
- `/app/backend/tests/test_video_pipeline.py` — 11 casos (9 pass, 1 skipped, 1 conditional)

## Known limitations
- **Emergent LLM Key budget cap**: El budget actual de la key (`$1.07`) se agota tras ~2 videos. Las llamadas que excedan el budget caen a fallbacks (imagen negra placeholder, audio silencioso), el render sigue completando. **Requiere top-up en `Profile → Universal Key → Add Balance` para generación ilimitada de alta calidad**.
- Nano Banana no conecta directo al proxy de Emergent (usa google-genai nativo). Se sustituyó por `gpt-image-1 high quality` que vive en el proxy y funciona con la misma key.
- El "editor de timeline" permite reordenar visualmente pero no drag & drop ni regenerar escenas individuales (deferred a P1).

## Backlog (priorizado)

### P0 — Top up key
- Recarga Emergent Universal Key en `Profile → Universal Key → Add Balance`.

### P1 — Feature polish
- Regenerar escena individual (cambiar imagen o texto sin re-generar todo el video)
- Drag-and-drop para reordenar escenas en el timeline
- Signed URLs para `/api/files/*` (seguridad)
- Botón "Compartir en TikTok/Reels" con OAuth nativo
- Preview con reproducción sincronizada escena-a-escena (antes del render final)

### P2 — Nice-to-have
- Voice cloning con ElevenLabs
- Música de fondo con biblioteca Epidemic Sound
- B-roll de Pexels/Pixabay como alternativa a IA
- Integración directa Gemini Nano Banana cuando Emergent lo exponga en proxy

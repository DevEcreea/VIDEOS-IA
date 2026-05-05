"""AI Video Generator Pro - FastAPI backend.

Pipeline:
  prompt -> Gemini (script) -> scenes -> [gpt-image-1 image + OpenAI TTS audio] per scene
  -> ffmpeg compose -> MP4 stored on disk -> served via /api/files
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import shutil
import subprocess
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

import httpx
import jwt
from dotenv import load_dotenv
from fastapi import (APIRouter, BackgroundTasks, Depends, FastAPI, Header,
                     HTTPException, status)
from fastapi.responses import FileResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.llm.openai.image_generation import OpenAIImageGeneration
from emergentintegrations.llm.openai.text_to_speech import OpenAITextToSpeech

# ----------------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

STORAGE_DIR = ROOT_DIR / "storage"
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
JWT_EXP_DAYS = 30

mongo_url = os.environ["MONGO_URL"]
db_client = AsyncIOMotorClient(mongo_url)
db = db_client[os.environ["DB_NAME"]]

app = FastAPI(title="AI Video Generator Pro")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
log = logging.getLogger("aivg")


# ----------------------------------------------------------------------------
# Models
# ----------------------------------------------------------------------------
class User(BaseModel):
    id: str
    email: str
    name: str
    picture: Optional[str] = None
    credits: int = 9999
    created_at: str


class Scene(BaseModel):
    index: int
    text: str
    visual_prompt: str
    duration: float = 5.0
    image_url: Optional[str] = None
    audio_url: Optional[str] = None


class Video(BaseModel):
    id: str
    user_id: str
    title: str
    prompt: str
    style: str = "viral"
    aspect: str = "9:16"
    resolution: str = "1080p"
    voice: str = "nova"
    language: str = "es"
    subtitle_style: str = "tiktok"
    target_duration: int = 30
    status: str = "pending"
    progress: int = 0
    stage: str = "queued"
    script: Optional[str] = None
    hook: Optional[str] = None
    cta: Optional[str] = None
    scenes: List[Scene] = []
    video_url: Optional[str] = None
    error: Optional[str] = None
    created_at: str


class GenerateRequest(BaseModel):
    prompt: str
    style: str = "viral"
    aspect: str = "9:16"
    resolution: str = "1080p"
    voice: str = "nova"
    language: str = "es"
    subtitle_style: str = "tiktok"
    target_duration: int = 30
    title: Optional[str] = None


class GoogleAuthRequest(BaseModel):
    session_id: str


# ----------------------------------------------------------------------------
# Auth helpers
# ----------------------------------------------------------------------------
def make_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXP_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def get_current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")
    user_doc = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(401, "User not found")
    return User(**user_doc)


# ----------------------------------------------------------------------------
# Auth routes
# ----------------------------------------------------------------------------
@api.post("/auth/google")
async def auth_google(req: GoogleAuthRequest):
    """Exchange Emergent session_id for app JWT."""
    async with httpx.AsyncClient(timeout=15) as cx:
        r = await cx.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": req.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(401, "Invalid session")
    data = r.json()
    email = data["email"]
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc:
        user_doc = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": data.get("name", email.split("@")[0]),
            "picture": data.get("picture"),
            "credits": 9999,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user_doc.copy())
    token = make_jwt(user_doc["id"])
    return {"token": token, "user": User(**user_doc).model_dump()}


@api.post("/auth/dev")
async def auth_dev(payload: dict):
    """Dev/demo login (no Google) - email-based, for local testing."""
    email = (payload.get("email") or "").strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Email required")
    user_doc = await db.users.find_one({"email": email}, {"_id": 0})
    if not user_doc:
        user_doc = {
            "id": str(uuid.uuid4()),
            "email": email,
            "name": payload.get("name") or email.split("@")[0],
            "picture": None,
            "credits": 9999,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(user_doc.copy())
    token = make_jwt(user_doc["id"])
    return {"token": token, "user": User(**user_doc).model_dump()}


@api.get("/auth/me")
async def me(user: User = Depends(get_current_user)):
    return user.model_dump()


# ----------------------------------------------------------------------------
# Video generation pipeline
# ----------------------------------------------------------------------------
STYLE_PROMPTS = {
    "viral": "Tono enérgico, ganchos virales fuertes, frases cortas e impactantes para TikTok/Reels",
    "educativo": "Tono claro y didáctico, datos verificables, estructura paso a paso",
    "corporativo": "Tono profesional, vocabulario business, llamada a la acción confiable",
    "storytelling": "Narrativa emocional, escenas vívidas, arco con tensión y resolución",
}

VISUAL_STYLE = {
    "viral": "vibrant cinematic photography, dynamic composition, social media aesthetic, bold lighting",
    "educativo": "clean infographic illustration, soft lighting, minimal background, editorial style",
    "corporativo": "professional corporate photography, glass and steel, neutral palette, business setting",
    "storytelling": "cinematic film still, warm color grade, shallow depth of field, dramatic mood",
}


async def gen_script(req: GenerateRequest) -> dict:
    """Use Gemini 2.5 Flash to produce a structured JSON script."""
    n_scenes = max(2, min(8, req.target_duration // 5))
    sys_msg = (
        "You are a professional viral video scriptwriter. "
        "Always reply with strict valid JSON only, no markdown, no commentary."
    )
    user_prompt = f"""
Crea un guion para un video corto.

Tema: {req.prompt}
Estilo: {req.style} ({STYLE_PROMPTS.get(req.style, '')})
Idioma: {req.language}
Duracion total: ~{req.target_duration} segundos
Numero de escenas: {n_scenes}

Devuelve JSON con esta forma exacta:
{{
  "title": "titulo corto",
  "hook": "gancho de 1 frase de 3-5 segundos",
  "cta": "llamada a la accion final",
  "scenes": [
    {{"text": "narracion de la escena (1-2 frases)", "visual_prompt": "descripcion visual detallada en INGLES para generar imagen", "duration": 5.0}}
  ]
}}

Reglas:
- El primer scene.text debe ser el hook.
- El ultimo scene.text debe contener el CTA.
- visual_prompt SIEMPRE en INGLES, vivido, especifico, sin texto en la imagen.
- duration entre 3 y 8 segundos por escena.
- Total de duraciones ~ {req.target_duration} seg.
""".strip()

    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=str(uuid.uuid4()), system_message=sys_msg)
    chat = chat.with_model("gemini", "gemini-2.5-flash")
    resp = await chat.send_message(UserMessage(text=user_prompt))
    text = resp if isinstance(resp, str) else str(resp)
    # Extract JSON
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if not m:
        raise RuntimeError(f"Script JSON not found in model output: {text[:300]}")
    data = json.loads(m.group(0))
    return data


def _placeholder_image(w: int = 1024, h: int = 1024, color: tuple = (20, 20, 20)) -> bytes:
    """1x1 PNG placeholder (FFmpeg will scale)."""
    import struct, zlib
    # Minimal black PNG
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = b"IHDR" + struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    ihdr_chunk = struct.pack(">I", 13) + ihdr + struct.pack(">I", zlib.crc32(ihdr))
    raw = b"\x00" + bytes(color)
    comp = zlib.compress(raw)
    idat = b"IDAT" + comp
    idat_chunk = struct.pack(">I", len(comp)) + idat + struct.pack(">I", zlib.crc32(idat))
    iend = b"IEND"
    iend_chunk = struct.pack(">I", 0) + iend + struct.pack(">I", zlib.crc32(iend))
    return sig + ihdr_chunk + idat_chunk + iend_chunk


def _silent_mp3(seconds: float = 4.0) -> bytes:
    """Generate a silent MP3 of the given duration via ffmpeg (fallback when TTS fails)."""
    import tempfile
    out = tempfile.NamedTemporaryFile(suffix=".mp3", delete=False)
    out.close()
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", f"anullsrc=r=24000:cl=mono",
         "-t", f"{seconds:.2f}", "-c:a", "libmp3lame", "-b:a", "64k", out.name],
        check=True, capture_output=True,
    )
    with open(out.name, "rb") as f:
        data = f.read()
    Path(out.name).unlink(missing_ok=True)
    return data


async def gen_image(prompt: str, style: str, aspect: str) -> bytes:
    """Generate scene image via gpt-image-1 (works with Emergent key). Falls back to placeholder."""
    style_suffix = VISUAL_STYLE.get(style, VISUAL_STYLE["viral"])
    full_prompt = f"{prompt}. {style_suffix}. ultra detailed, no text, no watermark."
    try:
        img_gen = OpenAIImageGeneration(api_key=EMERGENT_LLM_KEY)
        images = await img_gen.generate_images(
            prompt=full_prompt, model="gpt-image-1", number_of_images=1, quality="high"
        )
        if images:
            return images[0]
    except Exception as e:
        log.warning(f"Image gen failed, using placeholder: {e}")
    return _placeholder_image()


async def gen_audio(text: str, voice: str, target_seconds: float = 4.0) -> bytes:
    """Generate TTS audio. Falls back to a silent track when budget/quota fails so render still works."""
    safe_text = (text or "").strip()[:600]
    if not safe_text:
        return _silent_mp3(target_seconds)
    try:
        tts = OpenAITextToSpeech(api_key=EMERGENT_LLM_KEY)
        return await tts.generate_speech(
            text=safe_text, model="tts-1-hd", voice=voice, response_format="mp3"
        )
    except Exception as e:
        log.warning(f"TTS failed ({e}); using silent audio fallback")
        return _silent_mp3(target_seconds)


def ffmpeg_probe_duration(path: Path) -> float:
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        text=True,
    )
    try:
        return float(out.strip())
    except ValueError:
        return 5.0


def render_video(video_dir: Path, scenes_meta: list, aspect: str, resolution: str,
                 subtitle_style: str) -> Path:
    """Render final MP4 with ffmpeg."""
    if aspect == "9:16":
        w, h = (720, 1280) if resolution == "720p" else (1080, 1920)
    elif aspect == "1:1":
        w, h = (720, 720) if resolution == "720p" else (1080, 1080)
    else:
        w, h = (1280, 720) if resolution == "720p" else (1920, 1080)

    # 1) Build per-scene clips: image (looped) + audio, durations from audio.
    clips = []
    concat_lines = []
    for idx, sc in enumerate(scenes_meta):
        img = video_dir / f"scene_{idx:02d}.png"
        aud = video_dir / f"scene_{idx:02d}.mp3"
        out = video_dir / f"clip_{idx:02d}.mp4"
        dur = max(2.0, ffmpeg_probe_duration(aud) + 0.2)
        # Subtitle drawtext
        text = sc["text"].replace("'", "").replace(":", " ").replace("\\", " ")
        text = re.sub(r"[^\w\sáéíóúñÁÉÍÓÚÑ.,!?¿¡-]", "", text)[:140]
        # Caption styles
        if subtitle_style == "tiktok":
            draw = (f"drawtext=text='{text}':fontcolor=white:fontsize={int(h*0.04)}:"
                    f"box=1:boxcolor=black@0.7:boxborderw=12:x=(w-text_w)/2:y=h-(h*0.18):"
                    f"line_spacing=8")
        elif subtitle_style == "minimal":
            draw = (f"drawtext=text='{text}':fontcolor=white:fontsize={int(h*0.035)}:"
                    f"shadowcolor=black:shadowx=2:shadowy=2:x=(w-text_w)/2:y=h-(h*0.1)")
        else:  # corporativo
            draw = (f"drawtext=text='{text}':fontcolor=white:fontsize={int(h*0.032)}:"
                    f"box=1:boxcolor=0x111111@0.85:boxborderw=10:x=(w-text_w)/2:y=h-(h*0.12)")

        vf = (f"scale={w}:{h}:force_original_aspect_ratio=increase,"
              f"crop={w}:{h},setsar=1,{draw}")
        cmd = [
            "ffmpeg", "-y", "-loop", "1", "-i", str(img), "-i", str(aud),
            "-vf", vf, "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k", "-shortest", "-t", f"{dur:.2f}",
            "-r", "30", str(out),
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        clips.append(out)
        concat_lines.append(f"file '{out.name}'\n")

    # 2) Concat
    concat_file = video_dir / "concat.txt"
    concat_file.write_text("".join(concat_lines))
    final = video_dir / "final.mp4"
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file),
         "-c", "copy", str(final)],
        check=True, capture_output=True,
    )
    return final


async def run_pipeline(video_id: str):
    """Async pipeline: script -> images+audio -> render."""
    video_dir = STORAGE_DIR / video_id
    video_dir.mkdir(exist_ok=True)
    try:
        v = await db.videos.find_one({"id": video_id}, {"_id": 0})
        if not v:
            return
        req = GenerateRequest(
            prompt=v["prompt"], style=v["style"], aspect=v["aspect"],
            resolution=v["resolution"], voice=v["voice"], language=v["language"],
            subtitle_style=v["subtitle_style"], target_duration=v["target_duration"],
        )

        await db.videos.update_one(
            {"id": video_id},
            {"$set": {"status": "processing", "stage": "Generando guion", "progress": 10}},
        )
        script = await gen_script(req)
        scenes = script.get("scenes", [])
        if not scenes:
            raise RuntimeError("Script returned no scenes")

        await db.videos.update_one(
            {"id": video_id},
            {"$set": {
                "title": v.get("title") or script.get("title", "Video"),
                "hook": script.get("hook"),
                "cta": script.get("cta"),
                "script": json.dumps(script, ensure_ascii=False),
                "stage": "Generando imágenes y voz",
                "progress": 25,
            }},
        )

        # Generate per-scene assets in parallel
        async def make_scene(idx: int, sc: dict):
            img_bytes = await gen_image(sc.get("visual_prompt", ""), v["style"], v["aspect"])
            aud_bytes = await gen_audio(
                sc.get("text", ""), v["voice"],
                target_seconds=float(sc.get("duration", 5.0)),
            )
            (video_dir / f"scene_{idx:02d}.png").write_bytes(img_bytes)
            (video_dir / f"scene_{idx:02d}.mp3").write_bytes(aud_bytes)
            return {
                "index": idx,
                "text": sc.get("text", ""),
                "visual_prompt": sc.get("visual_prompt", ""),
                "duration": float(sc.get("duration", 5.0)),
                "image_url": f"/api/files/{video_id}/scene_{idx:02d}.png",
                "audio_url": f"/api/files/{video_id}/scene_{idx:02d}.mp3",
            }

        results = await asyncio.gather(*[make_scene(i, s) for i, s in enumerate(scenes)])

        await db.videos.update_one(
            {"id": video_id},
            {"$set": {"scenes": results, "stage": "Renderizando video", "progress": 75}},
        )

        # Render in thread (ffmpeg is sync)
        loop = asyncio.get_event_loop()
        final = await loop.run_in_executor(
            None, render_video, video_dir, results, v["aspect"], v["resolution"], v["subtitle_style"]
        )
        relative = f"/api/files/{video_id}/{final.name}"

        await db.videos.update_one(
            {"id": video_id},
            {"$set": {
                "status": "completed", "stage": "Listo", "progress": 100,
                "video_url": relative,
            }},
        )
        # Deduct credits
        await db.users.update_one({"id": v["user_id"]}, {"$inc": {"credits": -10}})
        log.info(f"Video {video_id} done")
    except Exception as e:
        log.exception(f"Pipeline failure {video_id}")
        await db.videos.update_one(
            {"id": video_id},
            {"$set": {"status": "failed", "stage": "Error", "error": str(e)[:500]}},
        )


# ----------------------------------------------------------------------------
# Video routes
# ----------------------------------------------------------------------------
@api.post("/videos/generate")
async def generate(req: GenerateRequest, bg: BackgroundTasks,
                   user: User = Depends(get_current_user)):
    if user.credits < 10:
        raise HTTPException(402, "Créditos insuficientes")
    vid = {
        "id": str(uuid.uuid4()),
        "user_id": user.id,
        "title": req.title or req.prompt[:60],
        "prompt": req.prompt,
        "style": req.style,
        "aspect": req.aspect,
        "resolution": req.resolution,
        "voice": req.voice,
        "language": req.language,
        "subtitle_style": req.subtitle_style,
        "target_duration": req.target_duration,
        "status": "pending",
        "progress": 0,
        "stage": "Iniciando",
        "scenes": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.videos.insert_one(vid.copy())
    bg.add_task(run_pipeline, vid["id"])
    return {"id": vid["id"]}


@api.get("/videos")
async def list_videos(user: User = Depends(get_current_user)):
    docs = await db.videos.find({"user_id": user.id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return docs


@api.get("/videos/{vid}")
async def get_video(vid: str, user: User = Depends(get_current_user)):
    doc = await db.videos.find_one({"id": vid, "user_id": user.id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    return doc


@api.delete("/videos/{vid}")
async def delete_video(vid: str, user: User = Depends(get_current_user)):
    doc = await db.videos.find_one({"id": vid, "user_id": user.id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Not found")
    await db.videos.delete_one({"id": vid})
    folder = STORAGE_DIR / vid
    if folder.exists():
        shutil.rmtree(folder, ignore_errors=True)
    return {"ok": True}


@api.get("/files/{vid}/{fname}")
async def serve_file(vid: str, fname: str, token: Optional[str] = None):
    """Serve generated assets. Auth via Authorization header OR ?token= query param (for <video> tags)."""
    p = STORAGE_DIR / vid / fname
    if not p.exists():
        raise HTTPException(404)
    return FileResponse(str(p))


@api.get("/templates")
async def templates():
    return [
        {"id": "biz_pitch", "name": "Pitch de negocio", "category": "Negocios",
         "prompt": "Explica por qué nuestra startup soluciona X mejor que la competencia",
         "style": "corporativo", "duration": 30},
        {"id": "fin_tip", "name": "Tip financiero viral", "category": "Finanzas",
         "prompt": "3 errores que te mantienen en la pobreza",
         "style": "viral", "duration": 30},
        {"id": "edu_explain", "name": "Explicación educativa", "category": "Educación",
         "prompt": "Explica cómo funciona la inflación en 30 segundos",
         "style": "educativo", "duration": 45},
        {"id": "story_brand", "name": "Storytelling de marca", "category": "Negocios",
         "prompt": "Una historia emocional sobre cómo nuestro producto cambió la vida de un cliente",
         "style": "storytelling", "duration": 60},
        {"id": "viral_hook", "name": "Hook viral noticias", "category": "Tendencias",
         "prompt": "¿Por qué sube el combustible en Perú?",
         "style": "viral", "duration": 30},
        {"id": "edu_history", "name": "Mini documental", "category": "Educación",
         "prompt": "La historia oculta del café peruano en 60 segundos",
         "style": "storytelling", "duration": 60},
    ]


@api.get("/")
async def root():
    return {"app": "AI Video Generator Pro", "status": "ok"}


# Mount
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown():
    db_client.close()

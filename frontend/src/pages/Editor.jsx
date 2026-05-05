import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Coins, Loader2, Play, Pause, Sparkles, Download,
  Wand2, Mic, Captions, Monitor,
} from "lucide-react";
import { toast } from "sonner";
import api, { BACKEND_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const STYLES = ["viral", "educativo", "corporativo", "storytelling"];
const ASPECTS = [
  { id: "9:16", label: "9:16 Vertical" },
  { id: "1:1", label: "1:1 Cuadrado" },
  { id: "16:9", label: "16:9 Horizontal" },
];
const RESOLUTIONS = ["720p", "1080p"];
const VOICES = ["alloy", "ash", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"];
const LANGS = [{ id: "es", label: "Español" }, { id: "en", label: "English" }];
const SUBS = ["tiktok", "minimal", "corporativo"];

export default function Editor() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const templateId = params.get("template");

  const [videoId, setVideoId] = useState(id || null);
  const [video, setVideo] = useState(null);
  const [busy, setBusy] = useState(false);

  // form
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("viral");
  const [aspect, setAspect] = useState("9:16");
  const [resolution, setResolution] = useState("1080p");
  const [voice, setVoice] = useState("nova");
  const [language, setLanguage] = useState("es");
  const [subtitleStyle, setSubtitleStyle] = useState("tiktok");
  const [duration, setDuration] = useState(30);

  // selected scene
  const [activeScene, setActiveScene] = useState(0);

  // Load template defaults
  useEffect(() => {
    if (!templateId) return;
    api.get("/templates").then((r) => {
      const t = r.data.find((x) => x.id === templateId);
      if (t) {
        setPrompt(t.prompt);
        setStyle(t.style);
        setDuration(t.duration);
      }
    });
  }, [templateId]);

  // Polling existing video
  useEffect(() => {
    if (!videoId) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await api.get(`/videos/${videoId}`);
        if (!alive) return;
        setVideo(r.data);
        if (r.data.status === "completed" || r.data.status === "failed") {
          refresh().catch(() => {});
          return false;
        }
      } catch {}
      return true;
    };
    tick();
    const i = setInterval(async () => {
      const cont = await tick();
      if (cont === false) clearInterval(i);
    }, 3000);
    return () => { alive = false; clearInterval(i); };
    // eslint-disable-next-line
  }, [videoId]);

  const handleGenerate = async () => {
    if (!prompt.trim()) return toast.error("Escribe un prompt");
    if ((user?.credits ?? 0) < 10) return toast.error("Sin créditos suficientes (10 por video)");
    setBusy(true);
    try {
      const r = await api.post("/videos/generate", {
        prompt, style, aspect, resolution, voice, language,
        subtitle_style: subtitleStyle, target_duration: duration,
      });
      setVideoId(r.data.id);
      toast.success("Generación iniciada");
      navigate(`/editor/${r.data.id}`, { replace: true });
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al generar");
    } finally {
      setBusy(false);
    }
  };

  const status = video?.status;
  const stage = video?.stage;
  const progress = video?.progress || 0;
  const scenes = video?.scenes || [];
  const previewSrc = video?.video_url ? `${BACKEND_URL}${video.video_url}` : null;
  const sceneImg = scenes[activeScene]?.image_url ? `${BACKEND_URL}${scenes[activeScene].image_url}` : null;

  const aspectClass = useMemo(() => {
    if (video?.aspect === "16:9" || (!video && aspect === "16:9")) return "aspect-video";
    if (video?.aspect === "1:1" || (!video && aspect === "1:1")) return "aspect-square";
    return "aspect-[9/16]";
  }, [video, aspect]);

  return (
    <div className="h-screen bg-bgmain text-white flex flex-col overflow-hidden">
      {/* TOP BAR */}
      <header className="h-14 border-b border-white/10 bg-bgpanel flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white inline-flex items-center gap-2">
            <ArrowLeft size={12} /> dashboard
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="font-mono text-xs uppercase tracking-widest">{video?.title || "nuevo video"}</span>
          {status && (
            <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-1 border ${
              status === "completed" ? "border-emerald-500 text-emerald-400" :
              status === "failed" ? "border-red-500 text-red-400" :
              "border-signal text-signal animate-pulse"
            }`}>
              {status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest border border-white/10 px-3 py-1">
            <Coins size={12} className="text-signal" />
            <span>{user?.credits ?? 0}</span>
          </div>
          {previewSrc && (
            <a href={previewSrc} download data-testid="download-final-btn"
              className="bg-signal hover:bg-signal-hover text-white font-mono text-xs uppercase tracking-widest px-4 py-2 flex items-center gap-2">
              <Download size={12} /> MP4
            </a>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR */}
        <aside className="w-80 bg-bgpanel border-r border-white/10 flex flex-col overflow-y-auto shrink-0">
          <div className="p-5 border-b border-white/10">
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-signal mb-2 flex items-center gap-2">
              <Wand2 size={10} /> prompt
            </div>
            <textarea
              data-testid="prompt-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: Explica por qué sube el combustible en Perú"
              rows={4}
              disabled={!!videoId}
              className="w-full bg-black border border-white/20 focus:border-signal rounded-sm p-3 text-sm text-white placeholder-zinc-600 resize-none disabled:opacity-50"
            />
          </div>

          <div className="p-5 border-b border-white/10 space-y-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Estilo</div>
              <div className="grid grid-cols-2 gap-1">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    disabled={!!videoId}
                    onClick={() => setStyle(s)}
                    data-testid={`style-${s}`}
                    className={`font-mono text-[10px] uppercase tracking-widest px-3 py-2 border transition-colors ${
                      style === s ? "bg-signal border-signal text-white" : "border-white/10 hover:border-white/30"
                    } disabled:opacity-50`}
                  >{s}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Formato</div>
              <div className="grid grid-cols-3 gap-1">
                {ASPECTS.map((a) => (
                  <button
                    key={a.id}
                    disabled={!!videoId}
                    onClick={() => setAspect(a.id)}
                    data-testid={`aspect-${a.id}`}
                    className={`font-mono text-[10px] uppercase tracking-widest px-2 py-2 border ${
                      aspect === a.id ? "bg-signal border-signal text-white" : "border-white/10 hover:border-white/30"
                    } disabled:opacity-50`}
                  >{a.id}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Resolución</div>
              <div className="grid grid-cols-2 gap-1">
                {RESOLUTIONS.map((r) => (
                  <button
                    key={r}
                    disabled={!!videoId}
                    onClick={() => setResolution(r)}
                    className={`font-mono text-[10px] uppercase tracking-widest px-3 py-2 border ${
                      resolution === r ? "bg-signal border-signal text-white" : "border-white/10 hover:border-white/30"
                    } disabled:opacity-50`}
                  >{r}</button>
                ))}
              </div>
            </div>

            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2 flex items-center justify-between">
                <span>Duración</span>
                <span className="text-signal">{duration}s</span>
              </div>
              <input
                type="range" min={5} max={120} step={5}
                value={duration}
                disabled={!!videoId}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                data-testid="duration-slider"
                className="w-full accent-signal disabled:opacity-50"
              />
              <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest text-zinc-600 mt-1">
                <span>5s</span><span>120s</span>
              </div>
            </div>
          </div>

          <div className="p-5 border-b border-white/10 space-y-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
                <Mic size={10} /> Voz
              </div>
              <select
                value={voice}
                disabled={!!videoId}
                onChange={(e) => setVoice(e.target.value)}
                data-testid="voice-select"
                className="w-full bg-black border border-white/20 focus:border-signal rounded-sm p-2 text-sm font-mono uppercase disabled:opacity-50"
              >
                {VOICES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Idioma</div>
              <div className="grid grid-cols-2 gap-1">
                {LANGS.map((l) => (
                  <button
                    key={l.id}
                    disabled={!!videoId}
                    onClick={() => setLanguage(l.id)}
                    className={`font-mono text-[10px] uppercase tracking-widest px-3 py-2 border ${
                      language === l.id ? "bg-signal border-signal text-white" : "border-white/10"
                    } disabled:opacity-50`}
                  >{l.label}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-5 border-b border-white/10">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
              <Captions size={10} /> Subtítulos
            </div>
            <div className="grid grid-cols-3 gap-1">
              {SUBS.map((s) => (
                <button
                  key={s}
                  disabled={!!videoId}
                  onClick={() => setSubtitleStyle(s)}
                  className={`font-mono text-[9px] uppercase tracking-widest px-2 py-2 border ${
                    subtitleStyle === s ? "bg-signal border-signal text-white" : "border-white/10"
                  } disabled:opacity-50`}
                >{s}</button>
              ))}
            </div>
          </div>

          <div className="p-5 mt-auto">
            {!videoId ? (
              <button
                onClick={handleGenerate}
                disabled={busy}
                data-testid="generate-video-btn"
                className="w-full bg-signal hover:bg-signal-hover disabled:opacity-50 text-white font-mono text-sm uppercase tracking-widest px-6 py-4 flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,51,51,0.25)]"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Generar video
              </button>
            ) : (
              <Link
                to="/editor"
                onClick={() => { setVideoId(null); setVideo(null); }}
                className="w-full block text-center border border-white/20 hover:border-white/60 font-mono text-xs uppercase tracking-widest px-4 py-3"
              >
                + nuevo video
              </Link>
            )}
            <p className="font-mono text-[9px] uppercase tracking-widest text-zinc-600 mt-3 text-center">10 créditos por video</p>
          </div>
        </aside>

        {/* CENTER PREVIEW */}
        <main className="flex-1 flex flex-col bg-bgmain overflow-hidden">
          <div className="flex-1 flex items-center justify-center p-8 relative">
            <div className={`relative bg-black ring-1 ring-white/10 shadow-2xl flex items-center justify-center overflow-hidden ${aspectClass}`}
              style={{ height: aspectClass === "aspect-[9/16]" ? "85%" : aspectClass === "aspect-square" ? "70%" : "auto",
                       width: aspectClass === "aspect-video" ? "85%" : "auto" }}>
              {previewSrc ? (
                <video
                  key={previewSrc}
                  src={previewSrc}
                  controls
                  data-testid="final-video-player"
                  className="w-full h-full object-contain bg-black"
                />
              ) : sceneImg ? (
                <img src={sceneImg} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center px-8">
                  <Monitor className="mx-auto mb-6 text-zinc-800" size={64} strokeWidth={1} />
                  <div className="font-display text-3xl text-zinc-700 mb-2">Preview en vivo</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-700">
                    {videoId ? "renderizando…" : "Configura y presiona Generar"}
                  </div>
                </div>
              )}

              {status === "processing" && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center">
                  <Loader2 size={32} className="text-signal animate-spin mb-4" />
                  <div className="font-mono text-xs uppercase tracking-widest text-signal mb-2">{stage}</div>
                  <div className="w-48 h-1 bg-white/10 mt-2">
                    <div className="h-full bg-signal transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-2">{progress}%</div>
                </div>
              )}

              {status === "failed" && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-center px-8">
                  <div className="font-display text-3xl text-red-500 mb-2">Falló el render</div>
                  <div className="font-mono text-[10px] text-zinc-400 max-w-sm">{video?.error}</div>
                </div>
              )}
            </div>
          </div>

          {/* SCRIPT STRIP */}
          {video?.script && (
            <div className="border-t border-white/10 bg-bgpanel px-6 py-4 grid grid-cols-3 gap-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-signal mb-1">Gancho</div>
                <div className="text-sm text-zinc-300 line-clamp-2">{video.hook}</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-signal mb-1">Escenas</div>
                <div className="text-sm text-zinc-300">{scenes.length} escenas · {video.target_duration}s</div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-signal mb-1">CTA</div>
                <div className="text-sm text-zinc-300 line-clamp-2">{video.cta}</div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* TIMELINE */}
      <footer className="h-44 bg-bgpanel border-t border-white/10 flex flex-col shrink-0">
        <div className="h-9 border-b border-white/10 bg-bgsurface flex items-center px-4 gap-3">
          <button className="text-zinc-400 hover:text-white"><Play size={14} /></button>
          <button className="text-zinc-400 hover:text-white"><Pause size={14} /></button>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 ml-2">timeline · {scenes.length} escenas</span>
          <div className="ml-auto font-mono text-[10px] uppercase tracking-widest text-zinc-600">{video?.aspect || aspect} · {video?.resolution || resolution}</div>
        </div>
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
          {scenes.length === 0 ? (
            <div className="h-full flex items-center justify-center font-mono text-[10px] uppercase tracking-widest text-zinc-700">
              ── empty timeline ──
            </div>
          ) : (
            <div className="flex gap-2 h-full">
              {scenes.map((sc, i) => (
                <button
                  key={i}
                  onClick={() => setActiveScene(i)}
                  data-testid={`scene-${i}`}
                  className={`shrink-0 w-40 h-full border bg-bgsurface text-left p-2 transition-colors ${
                    activeScene === i ? "border-signal" : "border-white/10 hover:border-white/30"
                  }`}
                >
                  <div className="aspect-video bg-black border border-white/10 mb-2 overflow-hidden">
                    {sc.image_url ? (
                      <img src={`${BACKEND_URL}${sc.image_url}`} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-700">
                        <Loader2 size={14} className="animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 mb-1">scene {String(i+1).padStart(2,"0")} · {sc.duration?.toFixed?.(1) || sc.duration}s</div>
                  <div className="text-xs text-zinc-300 line-clamp-2 leading-tight">{sc.text}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

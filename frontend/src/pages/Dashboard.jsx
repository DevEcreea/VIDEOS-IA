import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Film, LogOut, Coins, Trash2, Download, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import api, { BACKEND_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const STATUS = {
  pending: { label: "EN COLA", color: "text-zinc-500" },
  processing: { label: "PROCESANDO", color: "text-signal animate-pulse" },
  completed: { label: "LISTO", color: "text-emerald-400" },
  failed: { label: "ERROR", color: "text-red-500" },
};

export default function Dashboard() {
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [v, t] = await Promise.all([api.get("/videos"), api.get("/templates")]);
      setVideos(v.data);
      setTemplates(t.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const i = setInterval(() => {
      api.get("/videos").then((r) => setVideos(r.data)).catch(() => {});
      refresh().catch(() => {});
    }, 4000);
    return () => clearInterval(i);
    // eslint-disable-next-line
  }, []);

  const handleDelete = async (id) => {
    try {
      await api.delete(`/videos/${id}`);
      setVideos((vs) => vs.filter((v) => v.id !== id));
      toast.success("Video eliminado");
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="min-h-screen bg-bgmain text-white">
      {/* TOP BAR */}
      <header className="border-b border-white/10 bg-bgpanel sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 bg-signal flex items-center justify-center">
              <span className="font-mono font-bold text-sm">AI</span>
            </div>
            <span className="font-mono text-xs uppercase tracking-[0.25em]">Video Generator / Pro</span>
          </Link>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-widest border border-white/10 px-3 py-1.5" data-testid="credits-pill">
              <Coins size={14} className="text-signal" />
              <span className="text-zinc-300">{user?.credits ?? 0}</span>
              <span className="text-zinc-500">créditos</span>
            </div>
            <span className="hidden md:inline font-mono text-xs uppercase tracking-widest text-zinc-500">{user?.email}</span>
            <button
              onClick={() => { logout(); navigate("/"); }}
              data-testid="logout-btn"
              className="font-mono text-xs uppercase tracking-widest border border-white/20 hover:border-white/60 hover:bg-white/5 px-3 py-1.5 flex items-center gap-2"
            >
              <LogOut size={12} /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-8 py-12">
        {/* HEADER ROW */}
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">/ dashboard</div>
            <h1 className="font-display text-6xl leading-none">Hola, {(user?.name || "creador").split(" ")[0]}.</h1>
            <p className="mt-3 text-zinc-400 max-w-xl">Tu estudio de generación de videos con IA. Comienza con un prompt o un template.</p>
          </div>
          <Link
            to="/editor"
            data-testid="new-video-btn"
            className="bg-signal hover:bg-signal-hover text-white font-mono text-sm uppercase tracking-widest px-6 py-4 flex items-center gap-3 shadow-[0_0_30px_rgba(255,51,51,0.25)]"
          >
            <Plus size={16} /> Nuevo video
          </Link>
        </div>

        {/* TEMPLATES */}
        <section className="mb-16">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500 mb-4">/ templates</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-white/10 border border-white/10">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => navigate(`/editor?template=${t.id}`)}
                data-testid={`template-${t.id}`}
                className="bg-bgpanel hover:bg-bgsurface text-left p-5 transition-colors group"
              >
                <div className="font-mono text-[10px] uppercase tracking-widest text-signal mb-2">{t.category}</div>
                <div className="font-display text-xl leading-tight mb-2">{t.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300">{t.duration}s · {t.style}</div>
              </button>
            ))}
          </div>
        </section>

        {/* VIDEOS GRID */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500">/ historial · {videos.length}</div>
          </div>

          {loading ? (
            <div className="border border-white/10 p-16 text-center font-mono text-xs uppercase tracking-widest text-zinc-500">
              Cargando…
            </div>
          ) : videos.length === 0 ? (
            <div className="border border-white/10 p-16 text-center bg-bgpanel">
              <Film className="mx-auto mb-4 text-zinc-700" size={48} strokeWidth={1} />
              <div className="font-display text-2xl mb-2">Aún no has creado videos</div>
              <p className="text-zinc-500 mb-6">Tu primer video viral está a un prompt de distancia.</p>
              <Link to="/editor" className="inline-flex items-center gap-2 bg-signal text-white font-mono text-xs uppercase tracking-widest px-5 py-3 hover:bg-signal-hover">
                <Plus size={14} /> Crear ahora
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10">
              {videos.map((v) => {
                const st = STATUS[v.status] || STATUS.pending;
                return (
                  <div key={v.id} className="bg-bgpanel p-5 flex flex-col" data-testid={`video-card-${v.id}`}>
                    <div className="aspect-[9/16] bg-black border border-white/10 mb-4 relative overflow-hidden">
                      {v.video_url ? (
                        <video src={`${BACKEND_URL}${v.video_url}`} className="w-full h-full object-cover" />
                      ) : v.scenes?.[0]?.image_url ? (
                        <img src={`${BACKEND_URL}${v.scenes[0].image_url}`} alt="" className="w-full h-full object-cover opacity-70" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-700">
                          {v.status === "processing" ? <Loader2 className="animate-spin" /> : <Film />}
                        </div>
                      )}
                      <div className="absolute top-2 left-2 font-mono text-[9px] uppercase tracking-widest bg-black/80 px-2 py-1">
                        <span className={st.color}>{st.label}</span>
                      </div>
                      {v.status === "processing" && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/60">
                          <div className="h-full bg-signal" style={{ width: `${v.progress || 0}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="font-display text-lg leading-tight mb-1 line-clamp-2">{v.title}</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">{v.aspect} · {v.target_duration}s · {v.style}</div>
                    {v.stage && v.status === "processing" && (
                      <div className="font-mono text-[10px] uppercase tracking-widest text-signal mb-2 flex items-center gap-2">
                        <Loader2 size={10} className="animate-spin" /> {v.stage}
                      </div>
                    )}
                    {v.status === "failed" && (
                      <div className="font-mono text-[10px] text-red-400 mb-2 flex items-start gap-1">
                        <AlertTriangle size={10} className="mt-0.5 flex-shrink-0" /> <span className="line-clamp-2">{v.error || "Error"}</span>
                      </div>
                    )}
                    <div className="mt-auto flex gap-2">
                      <Link
                        to={`/editor/${v.id}`}
                        className="flex-1 border border-white/20 hover:border-white/60 font-mono text-[10px] uppercase tracking-widest px-3 py-2 text-center"
                      >
                        Abrir
                      </Link>
                      {v.video_url && (
                        <a
                          href={`${BACKEND_URL}${v.video_url}`}
                          download
                          data-testid={`download-${v.id}`}
                          className="bg-signal hover:bg-signal-hover text-white px-3 py-2 flex items-center justify-center"
                        >
                          <Download size={12} />
                        </a>
                      )}
                      <button onClick={() => handleDelete(v.id)} className="border border-white/20 hover:border-red-500 hover:text-red-500 px-3 py-2">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {v.status === "completed" && (
                      <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 size={10} /> render completo
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

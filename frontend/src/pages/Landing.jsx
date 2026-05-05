import { Link } from "react-router-dom";
import { ArrowRight, Zap, Mic, Image as ImageIcon, Film, Sparkles, Wand2 } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-bgmain text-white grain relative overflow-x-hidden">
      {/* NAV */}
      <nav className="relative z-10 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-signal flex items-center justify-center">
              <span className="font-mono font-bold text-sm">AI</span>
            </div>
            <span className="font-mono text-xs uppercase tracking-[0.25em]">Video Generator / Pro</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#features" className="hidden md:block font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white">Features</a>
            <a href="#pricing" className="hidden md:block font-mono text-xs uppercase tracking-widest text-zinc-400 hover:text-white">Pricing</a>
            <Link
              to="/login"
              data-testid="nav-login-btn"
              className="font-mono text-xs uppercase tracking-widest border border-white/20 hover:border-white/60 hover:bg-white/5 px-4 py-2"
            >
              Login
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-end">
          <div className="lg:col-span-8">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-signal mb-6 flex items-center gap-3">
              <span className="w-2 h-2 bg-signal animate-pulse-signal inline-block"></span>
              v1.0 / live now
            </div>
            <h1 className="font-display text-5xl sm:text-7xl lg:text-[8rem] leading-[0.85] tracking-tighter">
              FROM PROMPT<br/>
              <span className="text-zinc-500">TO REEL</span><br/>
              <span className="text-signal">IN 90s.</span>
            </h1>
            <p className="mt-10 max-w-xl text-zinc-400 text-lg leading-relaxed">
              Genera videos verticales listos para TikTok, Reels y Shorts a partir de un solo prompt.
              Guion viral, voz IA, escenas cinematográficas y subtítulos sincronizados — todo automático.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                to="/login"
                data-testid="hero-cta-btn"
                className="bg-signal hover:bg-signal-hover text-white font-mono text-sm uppercase tracking-widest px-8 py-5 inline-flex items-center justify-center gap-3 transition-colors shadow-[0_0_40px_rgba(255,51,51,0.3)]"
              >
                Crear video con IA <ArrowRight size={16} />
              </Link>
              <a
                href="#features"
                className="border border-white/20 hover:border-white/60 hover:bg-white/5 font-mono text-sm uppercase tracking-widest px-8 py-5 inline-flex items-center justify-center"
              >
                Ver cómo funciona
              </a>
            </div>
          </div>

          <div className="lg:col-span-4 relative">
            <div className="aspect-[9/16] bg-bgpanel border border-white/10 relative overflow-hidden">
              <img
                src="https://images.pexels.com/photos/5563240/pexels-photo-5563240.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
                alt="studio"
                className="w-full h-full object-cover opacity-40"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bgmain via-transparent to-transparent" />
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest bg-signal text-white px-2 py-1">REC</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-white/60">9:16 · 1080p</span>
              </div>
              <div className="absolute bottom-6 left-6 right-6">
                <div className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">Scene 03 / 05</div>
                <div className="font-display text-2xl leading-tight">El error que mantiene tu negocio en pausa</div>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              <span>00:00:18</span>
              <span>00:00:30</span>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="relative z-10 border-y border-white/10 py-6 overflow-hidden bg-bgpanel">
        <div className="marquee-track flex gap-16 whitespace-nowrap font-display text-3xl text-zinc-700">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="flex items-center gap-16">
              GUION VIRAL · VOZ IA · ESCENAS CINEMATOGRÁFICAS · SUBTÍTULOS · 9:16 · 16:9 · 1:1 · TIKTOK · REELS · SHORTS
              <span className="text-signal">▲</span>
            </span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-32">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-20">
          <div className="md:col-span-4">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500 mb-4">/ 01 — pipeline</div>
            <h2 className="font-display text-5xl leading-none">Un prompt.<br/>Cinco pasos.<br/><span className="text-signal">Cero edición.</span></h2>
          </div>
          <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/10">
            {[
              { icon: Wand2, label: "Guion IA", desc: "Gemini 2.5 Flash genera gancho, desarrollo y CTA en tu estilo" },
              { icon: Mic, label: "Voz en off", desc: "OpenAI TTS con 9 voces, ES/EN, naturales y broadcast-ready" },
              { icon: ImageIcon, label: "Escenas IA", desc: "GPT Image 1 produce visuales cinematográficos por escena" },
              { icon: Film, label: "Render automático", desc: "FFmpeg compone audio + video + subtítulos en MP4 9:16" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="bg-bgpanel p-8">
                <Icon className="text-signal mb-4" size={28} strokeWidth={1.5} />
                <div className="font-mono text-xs uppercase tracking-widest text-zinc-500 mb-2">{label}</div>
                <p className="text-zinc-300 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Style strip */}
        <div className="border border-white/10 p-12 bg-bgpanel">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500 mb-6">/ 02 — estilos disponibles</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10">
            {[
              { name: "Viral", desc: "TikTok energy" },
              { name: "Educativo", desc: "Explainer" },
              { name: "Corporativo", desc: "B2B clean" },
              { name: "Storytelling", desc: "Cinematic" },
            ].map((s) => (
              <div key={s.name} className="bg-bgpanel p-6">
                <div className="font-display text-3xl mb-1">{s.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING / CREDITS */}
      <section id="pricing" className="relative z-10 max-w-7xl mx-auto px-6 py-32">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10">
          {[
            { name: "Starter", credits: "100", videos: "10 videos", price: "Gratis", featured: false },
            { name: "Creator", credits: "500", videos: "50 videos / mes", price: "$29", featured: true },
            { name: "Studio", credits: "2000", videos: "200 videos / mes", price: "$99", featured: false },
          ].map((p) => (
            <div key={p.name} className={`p-10 ${p.featured ? "bg-signal text-white" : "bg-bgpanel"}`}>
              <div className="font-mono text-xs uppercase tracking-[0.3em] mb-6 opacity-70">{p.name}</div>
              <div className="font-display text-6xl leading-none">{p.price}</div>
              <div className="font-mono text-xs uppercase tracking-widest mt-4 opacity-60">{p.videos}</div>
              <div className="font-mono text-xs uppercase tracking-widest mt-1 opacity-60">{p.credits} créditos</div>
              <Link
                to="/login"
                className={`mt-10 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest px-6 py-3 transition ${
                  p.featured ? "bg-black text-white hover:bg-black/80" : "bg-white text-black hover:bg-zinc-200"
                }`}
              >
                Empezar <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="relative z-10 border-t border-white/10 bg-bgpanel">
        <div className="max-w-7xl mx-auto px-6 py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-8">
            <h3 className="font-display text-5xl lg:text-7xl leading-none">
              Tu próximo<br/>video viral, <span className="text-signal">en 90s.</span>
            </h3>
          </div>
          <div className="lg:col-span-4">
            <Link
              to="/login"
              data-testid="footer-cta-btn"
              className="bg-signal hover:bg-signal-hover text-white font-mono text-sm uppercase tracking-widest px-8 py-5 inline-flex items-center gap-3"
            >
              <Sparkles size={16} /> Generar video <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 py-8 max-w-7xl mx-auto flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          <span>© 2026 AI Video Generator Pro</span>
          <span className="flex items-center gap-2"><Zap size={10} className="text-signal" /> powered by Emergent</span>
        </div>
      </section>
    </div>
  );
}

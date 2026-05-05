import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { loginDev } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const startGoogle = () => {
    const redirect = `${window.location.origin}/profile`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
  };

  const handleDev = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Email requerido");
    setBusy(true);
    try {
      await loginDev(email.trim(), name.trim() || null);
      navigate("/dashboard");
    } catch (err) {
      toast.error("Error de login");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bgmain text-white grid grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden lg:block bg-bgpanel border-r border-white/10 overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1759159347827-de3a54002de7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1OTV8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGdlb21ldHJpYyUyMGRhcmslMjB0ZWNofGVufDB8fHx8MTc3Nzk5NjgxOHww&ixlib=rb-4.1.0&q=85"
          alt="abstract"
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-bgmain/40 to-bgmain" />
        <div className="relative z-10 h-full flex flex-col justify-between p-12">
          <Link to="/" className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-400 hover:text-white inline-flex items-center gap-2">
            <ArrowLeft size={14} /> back to home
          </Link>
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-signal mb-4">/ access</div>
            <h2 className="font-display text-6xl leading-none mb-6">Entra al<br/>command<br/>center.</h2>
            <p className="text-zinc-400 max-w-sm">100 créditos gratis al crear tu cuenta. Sin tarjeta. Sin compromiso.</p>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">v1.0 · 2026 emergent</div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500 mb-3">/ login</div>
          <h1 className="font-display text-5xl mb-12">Inicia sesión.</h1>

          <button
            onClick={startGoogle}
            data-testid="google-login-btn"
            className="w-full bg-white text-black font-mono text-sm uppercase tracking-widest px-6 py-4 hover:bg-zinc-200 transition-colors flex items-center justify-center gap-3 mb-6"
          >
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.32z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continuar con Google
          </button>

          <div className="relative my-6 flex items-center">
            <div className="flex-1 h-px bg-white/10"></div>
            <span className="px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">o usa email demo</span>
            <div className="flex-1 h-px bg-white/10"></div>
          </div>

          <form onSubmit={handleDev} className="space-y-3">
            <input
              type="email"
              required
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="dev-email-input"
              className="w-full bg-black border border-white/20 focus:border-signal focus:ring-1 focus:ring-signal rounded-sm p-3 text-white placeholder-zinc-600"
            />
            <input
              type="text"
              placeholder="nombre (opcional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="dev-name-input"
              className="w-full bg-black border border-white/20 focus:border-signal focus:ring-1 focus:ring-signal rounded-sm p-3 text-white placeholder-zinc-600"
            />
            <button
              type="submit"
              disabled={busy}
              data-testid="dev-login-btn"
              className="w-full bg-signal hover:bg-signal-hover disabled:opacity-50 text-white font-mono text-sm uppercase tracking-widest px-6 py-4 transition-colors flex items-center justify-center gap-3"
            >
              {busy ? "Entrando…" : "Entrar"} <ArrowRight size={14} />
            </button>
          </form>

          <p className="mt-8 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            al continuar aceptas los términos y la política de privacidad.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export default function AuthCallback() {
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash || "";
    const m = hash.match(/session_id=([^&]+)/);
    if (!m) {
      toast.error("No se recibió session_id");
      navigate("/login");
      return;
    }
    login(m[1])
      .then(() => navigate("/dashboard"))
      .catch(() => {
        toast.error("Error iniciando sesión");
        navigate("/login");
      });
  }, [login, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-bgmain text-white">
      <div className="font-mono text-xs uppercase tracking-[0.3em] text-zinc-500 animate-pulse">
        autenticando…
      </div>
    </div>
  );
}

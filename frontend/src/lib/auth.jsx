import React, { createContext, useContext, useEffect, useState } from "react";
import api from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("aivg_token");
    if (!token) { setLoading(false); return; }
    api.get("/auth/me")
      .then((r) => setUser(r.data))
      .catch(() => localStorage.removeItem("aivg_token"))
      .finally(() => setLoading(false));
  }, []);

  const login = async (sessionId) => {
    const r = await api.post("/auth/google", { session_id: sessionId });
    localStorage.setItem("aivg_token", r.data.token);
    setUser(r.data.user);
  };

  const loginDev = async (email, name) => {
    const r = await api.post("/auth/dev", { email, name });
    localStorage.setItem("aivg_token", r.data.token);
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = () => {
    localStorage.removeItem("aivg_token");
    setUser(null);
  };

  const refresh = async () => {
    const r = await api.get("/auth/me");
    setUser(r.data);
  };

  return (
    <AuthCtx.Provider value={{ user, loading, login, loginDev, logout, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);

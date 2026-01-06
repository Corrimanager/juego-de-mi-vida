"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    setLoading(true);
    setMsg(null);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Cuenta creada. Si Supabase pide confirmación por email, revisá tu inbox.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      }
    } catch (e: any) {
      setMsg(e.message ?? "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Game of Life</h1>
        <p className="text-sm opacity-70 mt-1">Entrá para jugar tu progreso.</p>

        <div className="mt-6 space-y-3">
          <input
            className="w-full rounded-xl border p-3"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full rounded-xl border p-3"
            placeholder="Password (mínimo 6)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            className="w-full rounded-xl border p-3 font-medium"
            onClick={handleAuth}
            disabled={loading || !email || password.length < 6}
          >
            {loading ? "Procesando..." : mode === "signup" ? "Crear cuenta" : "Entrar"}
          </button>

          <button
            className="w-full rounded-xl p-2 text-sm underline"
            onClick={() => setMode(mode === "signup" ? "login" : "signup")}
          >
            {mode === "signup" ? "Ya tengo cuenta" : "Quiero crear cuenta"}
          </button>

          {msg && <p className="text-sm mt-2">{msg}</p>}
        </div>
      </div>
    </div>
  );
}

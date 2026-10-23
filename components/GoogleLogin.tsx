"use client";

import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/client";

export function GoogleLogin({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    const client = supabaseBrowser;
    if (!client) {
      setError("Supabase belum dikonfigurasi.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "online",
            prompt: "select_account",
          },
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login Google gagal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`grid gap-2 ${className}`.trim()}>
      <button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        className="btn btn-lime flex items-center justify-center gap-2 py-3.5 text-base"
      >
        {loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <LogIn size={16} aria-hidden />}
        {loading ? "Memproses login..." : "Login dengan Google"}
      </button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

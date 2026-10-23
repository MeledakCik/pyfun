"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, UserRound } from "lucide-react";
import { saveRankName } from "@/lib/rank";

const MAX_NAME = 20;
const CONTROL_RE = /[\p{Cc}\p{Cf}]/gu;

export function CustomNameModal({
  open,
  defaultValue,
  onClose,
  onSaved,
}: {
  open: boolean;
  defaultValue: string;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [value, setValue] = useState(defaultValue || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setValue(defaultValue || "");
  }, [open, defaultValue]);

  const invalid = useMemo(() => {
    const trimmed = value.trim();
    if (!trimmed) return "Nama wajib diisi.";
    if (trimmed.length > MAX_NAME) return `Nama maksimal ${MAX_NAME} karakter.`;
    if (/[<>]/.test(trimmed)) return "Nama tidak boleh mengandung < atau >.";
    if (CONTROL_RE.test(trimmed)) return "Nama tidak boleh mengandung karakter kontrol.";
    return "";
  }, [value]);

  if (!open) return null;

  const handleSubmit = async () => {
    const trimmed = value.trim();
    if (invalid) {
      setError(invalid);
      return;
    }

    setSaving(true);
    setError("");

    try {
      const saved = await saveRankName(trimmed);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan nama custom.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-5 shadow-[0_25px_60px_-32px_rgba(0,0,0,0.9)]">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-lime text-lime-ink">
            <UserRound size={20} aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-dim">Profil</p>
            <h3 className="font-display text-2xl font-bold">Atur nama custom</h3>
          </div>
        </div>

        <label className="block text-sm font-semibold text-dim">Nama tampilan</label>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={MAX_NAME}
          placeholder="Nama panggilanmu"
          className="mt-2 w-full rounded-2xl border border-line bg-raised px-4 py-3 outline-none transition-colors focus:border-lime focus:shadow-[0_0_0_4px_rgba(200,243,34,.12)]"
        />

        <p className="mt-2 text-xs text-dim">1-20 karakter. Tidak boleh ada &lt; &gt; atau karakter kontrol.</p>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-dark px-4 py-2.5">Batal</button>
          <button type="button" onClick={handleSubmit} disabled={saving || !!invalid} className="btn btn-lime px-4 py-2.5">
            {saving ? <Loader2 size={16} className="animate-spin" aria-hidden /> : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

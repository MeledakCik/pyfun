"use client";
import { useRef } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onRun?: () => void;
  onReset?: () => void;
  minLines?: number;
  filename?: string;
};

export function Editor({ value, onChange, onRun, onReset, minLines = 6, filename = "main.py" }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const lines = Math.max(minLines, value.split("\n").length);

  const key = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onRun?.();
      return;
    }
    const el = e.currentTarget;
    if (e.key === "Tab") {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = el;
      onChange(value.slice(0, s) + "    " + value.slice(en));
      requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
    }
    if (e.key === "Enter") {
      // lanjutkan indentasi baris sebelumnya (+4 setelah titik dua)
      e.preventDefault();
      const s = el.selectionStart;
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const cur = value.slice(lineStart, s);
      const indent = cur.match(/^ */)?.[0] ?? "";
      const extra = cur.trimEnd().endsWith(":") ? "    " : "";
      const ins = "\n" + indent + extra;
      onChange(value.slice(0, s) + ins + value.slice(el.selectionEnd));
      requestAnimationFrame(() => el.setSelectionRange(s + ins.length, s + ins.length));
    }
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5" aria-hidden><i className="h-2.5 w-2.5 rounded-full bg-line" /><i className="h-2.5 w-2.5 rounded-full bg-line" /><i className="h-2.5 w-2.5 rounded-full bg-line" /></span>
          <span className="font-mono text-xs text-dim">{filename}</span>
        </div>
        {onReset && (
          <button onClick={onReset} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-dim hover:text-ink">
            <RotateCcw size={13} aria-hidden /> Reset
          </button>
        )}
      </div>
      <div className="flex font-mono text-sm leading-6">
        <div className="select-none py-3 pl-3 pr-2 text-right text-faint" aria-hidden>
          {Array.from({ length: lines }, (_, i) => <div key={i}>{i + 1}</div>)}
        </div>
        <textarea
          ref={ta}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={key}
          rows={lines}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Editor kode Python"
          className="scroll-thin min-w-0 flex-1 resize-none overflow-x-auto bg-transparent py-3 pr-4 text-ink caret-lime outline-none"
        />
      </div>
    </div>
  );
}

export function Output({ text, error, running, idle }: { text: string; error?: string; running?: boolean; idle?: boolean }) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between font-display text-sm font-bold text-dim">
        <span>Output</span>
        <span className="rounded-full bg-raised px-2.5 py-0.5 text-xs">{running ? "berjalan" : error ? "error" : idle ? "siap" : "selesai"}</span>
      </div>
      <pre className="scroll-thin max-h-56 min-h-16 overflow-auto rounded-2xl bg-sunk p-4 font-mono text-sm leading-6" aria-live="polite">
        {running ? (
          <span className="flex items-center gap-2 text-dim"><Loader2 size={14} className="animate-spin" aria-hidden />Menjalankan… (pertama kali butuh beberapa detik untuk memuat Python)</span>
        ) : idle ? (
          <span className="text-faint">Menunggu kode dijalankan…</span>
        ) : (
          <>
            {text}
            {error && <span className="text-danger">{error}</span>}
            {!text && !error && <span className="text-faint">(tidak ada output)</span>}
          </>
        )}
      </pre>
    </div>
  );
}

export function RunButton({ onClick, busy, label = "Jalankan" }: { onClick: () => void; busy?: boolean; label?: string }) {
  return (
    <button onClick={onClick} disabled={busy} className="btn btn-dark">
      <Play size={16} aria-hidden fill="currentColor" /> {label}
    </button>
  );
}

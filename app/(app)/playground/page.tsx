"use client";
import { useEffect, useState } from "react";
import { Editor, Output, RunButton } from "@/components/Editor";
import { actions, useGame } from "@/lib/store";
import { runPython, warmUp, type RunResult } from "@/lib/python";

const SNIPPETS: Record<string, string> = {
  "Halo": 'nama = "PyFun"\nprint("Halo,", nama)\n',
  "Loop": "for i in range(1, 6):\n    print(i, \"x 3 =\", i * 3)\n",
  "Fungsi": "def kuadrat(n):\n    return n * n\n\nprint(kuadrat(9))\n",
  "List": 'buah = ["apel", "jeruk", "mangga"]\nfor b in buah:\n    print(b.upper())\n',
};

export default function Playground() {
  const { g } = useGame();
  const [res, setRes] = useState<RunResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => warmUp(), []);

  const run = async () => {
    setBusy(true);
    setRes(await runPython(g.code));
    setBusy(false);
  };

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-3xl font-bold">Code playground</h1>
        <p className="mt-1 text-dim">Tulis Python bebas. Kodemu tersimpan otomatis di perangkat ini.</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Contoh kode">
        {Object.entries(SNIPPETS).map(([k, v]) => (
          <button key={k} onClick={() => actions.saveCode(v)} className="rounded-full bg-raised px-4 py-2 font-mono text-sm text-lime hover:bg-line">{k}</button>
        ))}
      </div>
      <Editor value={g.code} onChange={actions.saveCode} onRun={run} onReset={() => { actions.saveCode(""); setRes(null); }} minLines={10} />
      <div className="flex items-center gap-3">
        <button onClick={run} disabled={busy} className="btn btn-lime flex-1 py-4 text-lg">Jalankan kode</button>
        <span className="hidden text-xs text-faint sm:block">Ctrl/⌘ + Enter</span>
      </div>
      <Output text={res?.out ?? ""} error={res?.error} running={busy} idle={!res} />
      <p className="text-xs text-faint">Catatan: <code className="font-mono">input()</code> belum didukung. Gunakan variabel biasa.</p>
    </div>
  );
}

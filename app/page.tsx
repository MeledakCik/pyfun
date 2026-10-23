"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Flame, Terminal, Wand2, Zap } from "lucide-react";
import { Logo } from "@/components/ui";
import { actions, useGame } from "@/lib/store";

const PERKS = [
	{ Icon: Terminal, t: "Kode langsung jalan", d: "Python dijalankan di browser, tanpa install." },
	{ Icon: Flame, t: "XP dan lencana", d: "Quest pendek yang mudah diikuti." },
	{ Icon: Wand2, t: "Materi bonus", d: "Materi AI pilihan tersimpan & siap dimainkan." },
];

export default function Landing() {
	const router = useRouter();
	const { g, ready } = useGame();
	const [name, setName] = useState("");
	const who = g.name || name.trim() || "Pelajar";

	const go = () => {
		const finalName = g.name || name.trim() || "Pelajar";
		if (!g.name) actions.start(finalName);

		router.push("/quest");
	};

	return (
		<main className="mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-12">
			{/* Kolom kiri: teks + form */}
			<div className="grid gap-8">
				<div className="flex items-center gap-3">
					<Logo size={34} />
					<span className="badge">Learn to code</span>
				</div>

				<div className="game-panel rounded-[2rem] p-5 sm:p-6">
					<div className="flex flex-wrap items-center gap-2">
						<span className="badge">Quest 1</span>
						<span className="rounded-full border border-line bg-raised px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-dim">
							Python
						</span>
					</div>
					<h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-5xl xl:text-6xl">
						Belajar Python,<br />level demi level.
					</h1>
					<p className="mt-4 max-w-md text-lg text-dim">
						Selesaikan quest singkat, kumpulkan XP, dan buka lencana. Cukup 5 menit sehari.
					</p>
				</div>

				{ready && (
					<div className="grid max-w-sm gap-3">
						{g.name ? (
							<>
								<p className="text-dim">
									Selamat datang kembali, <b className="text-ink">{g.name}</b>.
								</p>
								<button className="btn btn-lime py-4 text-lg hover-lift" onClick={go}>
									Lanjutkan quest
								</button>
							</>
						) : (
							<>
								<label htmlFor="nama" className="font-display font-bold">Siapa namamu?</label>
								<input id="nama" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()}
									placeholder="Nama panggilan" maxLength={20} autoComplete="nickname"
									className="soft-ring rounded-2xl border border-line bg-surface px-5 py-4 text-lg outline-none transition-colors focus:border-lime focus:shadow-[0_0_0_4px_rgba(200,243,34,.12)]" />
								<button className="btn btn-lime py-4 text-lg hover-lift" onClick={go}>
									Mulai petualangan
								</button>
							</>
						)}
					</div>
				)}

				<ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					{PERKS.map(({ Icon, t, d }) => (
						<li key={t} className="card hover-lift p-4">
							<span className="chip-glow grid h-10 w-10 place-items-center rounded-xl bg-raised text-lime">
								<Icon size={18} aria-hidden />
							</span>
							<p className="mt-3 font-display font-bold">{t}</p>
							<p className="mt-1 text-sm text-dim">{d}</p>
						</li>
					))}
				</ul>
			</div>

			{/* Kolom kanan: preview — hanya tampil di lg ke atas */}
			<div className="relative mx-auto hidden w-full max-w-md lg:block" aria-hidden>
				<div
					className="absolute -inset-10 rounded-[3rem]"
					style={{ background: "radial-gradient(circle at 30% 20%, rgba(200,243,34,0.16), transparent 62%)" }}
				/>
				<div className="float relative overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_30px_60px_-36px_rgba(0,0,0,0.9)]">
					<div className="flex items-center justify-between border-b border-line px-4 py-3">
						<span className="flex gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-line" /><i className="h-2.5 w-2.5 rounded-full bg-line" /><i className="h-2.5 w-2.5 rounded-full bg-line" /></span>
						<span className="font-mono text-xs text-dim">main.py</span>
					</div>
					<pre className="p-5 font-mono text-[15px] leading-7">
						<code>
							<span className="reveal block text-faint" style={{ ["--d" as string]: ".3s" }}># quest 1: halo dunia</span>
							<span className="reveal block" style={{ ["--d" as string]: ".9s" }}>nama = <span className="text-lime">&quot;{who}&quot;</span></span>
							<span className="reveal block" style={{ ["--d" as string]: "1.5s" }}>print(<span className="text-lime">&quot;Halo,&quot;</span>, nama)</span>
						</code>
					</pre>
					<div className="reveal border-t border-line bg-sunk p-5 font-mono text-[15px]" style={{ ["--d" as string]: "2.2s" }}>
						<span className="text-dim">$ </span>Halo, {who}
					</div>
				</div>
				<div className="reveal absolute -top-5 left-6 flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 font-display font-bold text-lime-ink shadow-[0_18px_24px_-18px_rgba(200,243,34,0.9)]" style={{ ["--d" as string]: "2.6s" }}>
					<Zap size={16} aria-hidden />+100 XP
				</div>
				<div className="reveal absolute -bottom-5 -left-3 flex items-center gap-1.5 rounded-full border border-line bg-raised px-4 py-2 font-display font-bold shadow-[0_20px_32px_-24px_rgba(0,0,0,0.9)]" style={{ ["--d" as string]: "3s" }}>
					<Zap size={16} className="text-lime" aria-hidden />XP +100
				</div>
			</div>
		</main>
	);
}

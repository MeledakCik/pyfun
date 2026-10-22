"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Compass, Terminal, Trophy, User } from "lucide-react";
import { actions, useGame } from "@/lib/store";
import { rankOf } from "@/lib/game";
import { Logo, Stats } from "./ui";
import SideRail from "./SideRail";

const NAV = [
  { href: "/quest", label: "Quest", Icon: Compass },
  { href: "/playground", label: "Code", Icon: Terminal },
  { href: "/ranks", label: "Rank", Icon: Trophy },
  { href: "/profile", label: "Profil", Icon: User },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const { g, ready } = useGame();
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (ready && !g.name) router.replace("/");
  }, [ready, g.name, router]);

  useEffect(() => {
    const t = setInterval(actions.tickHearts, 30000);
    return () => clearInterval(t);
  }, []);

  if (!ready || !g.name) return <div className="min-h-dvh" />;
  const rank = rankOf(g.xp);

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl">
      {/* Sidebar kiri — tampil di md ke atas */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-line p-5 md:flex">
        <Link href="/quest" className="mb-6 px-3"><Logo size={30} /></Link>
        {NAV.map(({ href, label, Icon }) => {
          const on = path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-display font-bold transition-all ${on ? "bg-lime text-lime-ink shadow-[0_4px_0_var(--color-lime-deep)]" : "text-dim hover:bg-surface hover:text-ink"}`}>
              <Icon size={20} aria-hidden />{label}
            </Link>
          );
        })}
        <Link href="/profile" className="card mt-auto flex items-center gap-3 p-3 hover:border-lime/40">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-lime font-display text-lg font-bold text-lime-ink">{g.name[0].toUpperCase()}</span>
          <span className="min-w-0"><b className="block truncate font-display">{g.name}</b><span className="text-xs" style={{ color: rank.color }}>{rank.name}</span></span>
        </Link>
      </aside>

      {/* Konten utama */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-bg/60 px-5 py-3.5 backdrop-blur-md md:justify-end">
          <Link href="/quest" className="md:hidden"><Logo /></Link>
          <Stats streak={g.streak} xp={g.xp} hearts={g.hearts} />
        </header>
        {/* pb-24 mobile agar tidak tertutup bottom nav (64px nav + spacing) */}
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-4 sm:px-5 md:pb-12">{children}</main>
      </div>

      <SideRail />

      {/* Bottom nav — hanya mobile (hidden md:) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-bg/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)", paddingTop: "0.5rem" }}
        aria-label="Navigasi utama"
      >
        {NAV.map(({ href, label, Icon }) => {
          const on = path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-2xl py-1 text-[11px] font-bold ${on ? "text-lime" : "text-dim"}`}>
              <span className={`grid h-9 w-12 place-items-center rounded-full transition-colors ${on ? "bg-lime/15" : ""}`}><Icon size={20} aria-hidden /></span>
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

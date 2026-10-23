"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Compass, LogOut, Terminal, Trophy, User } from "lucide-react";
import { useGame } from "@/lib/store";
import { rankOf } from "@/lib/game";
import { Logo, Stats } from "./ui";
import SideRail from "./SideRail";
import { GoogleLogin } from "@/components/GoogleLogin";
import { CustomNameModal } from "@/components/CustomNameModal";
import { supabaseBrowser } from "@/lib/supabase/client";

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
  const [sessionUser, setSessionUser] = useState<{ id: string } | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [customNameOpen, setCustomNameOpen] = useState(false);

  useEffect(() => {
    if (ready && !g.name) router.replace("/");
  }, [ready, g.name, router]);

  useEffect(() => {
    const client = supabaseBrowser;
    if (!client) return;

    const syncSession = async () => {
      const { data: { session }, error } = await client.auth.getSession();
      if (error) {
        setSessionUser(null);
        setDisplayName(null);
        return;
      }
      const user = session?.user ?? null;
      setSessionUser(user ? { id: user.id } : null);
      if (!user) {
        setDisplayName(null);
        return;
      }
      try {
        const response = await fetch("/api/ranks", { cache: "no-store" });
        const payload = await response.json().catch(() => null);
        const nextName = typeof payload?.custom_name === "string" ? payload.custom_name : null;
        setDisplayName(nextName || g.name || null);
      } catch {
        setDisplayName(g.name || null);
      }
    };

    void syncSession();
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user ? { id: session.user.id } : null);
      if (!session?.user) {
        setDisplayName(null);
        return;
      }
      void fetch("/api/ranks", { cache: "no-store" })
        .then(async (response) => {
          const payload = await response.json().catch(() => null);
          setDisplayName(typeof payload?.custom_name === "string" ? payload.custom_name : g.name || null);
        })
        .catch(() => setDisplayName(g.name || null));
    });

    return () => subscription.unsubscribe();
  }, [g.name]);

  const handleLogout = async () => {
    const client = supabaseBrowser;
    if (client) {
      await client.auth.signOut();
    }
    setSessionUser(null);
    setDisplayName(null);
  };

  if (!ready || !g.name) return <div className="min-h-dvh" />;
  const rank = rankOf(g.xp);
  const headerLabel = displayName || g.name;

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-3 border-r border-line p-5 md:flex">
        <Link href="/quest" className="mb-4 px-3"><Logo size={30} /></Link>

        <div className="game-panel rounded-2xl p-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-dim">Status</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div>
              <p className="font-display text-lg font-bold leading-none">{g.xp}</p>
              <p className="text-[11px] text-dim">XP total</p>
            </div>
            <span className="badge">Lv {rank.name}</span>
          </div>
        </div>

        {NAV.map(({ href, label, Icon }) => {
          const on = path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className={`hover-lift flex items-center gap-3 rounded-2xl px-4 py-3 font-display font-bold transition-all ${on ? "bg-lime text-lime-ink shadow-[0_5px_0_rgba(138,165,22,0.9)]" : "text-dim hover:bg-surface hover:text-ink"}`}>
              <span className={`grid h-8 w-8 place-items-center rounded-xl ${on ? "bg-lime-ink/10" : "bg-raised"}`}><Icon size={18} aria-hidden /> </span>
              {label}
            </Link>
          );
        })}
        <Link href="/profile" className="card hover-lift mt-auto flex items-center gap-3 p-3 hover:border-lime/40">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-lime font-display text-lg font-bold text-lime-ink">{(headerLabel ?? "?")[0].toUpperCase()}</span>
          <span className="min-w-0"><b className="block truncate font-display">{headerLabel}</b><span className="text-xs" style={{ color: rank.color }}>{rank.name}</span></span>
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/95 px-5 py-3.5 shadow-[0_1px_0_rgba(255,255,255,0.02)] md:justify-end">
          <Link href="/quest" className="md:hidden"><Logo /></Link>
          <div className="ml-auto flex items-center gap-3">
            <Stats streak={g.streak} xp={g.xp} />
            {!sessionUser ? (
              <GoogleLogin className="w-auto" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="hidden text-sm font-semibold text-ink sm:inline">Halo, {headerLabel}</span>
                <button type="button" onClick={() => setCustomNameOpen(true)} className="btn btn-dark px-3 py-2 text-xs">Ganti Nama</button>
                <button type="button" onClick={handleLogout} className="btn btn-dark px-3 py-2 text-xs"><LogOut size={14} aria-hidden /> Logout</button>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-4 sm:px-5 md:pb-12">{children}</main>
      </div>

      <SideRail />

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-bg shadow-[0_-12px_28px_-22px_rgba(0,0,0,0.95)] md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)", paddingTop: "0.5rem" }}
        aria-label="Navigasi utama"
      >
        {NAV.map(({ href, label, Icon }) => {
          const on = path.startsWith(href);
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-2xl py-1 text-[11px] font-bold ${on ? "text-lime" : "text-dim"}`}>
              <span className={`grid h-9 w-12 place-items-center rounded-full transition-colors ${on ? "bg-lime/15" : "bg-transparent"}`}><Icon size={20} aria-hidden /></span>
              {label}
            </Link>
          );
        })}
      </nav>

      <CustomNameModal
        open={customNameOpen}
        defaultValue={displayName || g.name}
        onClose={() => setCustomNameOpen(false)}
        onSaved={(name) => {
          setDisplayName(name);
          setCustomNameOpen(false);
        }}
      />
    </div>
  );
}

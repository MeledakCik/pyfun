"use client";
import {
  BookOpen, Braces, Calculator, Check, Flame, Footprints, GitBranch, Heart, List,
  Lock, Package, Repeat, Skull, Sparkles, Terminal, Wand2, Zap, Code2, Database, Globe, Type,
  type LucideProps,
} from "lucide-react";
import type { ComponentType } from "react";

const ICONS: Record<string, ComponentType<LucideProps>> = {
  BookOpen, Braces, Calculator, Check, Flame, Footprints, GitBranch, Heart, List, Lock,
  Package, Repeat, Skull, Sparkles, Terminal, Wand2, Zap, Code2, Database, Globe, Type,
};
export const ICON_NAMES = ["Terminal", "Package", "Calculator", "GitBranch", "Repeat", "List", "BookOpen", "Braces", "Code2", "Database", "Globe", "Type", "Sparkles"];

export function Icon({ name, ...p }: { name: string } & LucideProps) {
  const C = ICONS[name] ?? Sparkles;
  return <C {...p} />;
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="font-display font-bold text-lime tracking-tight" style={{ fontSize: size }}>
      PyFun
    </span>
  );
}

export function Bar({ value, className = "" }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-3 w-full overflow-hidden rounded-full bg-raised ${className}`} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-lime transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1.5 font-display text-sm font-bold ${className}`}>
      {children}
    </span>
  );
}

export function Stats({ streak, xp, hearts }: { streak: number; xp: number; hearts: number }) {
  return (
    <div className="flex items-center gap-2">
      <Chip><Flame size={16} className="text-lime" aria-hidden />{streak}</Chip>
      <Chip><Zap size={16} className="text-lime" aria-hidden />{xp}</Chip>
      <Chip className={hearts === 0 ? "text-danger" : ""}><Heart size={16} className="text-danger" fill="currentColor" aria-hidden />{hearts}</Chip>
    </div>
  );
}

export function Ring({ value, size = 96, stroke = 10, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-raised)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-lime)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

const COLORS = ["#c8f322", "#63f7ff", "#e0b6ff", "#ffffff", "#ff6b5e"];
export function Confetti({ count = 42 }: { count?: number }) {
  return (
    <div aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} className="confetti" style={{
          left: `${(i * 97) % 100}%`, background: COLORS[i % COLORS.length],
          ["--x" as string]: `${((i * 53) % 120) - 60}px`, ["--r" as string]: `${360 + ((i * 71) % 540)}deg`,
          ["--d" as string]: `${(i % 9) * 0.08}s`, ["--t" as string]: `${2.2 + ((i * 13) % 14) / 10}s`,
        }} />
      ))}
    </div>
  );
}

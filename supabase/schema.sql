-- PyFun — materi inti + bonus (disinkronkan admin lewat /api/admin/sync)
--
-- Jalankan seluruh blok ini DI DASHBOARD SUPABASE (SQL Editor) sebelum app
-- bisa menampilkan section "Materi Bonus" di halaman /quest.
--
-- Catatan: tabel `lessons` versi lama (skema `content` jsonb) TIDAK dipakai
-- oleh app ini dan sengaja dibiarkan apa adanya. Materi baru memakai tabel
-- terpisah `pyfun_lessons` supaya tidak menimpa data lama.

create table if not exists public.pyfun_lessons (
  id         text primary key,
  chapter    text        not null default 'Materi Bonus',
  title      text        not null,
  icon       text        not null default 'Sparkles',
  xp         integer     not null default 120,
  minutes    integer     not null default 5,
  boss       boolean     not null default false,
  steps      jsonb       not null,
  source     text        not null default 'supabase',
  -- `core` = salinan materi inti, `bonus` = materi bonus.
  kind       text        not null default 'bonus',
  -- Jalur belajar untuk pengurutan materi bonus.
  track      text        not null default 'Fondasi Bonus',
  -- Urutan di dalam jalur.
  sort_order integer     not null default 0,
  level      text        not null default 'pemula',
  created_at timestamptz not null default now()
);

-- Migrasi untuk tabel yang sudah dibuat sebelum kolom baru ada.
alter table public.pyfun_lessons
  add column if not exists kind text not null default 'bonus',
  add column if not exists track text not null default 'Fondasi Bonus',
  add column if not exists sort_order integer not null default 0,
  add column if not exists level text not null default 'pemula';

alter table public.pyfun_lessons drop constraint if exists pyfun_lessons_kind_check;
alter table public.pyfun_lessons
  add constraint pyfun_lessons_kind_check check (kind in ('core', 'bonus'));

-- RLS: semua orang boleh baca, hanya service_role yang boleh tulis.
alter table public.pyfun_lessons enable row level security;

drop policy if exists "Public read" on public.pyfun_lessons;
create policy "Public read" on public.pyfun_lessons for select using (true);

-- Defense in depth: anon/authenticated hanya boleh SELECT.
-- service_role (dipakai route admin di server) tetap bisa menulis.
revoke insert, update, delete, truncate, references, trigger
  on public.pyfun_lessons from anon, authenticated;
grant select on public.pyfun_lessons to anon, authenticated;

-- Urutan kronologis + urutan jalur materi bonus.
create index if not exists pyfun_lessons_created_at_idx on public.pyfun_lessons (created_at);
create index if not exists pyfun_lessons_kind_track_order_idx
  on public.pyfun_lessons (kind, track, sort_order);

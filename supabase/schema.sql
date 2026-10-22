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

-- ============================================================
-- Kuota harian AI untuk endpoint publik /api/lessons/generate
-- ============================================================
-- Satu baris per hari + scope:
--   scope = 'global', subject = 'all'  → kuota seluruh pengguna
--   scope = 'ip',     subject = <hash> → kuota per hash IP
create table if not exists public.pyfun_ai_daily_usage (
  day        date        not null,
  scope      text        not null check (scope in ('ip', 'global')),
  subject    text        not null,
  count      integer     not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (day, scope, subject)
);

alter table public.pyfun_ai_daily_usage enable row level security;

-- Tidak ada policy: anon/authenticated tidak boleh membaca atau menulis.
-- Hanya service_role (dipakai route server) yang boleh mengakses tabel ini.
revoke all on public.pyfun_ai_daily_usage from public, anon, authenticated;
grant select, insert, update, delete on public.pyfun_ai_daily_usage to service_role;

-- Konsumsi kuota secara atomik. Dipanggil dari server dengan service role.
create or replace function public.consume_pyfun_ai_quota(
  p_ip_hash text,
  p_ip_limit integer default 10,
  p_global_limit integer default 100
)
returns table (
  allowed boolean,
  reason text,
  remaining integer,
  retry_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
  v_next_day timestamptz;
  v_retry integer;
  v_ip_limit integer := coalesce(p_ip_limit, 10);
  v_global_limit integer := coalesce(p_global_limit, 100);
  v_global_count integer;
  v_ip_count integer;
begin
  if p_ip_hash is null or length(p_ip_hash) < 16 then
    return query select false, 'invalid'::text, 0, 1;
    return;
  end if;

  if v_ip_limit < 1 then v_ip_limit := 10; end if;
  if v_global_limit < 1 then v_global_limit := 100; end if;

  v_day := (timezone('utc', now()))::date;
  v_next_day := ((v_day + 1)::timestamp at time zone 'UTC');
  v_retry := greatest(1, ceil(extract(epoch from (v_next_day - now())))::integer);

  -- Kunci baris global lebih dulu, lalu baris IP, agar hitungan tetap
  -- atomik saat ada request bersamaan.
  insert into public.pyfun_ai_daily_usage (day, scope, subject, count)
  values (v_day, 'global', 'all', 0)
  on conflict (day, scope, subject) do nothing;

  perform 1
  from public.pyfun_ai_daily_usage
  where day = v_day and scope = 'global' and subject = 'all'
  for update;

  select u.count into v_global_count
  from public.pyfun_ai_daily_usage u
  where u.day = v_day and u.scope = 'global' and u.subject = 'all';

  if v_global_count >= v_global_limit then
    return query select false, 'global'::text, 0, v_retry;
    return;
  end if;

  insert into public.pyfun_ai_daily_usage (day, scope, subject, count)
  values (v_day, 'ip', p_ip_hash, 0)
  on conflict (day, scope, subject) do nothing;

  perform 1
  from public.pyfun_ai_daily_usage
  where day = v_day and scope = 'ip' and subject = p_ip_hash
  for update;

  select u.count into v_ip_count
  from public.pyfun_ai_daily_usage u
  where u.day = v_day and u.scope = 'ip' and u.subject = p_ip_hash;

  if v_ip_count >= v_ip_limit then
    return query select false, 'ip'::text, 0, v_retry;
    return;
  end if;

  update public.pyfun_ai_daily_usage
  set count = count + 1, updated_at = now()
  where day = v_day and scope = 'global' and subject = 'all';

  update public.pyfun_ai_daily_usage
  set count = count + 1, updated_at = now()
  where day = v_day and scope = 'ip' and subject = p_ip_hash;

  return query
    select true, 'ok'::text, greatest(0, v_ip_limit - (v_ip_count + 1)), v_retry;
end;
$$;

revoke all on function public.consume_pyfun_ai_quota(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_pyfun_ai_quota(text, integer, integer)
  to service_role;

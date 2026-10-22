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

-- ============================================================
-- Papan peringkat global (rank)
-- ============================================================
-- Data peserta dibuat dari pemain asli yang menyelesaikan materi resmi.
-- Jangan mengisi tabel ini dengan data dummy/NPC. Skor dihitung dari
-- penyelesaian materi resmi di server, bukan dari XP kiriman client.
--
-- Tabel tidak bisa dibaca/ditulis langsung oleh anon/authenticated.
-- Semua akses lewat /api/ranks memakai service_role di server.

create table if not exists public.pyfun_rank_players (
  player_id   uuid primary key,
  name        text not null check (
    name = btrim(name)
    and char_length(name) between 1 and 20
    and name !~ '[<>]'
    and name !~ '[[:cntrl:]]'
  ),
  secret_hash text not null check (secret_hash ~ '^[a-f0-9]{64}$'),
  xp          integer not null default 0 check (xp >= 0 and xp <= 10000000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.pyfun_rank_completions (
  player_id    uuid not null references public.pyfun_rank_players(player_id) on delete cascade,
  lesson_id    text not null check (lesson_id ~ '^[A-Za-z0-9_-]{1,80}$'),
  xp           integer not null check (xp > 0 and xp <= 2000),
  completed_at timestamptz not null default now(),
  primary key (player_id, lesson_id)
);

alter table public.pyfun_rank_players enable row level security;
alter table public.pyfun_rank_completions enable row level security;

-- Defense in depth: tidak ada policy publik. Hanya service_role yang boleh akses.
revoke all on public.pyfun_rank_players from public, anon, authenticated;
revoke all on public.pyfun_rank_completions from public, anon, authenticated;
grant select, insert, update, delete on public.pyfun_rank_players to service_role;
grant select, insert, update, delete on public.pyfun_rank_completions to service_role;

create index if not exists pyfun_rank_players_xp_idx
  on public.pyfun_rank_players (xp desc, updated_at asc);

-- Papan peringkat: top N + baris pemain saat ini (walau di luar top N).
drop function if exists public.pyfun_rank_board(uuid, integer);
create or replace function public.pyfun_rank_board(
  p_player_id uuid default null,
  p_limit integer default 50
)
returns table (
  player_id uuid,
  name text,
  xp integer,
  rank_position bigint,
  total bigint,
  is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      r.player_id,
      r.name,
      r.xp,
      row_number() over (
        order by r.xp desc, r.updated_at asc, r.player_id asc
      ) as rank_position,
      count(*) over () as total
    from public.pyfun_rank_players r
  )
  select
    ranked.player_id,
    ranked.name,
    ranked.xp,
    ranked.rank_position,
    ranked.total,
    (p_player_id is not null and ranked.player_id = p_player_id) as is_me
  from ranked
  where ranked.rank_position <= greatest(1, least(coalesce(p_limit, 50), 100))
     or (p_player_id is not null and ranked.player_id = p_player_id)
  order by ranked.rank_position;
$$;

revoke all on function public.pyfun_rank_board(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.pyfun_rank_board(uuid, integer)
  to service_role;

-- Daftarkan/rename pemain lalu catat penyelesaian materi.
-- p_lessons = [{"id": "print", "xp": 100}, ...] dari route server setelah
-- id divalidasi terhadap katalog materi; client tidak pernah mengirim XP.
-- p_create = true hanya saat ada penyelesaian materi resmi, supaya papan
-- peringkat tidak dipenuhi baris 0 XP dari sekadar membuka halaman.
drop function if exists public.pyfun_rank_sync(uuid, text, text, jsonb);
drop function if exists public.pyfun_rank_sync(uuid, text, text, jsonb, boolean);
create or replace function public.pyfun_rank_sync(
  p_player_id uuid,
  p_secret_hash text,
  p_name text,
  p_lessons jsonb default '[]'::jsonb,
  p_create boolean default false
)
returns table (
  ok boolean,
  reason text,
  xp integer,
  gained integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_xp integer;
  v_gained integer := 0;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if p_player_id is null then
    return query select false, 'invalid_player'::text, 0, 0;
    return;
  end if;

  if p_secret_hash is null or p_secret_hash !~ '^[a-f0-9]{64}$' then
    return query select false, 'invalid_secret'::text, 0, 0;
    return;
  end if;

  if char_length(v_name) < 1
     or char_length(v_name) > 20
     or v_name ~ '[<>]'
     or v_name ~ '[[:cntrl:]]' then
    return query select false, 'invalid_name'::text, 0, 0;
    return;
  end if;

  if p_lessons is null or jsonb_typeof(p_lessons) <> 'array' then
    return query select false, 'invalid_lessons'::text, 0, 0;
    return;
  end if;

  if jsonb_array_length(p_lessons) > 300 then
    return query select false, 'invalid_lessons'::text, 0, 0;
    return;
  end if;

  -- SELECT FOR UPDATE + INSERT ... ON CONFLICT membuat pendaftaran aman
  -- walau ada dua request bersamaan dengan player_id yang sama.
  select r.secret_hash, r.xp
    into v_hash, v_xp
  from public.pyfun_rank_players r
  where r.player_id = p_player_id
  for update;

  if not found then
    -- Rename/registrasi tanpa penyelesaian materi tidak membuat baris baru.
    if not coalesce(p_create, false) then
      return query select true, 'not_registered'::text, 0, 0;
      return;
    end if;

    insert into public.pyfun_rank_players (player_id, name, secret_hash, xp)
    values (p_player_id, v_name, p_secret_hash, 0)
    on conflict (player_id) do nothing;

    select r.secret_hash, r.xp
      into v_hash, v_xp
    from public.pyfun_rank_players r
    where r.player_id = p_player_id
    for update;

    if not found then
      return query select false, 'invalid_player'::text, 0, 0;
      return;
    end if;
  end if;

  if v_hash <> p_secret_hash then
    return query select false, 'invalid_secret'::text, 0, 0;
    return;
  end if;

  update public.pyfun_rank_players
  set name = v_name, updated_at = now()
  where player_id = p_player_id and name <> v_name;

  with raw as (
    select
      item->>'id' as lesson_id,
      case
        when (item->>'xp') ~ '^[0-9]{1,5}$' then (item->>'xp')::integer
        else 0
      end as xp
    from jsonb_array_elements(p_lessons) item
  ), input as (
    select distinct on (lesson_id) lesson_id, xp
    from raw
    where lesson_id ~ '^[A-Za-z0-9_-]{1,80}$'
      and xp between 1 and 2000
    order by lesson_id
  ), inserted as (
    insert into public.pyfun_rank_completions (player_id, lesson_id, xp)
    select p_player_id, input.lesson_id, input.xp
    from input
    on conflict (player_id, lesson_id) do nothing
    returning xp
  )
  select coalesce(sum(inserted.xp), 0)
    into v_gained
  from inserted;

  if v_gained > 0 then
    update public.pyfun_rank_players
    set xp = least(xp + v_gained, 10000000), updated_at = now()
    where player_id = p_player_id
    returning xp into v_xp;
  else
    select r.xp
      into v_xp
    from public.pyfun_rank_players r
    where r.player_id = p_player_id;
  end if;

  return query select true, 'ok'::text, v_xp, v_gained;
end;
$$;

revoke all on function public.pyfun_rank_sync(uuid, text, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.pyfun_rank_sync(uuid, text, text, jsonb, boolean)
  to service_role;

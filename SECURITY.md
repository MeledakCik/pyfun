# Checklist keamanan PyFun

Dokumen ini merangkum proteksi kredensial dan data. Jalankan ulang checklist ini
setiap kali menambah endpoint, mengubah schema, atau deploy.

## 1. Rahasia tidak pernah masuk client

| Variabel | Boleh di browser? | Catatan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ya | URL project, memang publik |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya | dibatasi RLS; hanya `SELECT` |
| `SUPABASE_SERVICE_ROLE_KEY` | **tidak** | hanya `lib/supabase-admin.ts` (`server-only`) |
| `GROQ_API_KEY` | **tidak** | hanya `lib/ai.ts` (`server-only`) |
| `ADMIN_SEED_SECRET` | **tidak** | header `x-admin-secret`, hanya server |

Aturan:

- Jangan membuat variabel `NEXT_PUBLIC_*` untuk service role, Groq, atau admin
  secret.
- Jangan menaruh token di URL, query string, atau log.
- Jangan commit `.env`; hanya `.env.example` yang boleh masuk repo.
- Jika rahasia bocor: rotasi semua key terkait, lalu redeploy.

## 2. Akun & data pemain

PyFun **tidak menyimpan password atau kredensial akun**. Yang disimpan hanya:

- nama tampilan,
- progres quest, XP, streak, lencana,
- isi playground.

Semuanya berada di `localStorage` browser (`pyfun:v1`). Karena itu:

- jangan meminta password pengguna di aplikasi ini,
- jangan menambahkan token pihak ketiga ke `localStorage` tanpa kebutuhan jelas,
- jika nanti ditambah login, gunakan Supabase Auth (bukan menyimpan password
  sendiri) dan aktifkan RLS berbasis `auth.uid()`.

Papan peringkat **hanya untuk akun Google** (Supabase Auth). `/api/ranks` mengambil
identitas dari cookie sesi yang diverifikasi server (`auth.getUser()`); `POST`
tanpa sesi ditolak 401 dan tidak ada baris yang dibuat untuk tamu. XP rank tidak
pernah dikirim client—server menghitungnya dari ID materi resmi, dan satu materi
hanya dihitung sekali per akun (primary key `(player_id, lesson_id)`).

## 3. Database

Untuk tabel materi `pyfun_lessons`, `supabase/schema.sql` melakukan:

- `enable row level security`,
- policy `SELECT` publik,
- `revoke insert, update, delete, truncate, references, trigger` dari
  `anon` dan `authenticated`,
- `grant select` saja.

Artinya browser hanya bisa membaca materi. Semua penulisan materi harus lewat
route server dengan service role.

Tabel rank (`pyfun_rank_players`, `pyfun_rank_completions`) lebih ketat:

- RLS aktif **tanpa policy publik**,
- `revoke all` dari `public`, `anon`, dan `authenticated`,
- hanya `service_role` yang boleh baca/tulis,
- fungsi `pyfun_rank_board` hanya boleh dieksekusi `service_role` dan hanya
  mengembalikan baris dengan `auth_user_id`.

Jangan menambahkan seed data dummy/NPC ke tabel rank. Baris rank hanya dibuat
saat pemain asli menyelesaikan materi resmi.

## 4. Endpoint admin

`/api/admin/sync`, `/api/admin/seed`, dan `/api/generate`:

- membandingkan `x-admin-secret` dengan `timingSafeEqual`,
- menolak secret kosong/terlalu pendek (fail-closed),
- memakai rate limit per IP,
- membatasi ukuran body,
- tidak mengembalikan detail rahasia di pesan error.

`/api/admin/sync` tidak memakai Groq, jadi bisa dipakai untuk menyimpan materi
tanpa biaya AI.

Endpoint publik `/api/lessons/docs` tidak menerima URL dari client. Halaman
hanya diambil dari whitelist `docs.python.org/id/3/` dan `docs.python.org/3/`,
dengan batas ukuran body dan rate limit per IP.

### Papan peringkat `/api/ranks`

- `GET` hanya mengembalikan nama, XP, posisi, dan total; tidak pernah
  mengembalikan secret/hash.
- `POST` wajib sesi Google, lalu memvalidasi nama 1–20 karakter dan maksimal 50
  ID materi per request. playerId/secret/authUserId dari body diabaikan.
- Client **tidak boleh** mengirim XP. Route mencari XP dari `BUNDLED` dan
  materi bonus resmi, lalu mengabaikan ID materi buatan sendiri/tidak dikenal.
- Tabel completion memakai primary key `(player_id, lesson_id)`, jadi kiriman
  ulang tidak menambah XP rank.
- Rate limit per IP, batas body 64 KB, dan tidak ada penulisan langsung dari
  browser ke tabel rank.

## 5. Header & browser

`next.config.ts` mengatur:

- Content-Security-Policy (Pyodide dari jsDelivr, Supabase, worker blob),
- HSTS di production,
- `X-Frame-Options: DENY`,
- `X-Content-Type-Options: nosniff`,
- Referrer-Policy dan Permissions-Policy,
- `poweredByHeader: false`.

## 6. Verifikasi sebelum deploy

```bash
npm run lint
npm run build
```

Setelah deploy:

```bash
curl -i -X POST https://<domain>/api/admin/sync \
  -H "content-type: application/json" \
  -d '{"mode":"all"}'
# harus 401, bukan 200/500
```

Terakhir, cek bahwa di bundle browser tidak ada string service role atau Groq
key. Jangan pernah menempelkan nilai asli rahasia ke issue, chat, atau screenshot.

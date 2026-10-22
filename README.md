# PyFun

Belajar Python lewat quest, XP, streak, dan boss. Satu app Next.js, tanpa backend terpisah.

## Jalankan

```bash
npm install
npm run dev      # http://localhost:3000
```

## Cara kerja

- **Progres** (XP, streak, lencana, kode playground) disimpan di `localStorage` browser. Ekspor/impor JSON ada di halaman Profil.
- **Percobaan tak terbatas**: jawaban salah tidak mengunci quest. Gunakan **Petunjuk 1**, **Petunjuk 2**, lalu **Lihat solusi**; setiap jawaban salah disertai penjelasan.
- **Materi inti** (5 bab, 25 quest) ada di `lib/lessons.ts` dan ikut di-bundle: Dasar Python, Struktur & Fungsi, String & Koleksi, Fungsi & Modul, Error & OOP. Quest mendukung langkah belajar, kuis, prediksi output, latihan kode, dan debug dengan test case.
- **Materi bonus** berisi 15 materi terkurasi di `lib/bonus.ts` (Automasi & File, Web Scraping & Data, Analisis & Permodelan, Machine Learning Dasar, Keamanan & Deployment). Materi bonus lama yang sudah ada di Supabase tetap dipertahankan sebagai jalur **Fondasi Bonus**, sehingga totalnya biasanya 25 materi.
- **Supabase** menyimpan salinan semua materi (inti + bonus) di `pyfun_lessons`. Katalog lokal tetap menjadi fallback offline/awal, lalu baris Supabase menimpa katalog jika tersedia.
- **Python** dijalankan di browser dengan Pyodide (Web Worker, otomatis berhenti jika loop tak berujung). Butuh internet saat pertama kali memuat.

## Struktur

```
app/
  page.tsx              landing + input nama
  (app)/                halaman dengan navigasi: quest, playground, rank, profile
  create/               redirect ke /quest
  play/[id]/            pemain quest (layar penuh)
  api/admin/sync/       simpan materi inti + katalog bonus ke Supabase
  api/admin/seed/       tambah materi bonus via AI/Groq (opsional)
  api/generate/         generate satu materi (butuh x-admin-secret)
  api/lessons/docs/     materi bacaan dari dokumentasi resmi Python (tanpa AI)
  api/lessons/generate/ draft materi AI untuk user (kuota Supabase, tanpa tulis materi)
  api/lessons/suggest/  lima saran topik dari daftar id materi selesai
components/             Shell, Editor, Rich, ui
lib/
  lessons.ts            materi inti + merge materi bonus dari Supabase/katalog
  bonus.ts              15 materi bonus terkurasi + urutan jalur
  supabase.ts           client Supabase publik (anon, hanya baca)
  supabase-admin.ts     client service role khusus server
  ai.ts                 generate materi via Groq (server-only)
  store.ts              state + localStorage
  game.ts               XP, level, rank, lencana
  python.ts             runner Pyodide
supabase/schema.sql     DDL + migrasi + RLS tabel pyfun_lessons
docs/seed-materi.md     cara sync materi & checklist keamanan
```

## Menyimpan materi ke Supabase

1. Jalankan `supabase/schema.sql` di **Supabase Dashboard → SQL Editor**. Skrip ini aman dijalankan ulang dan menambahkan kolom `kind`, `track`, `sort_order`, `level` bila tabel sudah ada.
2. Isi `SUPABASE_SERVICE_ROLE_KEY` dan `ADMIN_SEED_SECRET` di `.env` (lihat `.env.example`).
3. Sinkronkan semua materi (tanpa Groq):

```bash
curl -X POST http://localhost:3000/api/admin/sync \
  -H "content-type: application/json" \
  -H "x-admin-secret: $ADMIN_SEED_SECRET" \
  -d '{"mode":"all"}'
```

Materi inti tetap dibundel sebagai fallback, tetapi salinannya juga tersimpan di Supabase dengan `kind = 'core'`. Materi bonus memakai `kind = 'bonus'`, `track`, dan `sort_order` agar tampil berurutan per jalur.

Mau menambah materi AI? Jalankan `/api/admin/seed` setelah sync. Detail lengkap ada di `docs/seed-materi.md`.

## Endpoint materi publik

- `POST /api/lessons/docs` menerima `{ "topic": "...", "level": "pemula" }`. Endpoint ini mengambil halaman tutorial dari `docs.python.org/id/3/` (fallback ke versi Inggris), menyusun langkah `learn`, dan menyertakan tautan sumber. Tidak memakai AI atau kuota. Jika dokumentasi tidak bisa diakses, endpoint tetap mengembalikan ringkasan + tautan sumber dengan status 200 agar UI tidak menampilkan error AI.
- `POST /api/lessons/generate` menerima `{ "topic": "...", "level": "pemula" }`. Topik dibatasi 3-80 karakter, divalidasi sebagai topik Python lewat satu panggilan Groq singkat, lalu dibuatkan draft. Draft **tidak** disimpan ke `pyfun_lessons`. Untuk perbaikan, client bisa menambahkan `repair: { attempt, errors, lesson }`; draft lama disanitasi ulang sebelum masuk prompt. Maksimal dua repair dari UI. Endpoint ini sekarang menjadi cadangan jika `/api/lessons/docs` gagal.
- Kuota memakai tabel `pyfun_ai_daily_usage`: 10 generate per hash IP per hari dan batas global harian (default 100, bisa diatur lewat `AI_GLOBAL_DAILY_LIMIT`). Jalankan `supabase/schema.sql` agar tabel dan fungsi kuota tersedia.
- `POST /api/lessons/suggest` menerima `{ "completedIds": ["print", "..."] }` dan mengembalikan `{ "topics": [ ...5 topik... ] }` berdasarkan katalog lokal, tanpa panggilan AI.
- Kode hasil AI yang memuat `os`, `subprocess`, `socket`, `urllib`, `open`, `eval`, `exec`, atau `__import__` ditolak sebelum dikirim ke client.

## Menambah materi

- Materi inti: edit `lib/lessons.ts`; quest memakai langkah `learn`, `quiz`, `predict`, `code`, dan `debug`.
- Materi bonus: edit `lib/bonus.ts`; tambahkan `track` dan `sortOrder`, lalu jalankan `/api/admin/sync` agar tersimpan di Supabase.
- Kode latihan sebaiknya hanya memakai **standard library Python** supaya berjalan di Pyodide tanpa dependency tambahan.

Halaman `/quest` mendukung unit yang bisa dilipat, navigator bab horizontal, batas 6 materi per unit dengan tombol "tampilkan lagi", serta pencarian dan pengelompokan materi bonus per jalur. Bagian "Buat materi sendiri" mengambil materi dari dokumentasi resmi Python dan menyimpannya ke unit "Materi Saya" di localStorage. Jika AI dipakai sebagai cadangan, setiap `solution` tetap dijalankan di Pyodide sebelum draft disimpan.

## Deploy ke Vercel

1. Push ke GitHub, lalu *Add New Project* di Vercel dan pilih repo ini (preset Next.js terdeteksi otomatis).
2. Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (wajib)
   - `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_SEED_SECRET` (wajib, hanya server)
   - `GROQ_API_KEY` (opsional, hanya untuk seed AI)
3. Deploy, lalu jalankan sync ke domain produksi:

```bash
curl -X POST https://<domain>/api/admin/sync \
  -H "content-type: application/json" \
  -H "x-admin-secret: $ADMIN_SEED_SECRET" \
  -d '{"mode":"all"}'
```

## Checklist keamanan sebelum publik

Detail lengkap ada di `SECURITY.md`. Ringkasnya:

- **Jangan commit `.env`.** `.gitignore` sudah menutup `.env`, `.env.*` (kecuali `.env.example`), `.next`, dan `.cache`.
- **`ADMIN_SEED_SECRET` minimal 24 karakter acak** (disarankan 32 byte):
  `openssl rand -hex 32`. Endpoint admin memakai perbandingan waktu konstan,
  rate limit per IP, dan batas ukuran body.
- **Jalankan `supabase/schema.sql`** (termasuk blok `revoke ... from anon, authenticated`).
  RLS hanya mengizinkan `SELECT` untuk anon; tulis hanya lewat service role di server.
- **Service role key hanya untuk server.** Jangan pernah memberi prefix `NEXT_PUBLIC_`;
  modul tulisnya (`lib/supabase-admin.ts`) memakai `server-only`.
- **Tidak ada kredensial akun yang disimpan.** Aplikasi tidak menyimpan password;
  nama dan progres hanya ada di `localStorage` browser.
- **Security headers** diatur di `next.config.ts` (CSP, HSTS, anti-clickjacking,
  `nosniff`, Permissions-Policy). `poweredByHeader` dimatikan.
- **Rate limit** di `/api/admin/sync`, `/api/admin/seed`, dan `/api/generate`
  bersifat per-instance (memori). Di Vercel ini lapisan tambahan; autentikasi
  tetap bergantung pada secret kuat.
- **Rotasi kunci** kalau `.env` pernah terlanjur ter-commit atau terkirim:
  ganti `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, dan `ADMIN_SEED_SECRET`,
  lalu redeploy.
- Jalankan `npm audit` secara berkala. Proyek ini sudah di-upgrade ke Next.js
  yang menutup advisory lama.

Verifikasi cepat setelah deploy:

```bash
curl -i -X POST https://<domain>/api/admin/sync -H "content-type: application/json" -d '{"mode":"all"}'
# harus 401 Unauthorized (bukan 200 / 500)
```

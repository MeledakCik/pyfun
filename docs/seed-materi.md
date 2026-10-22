# Menyimpan materi inti + bonus di Supabase

PyFun punya dua lapisan materi:

1. **Materi inti** — 5 bab / 25 quest di `lib/lessons.ts`, tetap dibundel agar
   app bisa dibuka dan dipakai sebagai fallback offline.
2. **Materi bonus terkurasi** — 15 materi di `lib/bonus.ts`, dibagi ke 5 jalur:
   Automasi & File, Web Scraping & Data, Analisis & Permodelan, Machine Learning
   Dasar, dan Keamanan & Deployment. Katalog ini juga menjadi fallback sebelum
   Supabase diisi.

Keduanya disalin ke tabel `public.pyfun_lessons` lewat endpoint admin
`/api/admin/sync`. Materi bonus lama yang sudah ada di tabel tetap dipertahankan
dan otomatis masuk jalur **Fondasi Bonus**.

## 1. Siapkan tabel

Buka **Supabase Dashboard → SQL Editor**, lalu jalankan seluruh isi
`supabase/schema.sql`. Skrip ini:

- membuat tabel `public.pyfun_lessons` (aman dijalankan ulang),
- menambahkan kolom `kind`, `track`, `sort_order`, dan `level` untuk tabel lama,
- mengaktifkan RLS dan hanya memberi `SELECT` ke anon/authenticated,
- membuat index urutan materi.

> Tabel `lessons` versi lama (kolom `content` jsonb) tidak dipakai app ini.

## 2. Isi environment

Tambahkan ke `.env` lokal dan **Vercel → Settings → Environment Variables**:

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ya | URL project Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ya | anon key; hanya untuk SELECT |
| `SUPABASE_SERVICE_ROLE_KEY` | ya | service role; **hanya server** |
| `ADMIN_SEED_SECRET` | ya | string acak minimal 24 karakter, mis. `openssl rand -hex 32` |
| `GROQ_API_KEY` | tidak | hanya jika ingin generate materi AI tambahan |
| `GROQ_MODEL` | tidak | default `llama-3.3-70b-versatile` |

> Jangan pernah memberi prefix `NEXT_PUBLIC_` pada service role, Groq key, atau
> admin secret. Hanya variabel yang memang publik (URL dan anon key) yang boleh
> memakai prefix itu.

## 3. Sinkronkan semua materi (tanpa Groq)

Jalankan server dev (`npm run dev`), lalu panggil endpoint sync:

```bash
curl -X POST http://localhost:3000/api/admin/sync \
  -H "content-type: application/json" \
  -H "x-admin-secret: $ADMIN_SEED_SECRET" \
  -d '{"mode":"all"}'
```

`mode` yang tersedia:

- `all` — materi inti + katalog bonus (default),
- `core` — hanya 25 materi inti,
- `bonus` — hanya katalog bonus terkurasi.

Balasan contoh:

```json
{
  "ok": true,
  "mode": "all",
  "core": 25,
  "bonus": 15,
  "synced": 40,
  "message": "Materi inti + bonus tersimpan di Supabase. Materi inti tetap memakai bundel lokal sebagai fallback."
}
```

Endpoint ini memakai `upsert` berdasarkan `id`, jadi aman dijalankan berulang:
baris yang sama diperbarui, bukan diduplikasi.

> Jika muncul error `Could not find the 'kind' column`, berarti migrasi kolom
> baru belum dijalankan. Buka SQL Editor, jalankan ulang `supabase/schema.sql`,
> lalu panggil sync lagi.

## 4. Tambah materi AI (opsional)

`/api/admin/seed` masih tersedia untuk menambah materi bonus baru dengan Groq.
Jalankan **setelah** sync katalog. Endpoint ini hanya menghitung baris
`kind = 'bonus'`, sehingga salinan materi inti tidak menghabiskan kuota.

```bash
curl -X POST http://localhost:3000/api/admin/seed \
  -H "content-type: application/json" \
  -H "x-admin-secret: $ADMIN_SEED_SECRET" \
  -d '{"topics":["Dasar argparse","Logging Python"],"level":"menengah","track":"Automasi & File"}'
```

Tanpa `topics`, endpoint memakai daftar preset topik lanjutan (argparse,
logging, dataclass, context manager, generator, decorator, SQLite, unittest,
async, dan pipeline CSV/JSON). `track` menentukan jalur pengurutan; jika tidak
diisi, materi masuk ke **Fondasi Bonus**.

## 5. Verifikasi

- Buka `/quest` → unit **Materi Bonus** di akhir alur.
- Materi tampil berurutan per jalur dan bernomor lanjut antar-jalur.
- Cari kata seperti `scraping`, `regresi`, atau `rate limit` di kotak pencarian.
- Klik satu materi → `/play/<id>` berjalan normal.
- Jalankan `npm run lint` dan `npm run build` sebelum deploy.

## Keamanan kredensial

Detail lengkap ada di `SECURITY.md`. Ringkasnya:

- **Tidak ada password/akun yang disimpan app.** Nama tampilan, progres, XP, dan
  kode playground hanya ada di `localStorage` browser.
- **Service role hanya di server.** `lib/supabase-admin.ts` memakai
  `server-only`; route admin memakai header `x-admin-secret` dengan
  perbandingan waktu konstan.
- **RLS + revoke.** Anon hanya boleh `SELECT`; tulis hanya lewat service role.
- **Rate limit + batas body** ada di `/api/admin/sync`, `/api/admin/seed`, dan
  `/api/generate`.
- **Jangan commit `.env`.** `.gitignore` sudah menutup `.env` dan `.env.*`
  (kecuali `.env.example`).
- Jika secret pernah bocor: rotasi `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`,
  dan `ADMIN_SEED_SECRET`, lalu redeploy.

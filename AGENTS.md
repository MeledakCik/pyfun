# AGENTS.md — PyFun

## Aturan wajib

- **Jawab dalam Bahasa Indonesia** untuk semua penjelasan ke user. Kode, nama file, dan identifier tetap apa adanya.
- **Kode latihan hanya memakai standard library Python.** Jangan menambah `pip`, `requests`, `pandas`, `numpy`, atau asumsi paket pihak ketiga; Pyodide tidak memasang dependency.
- **Jangan pernah membaca atau mengubah `.env`**, termasuk untuk debugging. Gunakan `.env.example`, `README.md`, atau `SECURITY.md` untuk referensi nama variabel. Jangan mencetak atau menyalin secret.
- Setelah mengubah kode, jalankan `npm run lint`. Untuk perubahan route, API, atau build, jalankan juga `npm run build`.

## Stack & perintah

Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4, Supabase, dan Pyodide 0.26.4. Tidak ada backend terpisah; state user disimpan di `localStorage` dengan key `pyfun:v1`, sedangkan Python berjalan di Web Worker. Butuh Node.js >= 20.9.

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # tsc --noEmit, bukan ESLint
npm run build
npm start
```

Tidak ada script test. `lint` adalah typecheck; jangan mengarang `npm test`.

## Struktur

- `app/page.tsx` — landing dan input nama.
- `app/(app)/` — halaman dengan navigasi: `quest`, `playground`, `ranks`, `profile`.
- `app/play/[id]/page.tsx` — pemain quest layar penuh; menangani quiz, prediksi output, eksekusi kode, debug dengan test case, petunjuk bertingkat, dan XP.
- `app/api/admin/` — `sync` untuk menyimpan materi ke Supabase dan `seed` untuk materi AI opsional; `app/api/generate/` untuk generate satu materi. Endpoint admin memakai header `x-admin-secret`.
- `app/api/lessons/` — endpoint publik: `generate` membuat draft AI dengan kuota harian Supabase, `suggest` mengembalikan lima topik dari katalog. `generate` menerima `repair` opsional untuk draft yang gagal dites dan tidak menulis ke `pyfun_lessons`.
- `components/` — `Shell`, `Editor`, `Rich`, `QuestTrack`, `GenerateLesson`, `ui`.
- `lib/lessons.ts` — 25 quest inti (`BUNDLED`), materi buatan user, dan penggabungan materi Supabase; `lib/bonus.ts` — 15 materi bonus terkurasi dan urutan track; `lib/types.ts` — schema materi.
- `lib/store.ts` — state localStorage termasuk `generated`; `lib/python.ts` — runner Pyodide dan validasi solusi; `lib/supabase*.ts` — client publik/admin; `lib/admin-auth.ts` dan `lib/rate-limit.ts` — keamanan endpoint.
- `supabase/schema.sql` — DDL, migrasi, dan RLS; `docs/seed-materi.md` — alur sync; `SECURITY.md` — checklist keamanan.

## Format materi

`Lesson` berisi `{ id, chapter, title, icon, xp, minutes, boss?, steps, source, track?, level?, sortOrder? }`. `icon` adalah nama ikon lucide. `steps` berisi:

```ts
type Step =
  | { type: "learn"; title: string; body: string; code?: string }
  | {
      type: "quiz";
      q: string;
      options: string[];
      answer: number;
      explain: string;
      wrong?: string[];
    }
  | {
      type: "code";
      prompt: string;
      starter: string;
      out?: string;
      has?: string[];
      need?: string[];
      chips?: string[];
      hint?: string;
      hint2?: string;
      solution?: string;
    }
  | {
      type: "predict";
      prompt: string;
      code: string;
      hint?: string;
      hint2?: string;
      explain?: string;
    }
  | {
      type: "debug";
      prompt: string;
      starter: string;
      tests: { label?: string; code: string; expected: string }[];
      hint?: string;
      hint2?: string;
      solution?: string;
    };
```

- `learn.body`: paragraf dipisah baris kosong; teks di dalam backtick menjadi inline code. `code` hanya contoh, bukan kode yang dijalankan.
- `quiz.answer`: indeks opsi berbasis 0.
- `code.out`: stdout harus sama persis setelah `trim()`. `has`: stdout harus memuat semua substring. `need`: semua regex harus cocok dengan source user. Ketiganya bisa digabung.
- `starter` adalah isi awal editor dan target tombol reset. `solution` mengganti seluruh isi editor setelah Petunjuk 1 dan Petunjuk 2, jadi harus berupa skrip lengkap dan bisa dijalankan sendiri, termasuk import/setup.
- `hint` = Petunjuk 1, `hint2` = Petunjuk 2. Jika `hint2` kosong, UI menyusun petunjuk kedua dari `chips` atau strategi umum; materi baru sebaiknya mengisi keduanya.
- `quiz.wrong[pick]` adalah alasan opsional untuk opsi salah; jika kosong, UI memakai `quiz.explain` dan menampilkan jawaban yang benar.
- `predict.code` adalah kode contoh yang ditampilkan. Saat diperiksa, kode dijalankan di Pyodide dan output aslinya dibandingkan dengan tebakan user setelah `trim()`. `predict.explain` ditampilkan setelah pemeriksaan.
- `debug.starter` adalah kode awal yang masih bug. Setiap item `debug.tests` dijalankan sebagai `kode user + "\n\n" + test.code`; stdout harus sama dengan `test.expected` setelah `trim()`. Semua test harus lulus. `label` dipakai untuk menampilkan nama test.
- Pemeriksaan `out`/`has`/`need` hanya dilakukan setelah kode berhasil dijalankan. Percobaan tak terbatas; error sintaks/runtime dan output salah tidak mengunci langkah. Alasan kegagalan harus spesifik (pola, output yang diharapkan, atau teks yang hilang).
- Latihan harus non-interaktif dan hanya dinilai dari stdout. Jangan mengandalkan `input()` atau file eksternal yang tidak dibuat oleh skrip itu sendiri.

Materi inti diedit di `lib/lessons.ts` lewat helper `learn`/`quiz`/`predict`/`code`/`debug`. Materi bonus diedit di `lib/bonus.ts` lewat `mkTrack`, wajib punya `track` dan `sortOrder`.

## Data & Supabase

- `BUNDLED` tetap menjadi fallback offline. Jangan memindahkan materi inti hanya ke Supabase.
- `fetchSupabaseLessons()` memakai `BONUS_CATALOG` sebagai fallback, lalu baris Supabase menimpa katalog berdasarkan `id`. Baris `kind = 'core'` atau `source = 'bundled'` tidak ditampilkan sebagai bonus. Cache berlaku 30 detik.
- `/quest` mengurutkan bonus menurut `BONUS_TRACKS` lalu `sortOrder`; materi lama tanpa track masuk ke `Fondasi Bonus`. Unit "Materi Saya" membaca `generated` dari localStorage; draft AI baru disimpan setelah semua `solution` lolos uji Pyodide, dengan maksimal dua permintaan perbaikan.
- Jalankan `supabase/schema.sql` sebelum `POST /api/admin/sync` dengan body `{"mode":"all"}`. Tanpa kolom `kind`, `track`, `sort_order`, dan `level`, sync akan gagal.
- `SUPABASE_SERVICE_ROLE_KEY` hanya untuk server. Jangan pernah memberi prefix `NEXT_PUBLIC_`; RLS hanya mengizinkan `SELECT` untuk anon.
- Schema state sekarang `v: 2`; data lama `v: 1` (termasuk `hearts`/`heartsAt`) dimigrasikan di `load()` dan `importJson()`. XP, streak, lencana, progres, dan kode playground dipertahankan. Materi AI disimpan lokal di `generated` dengan `source: "generated"`, tidak pernah ditulis ke Supabase, dan dibatasi 50 materi. Jangan menyimpan password atau kredensial di localStorage.
- `/api/lessons/generate` memakai kuota atomik di tabel `pyfun_ai_daily_usage` (10/hash IP/hari + batas global, default 100/hari). Setiap permintaan `repair` juga melewati kuota yang sama. Hanya service role yang boleh mengakses tabel/fungsi kuota. `AI_RATE_LIMIT_SALT` opsional; fallback ke `ADMIN_SEED_SECRET`.

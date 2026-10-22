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
- progres quest, XP, streak, nyawa, lencana,
- isi playground.

Semuanya berada di `localStorage` browser (`pyfun:v1`). Karena itu:

- jangan meminta password pengguna di aplikasi ini,
- jangan menambahkan token pihak ketiga ke `localStorage` tanpa kebutuhan jelas,
- jika nanti ditambah login, gunakan Supabase Auth (bukan menyimpan password
  sendiri) dan aktifkan RLS berbasis `auth.uid()`.

## 3. Database

`supabase/schema.sql` melakukan:

- `enable row level security`,
- policy `SELECT` publik,
- `revoke insert, update, delete, truncate, references, trigger` dari
  `anon` dan `authenticated`,
- `grant select` saja.

Artinya browser hanya bisa membaca. Semua penulisan harus lewat route server
dengan service role.

## 4. Endpoint admin

`/api/admin/sync`, `/api/admin/seed`, dan `/api/generate`:

- membandingkan `x-admin-secret` dengan `timingSafeEqual`,
- menolak secret kosong/terlalu pendek (fail-closed),
- memakai rate limit per IP,
- membatasi ukuran body,
- tidak mengembalikan detail rahasia di pesan error.

`/api/admin/sync` tidak memakai Groq, jadi bisa dipakai untuk menyimpan materi
tanpa biaya AI.

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

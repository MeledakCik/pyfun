import type { CodeStep, Lesson, LearnStep, QuizStep } from "./types";

const learn = (title: string, body: string, code?: string): LearnStep => ({ type: "learn", title, body, code });
const quiz = (q: string, options: string[], answer: number, explain: string): QuizStep => ({
  type: "quiz", q, options, answer, explain,
});
const code = (
  prompt: string,
  starter: string,
  check: { out?: string; has?: string[]; need?: string[] },
  extra: { chips?: string[]; hint?: string; solution?: string } = {},
): CodeStep => ({ type: "code", prompt, starter, ...check, ...extra });

/**
 * Urutan jalur materi bonus. Materi lama yang belum punya track masuk ke
 * "Fondasi Bonus", lalu materi terkurasi tampil setelahnya.
 */
export const BONUS_TRACKS = [
  "Fondasi Bonus",
  "Automasi & File",
  "Web Scraping & Data",
  "Analisis & Permodelan",
  "Machine Learning Dasar",
  "Keamanan & Deployment",
] as const;

export type BonusTrack = (typeof BONUS_TRACKS)[number];

const TRACK_RANK = new Map<string, number>(BONUS_TRACKS.map((track, i) => [track, i]));
const UNKNOWN_TRACK = BONUS_TRACKS.length;

type Def = Omit<Lesson, "chapter" | "source" | "track" | "sortOrder"> & {
  sortOrder: number;
};

const mkTrack = (track: BonusTrack, defs: Def[]): Lesson[] =>
  defs.map((d) => ({ ...d, chapter: "Materi Bonus", track, source: "catalog" as const }));

const automasi = mkTrack("Automasi & File", [
  {
    id: "bo-auto-path", title: "Path & file", icon: "Package", xp: 180, minutes: 6, level: "menengah", sortOrder: 1,
    steps: [
      learn("Path lintas sistem operasi", "`pathlib.Path` membuat path yang aman di Windows, macOS, maupun Linux. `.name`, `.suffix`, dan `.stem` membedah nama file.", `from pathlib import Path

p = Path("/data/laporan.csv")
print(p.name)
print(p.suffix)
print(p.stem)`),
      learn("Menggabungkan path", "Gunakan operator `/` untuk menyambung folder dan file. `.with_suffix()` mengganti ekstensi tanpa mengubah nama dasarnya.", `from pathlib import Path

folder = Path("/data")
file = folder / "hasil.txt"
print(file)
print(file.with_suffix(".json"))`),
      quiz('Hasil dari Path("data/nilai.csv").stem adalah…', ["data", "nilai", "nilai.csv", ".csv"], 1, "`stem` adalah nama file tanpa ekstensi."),
      code("Print nama file, ekstensi, dan nama tanpa ekstensi dari path /latihan/laporan.csv.", 'from pathlib import Path\n\np = Path("/latihan/laporan.csv")\n', {
        out: "laporan.csv\n.csv\nlaporan", need: ["\\.name", "\\.suffix", "\\.stem"],
      }, {
        chips: ["p.name", "p.suffix", "p.stem"], hint: "Pakai tiga atribut Path: name, suffix, dan stem.",
        solution: 'from pathlib import Path\n\np = Path("/latihan/laporan.csv")\nprint(p.name)\nprint(p.suffix)\nprint(p.stem)',
      }),
    ],
  },
  {
    id: "bo-auto-file", title: "Baca & tulis file", icon: "BookOpen", xp: 190, minutes: 6, level: "menengah", sortOrder: 2,
    steps: [
      learn("Mode file", "`open(path, mode)` membuka file. Mode `w` menimpa, `a` menambah, dan `r` membaca. Selalu pakai `with` agar file otomatis ditutup.", `with open("catatan.txt", "w", encoding="utf-8") as f:
    f.write("baris 1\\nbaris 2\\n")

with open("catatan.txt", encoding="utf-8") as f:
    print(f.read())`),
      learn("Membaca per baris", "`readlines()` mengambil semua baris. Gunakan `.strip()` untuk membuang spasi atau newline di ujung teks.", `from io import StringIO

data = StringIO("apel\\njeruk\\nmangga\\n")
print(data.readline().strip())
print(data.readlines())`),
      quiz("Mode file mana yang menimpa isi lama?", ["r", "a", "w", "x"], 2, "Mode `w` membuka file untuk ditulis dan menimpa isi sebelumnya."),
      code("Baca seluruh baris dari `data`, print jumlah baris, lalu print baris pertama tanpa newline.", `from io import StringIO

data = StringIO("apel\\njeruk\\nmangga\\n")
`, { out: "3\napel", need: ["readlines", "strip"] }, {
        chips: ["data.readlines()", "len(baris)", "baris[0].strip()"], hint: "Simpan hasil readlines() ke variabel baris.",
        solution: 'from io import StringIO\n\ndata = StringIO("apel\\njeruk\\nmangga\\n")\nbaris = data.readlines()\nprint(len(baris))\nprint(baris[0].strip())',
      }),
    ],
  },
  {
    id: "bo-auto-regex", title: "Pola nama & regex", icon: "Repeat", xp: 200, minutes: 7, level: "menengah", sortOrder: 3,
    steps: [
      learn("Regex dasar", "`re.findall()` mengambil semua pola yang cocok. `re.sub()` mengganti bagian teks yang cocok.", `import re

teks = "file_2024.csv, file_2025.csv"
print(re.findall(r"\\d{4}", teks))
print(re.sub(r"file_", "data_", teks))`),
      learn("Membersihkan nama file", "Ubah nama menjadi huruf kecil, ganti karakter selain huruf/angka dengan tanda hubung, lalu buang tanda hubung di ujung.", `import re

nama = "Laporan Bulanan 2025.pdf"
slug = re.sub(r"[^a-z0-9]+", "-", nama.lower()).strip("-")
print(slug)`),
      quiz('Hasil re.findall(r"\\d+", "a12b345") adalah…', ["['12', '345']", "['a12', 'b345']", "12", "['12345']"], 0, "`\\d+` mengambil satu atau lebih digit."),
      code("Ubah nama file 'Data Nilai 2025.csv' menjadi slug huruf kecil dengan tanda hubung, tanpa ekstensi.", 'import re\nfrom pathlib import Path\n\nnama = "Data Nilai 2025.csv"\n', {
        out: "data-nilai-2025", need: ["re\\.sub", "Path"],
      }, {
        chips: ["Path(nama).stem", ".lower()", 're.sub(r"[^a-z0-9]+", "-", ...)'],
        hint: "Ambil stem dengan Path, lowercase, lalu re.sub karakter non-alfanumerik menjadi '-'.",
        solution: 'import re\nfrom pathlib import Path\n\nnama = "Data Nilai 2025.csv"\nstem = Path(nama).stem\nprint(re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-"))',
      }),
    ],
  },
]);

const scraping = mkTrack("Web Scraping & Data", [
  {
    id: "bo-scrape-link", title: "Ambil link HTML", icon: "Globe", xp: 220, minutes: 7, level: "menengah", sortOrder: 1,
    steps: [
      learn("HTML adalah teks", "Scraping dimulai dengan memahami struktur HTML. Untuk latihan, kita bisa mengambil atribut dengan regex.", `import re

html = '<a href="/materi/python">Python</a> <a href="/materi/data">Data</a>'
print(re.findall(r'href="([^"]+)"', html))`),
      learn("Parser HTML", "`html.parser.HTMLParser` membaca tag satu per satu. Cara ini lebih aman daripada regex untuk HTML yang kompleks.", `from html.parser import HTMLParser

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.links.append(dict(attrs).get("href"))

p = LinkParser()
p.feed('<a href="/satu">1</a><a href="/dua">2</a>')
print(p.links)`),
      quiz("Modul standar Python untuk mem-parsing HTML adalah…", ["html.parser", "csv", "sqlite3", "pathlib"], 0, "`html.parser` adalah parser HTML bawaan Python."),
      code("Ambil semua href dari string HTML berikut, lalu print list link-nya.", 'import re\n\nhtml = \'<a href="/python">Python</a><a href="/data">Data</a>\'\n', {
        out: "['/python', '/data']", need: ["re\\.findall"],
      }, {
        chips: ["re.findall", 'r\'href="([^"]+)"\'', "print()"], hint: 'Gunakan re.findall(r\'href="([^"]+)"\', html).',
        solution: `import re

html = '<a href="/python">Python</a><a href="/data">Data</a>'
print(re.findall(r'href="([^"]+)"', html))`,
      }),
    ],
  },
  {
    id: "bo-scrape-json", title: "Rapikan data JSON", icon: "Database", xp: 230, minutes: 7, level: "menengah", sortOrder: 2,
    steps: [
      learn("JSON", "`json.loads()` mengubah teks JSON menjadi dictionary/list Python. `json.dumps()` melakukan sebaliknya.", `import json

data = '{"nama": "Rani", "nilai": [80, 90]}'
obj = json.loads(data)
print(obj["nama"])
print(obj["nilai"][1])
print(json.dumps(obj, ensure_ascii=False))`),
      learn("Menyimpan CSV", "`csv.DictWriter` menulis data terstruktur. `StringIO` berguna untuk latihan tanpa membuat file sungguhan.", `import csv
from io import StringIO

buf = StringIO()
writer = csv.DictWriter(buf, fieldnames=["nama", "nilai"])
writer.writeheader()
writer.writerow({"nama": "Rani", "nilai": 90})
print(buf.getvalue().strip())`),
      quiz("json.loads() mengubah teks JSON menjadi…", ["string", "dictionary/list Python", "file CSV", "HTML"], 1, "JSON object menjadi dict, JSON array menjadi list."),
      code("Ambil data JSON di bawah, lalu print total nilai.", 'import json\n\ndata = \'{"nama": "Rani", "nilai": [80, 90]}\'\n', {
        out: "170", need: ["json\\.loads", "sum"],
      }, {
        chips: ["json.loads(data)", 'obj["nilai"]', "sum()"], hint: "Ubah data dengan json.loads, lalu jumlahkan obj['nilai'].",
        solution: `import json

data = '{"nama": "Rani", "nilai": [80, 90]}'
obj = json.loads(data)
print(sum(obj["nilai"]))`,
      }),
    ],
  },
  {
    id: "bo-scrape-etika", title: "Etika & robots.txt", icon: "Globe", xp: 240, minutes: 7, level: "menengah", sortOrder: 3,
    steps: [
      learn("Scraping yang bertanggung jawab", "Sebelum mengambil data: cek `robots.txt`, hormati aturan situs, jangan membebani server, dan jangan mengambil data pribadi tanpa izin.", `robots = """
User-agent: *
Disallow: /admin
Disallow: /private
Allow: /materi
"""

for baris in robots.splitlines():
    if baris.startswith("Disallow:"):
        print(baris.split(":", 1)[1].strip())`),
      quiz("Sebelum scraping, aturan situs yang perlu dicek adalah…", ["robots.txt", "warna tombol", "ukuran RAM", "nama domain"], 0, "`robots.txt` memberi tahu halaman yang boleh/tidak boleh diakses bot."),
      code("Ambil semua jalur Disallow dari teks robots, lalu print satu per satu secara urut.", `robots = """
User-agent: *
Disallow: /admin
Disallow: /private
Allow: /materi
"""
`, { out: "/admin\n/private", need: ["startswith", "sorted"] }, {
        chips: ['baris.startswith("Disallow:")', 'split(":", 1)', "sorted()"], hint: "Kumpulkan jalur Disallow, urutkan, lalu gabungkan dengan newline.",
        solution: `robots = """
User-agent: *
Disallow: /admin
Disallow: /private
Allow: /materi
"""

jalur = [b.split(":", 1)[1].strip() for b in robots.splitlines() if b.startswith("Disallow:")]
print("\\n".join(sorted(jalur)))`,
      }),
    ],
  },
]);

const modeling = mkTrack("Analisis & Permodelan", [
  {
    id: "bo-model-stat", title: "Statistik deskriptif", icon: "Calculator", xp: 230, minutes: 7, level: "menengah", sortOrder: 1,
    steps: [
      learn("Mean, median, modus", "`statistics` menyediakan ukuran pemusatan. Mean = rata-rata, median = nilai tengah, modus = nilai paling sering.", `import statistics

data = [70, 80, 80, 90, 100]
print(statistics.mean(data))
print(statistics.median(data))
print(statistics.mode(data))`),
      learn("Sebaran data", "`min`, `max`, dan `statistics.stdev` membantu melihat rentang serta variasi data.", `import statistics

data = [70, 80, 80, 90, 100]
print(min(data), max(data))
print(round(statistics.stdev(data), 2))`),
      quiz("Median dari [1, 3, 5, 7] adalah…", ["3", "4.0", "5", "7"], 1, "Median adalah rata-rata dua nilai tengah: (3 + 5) / 2 = 4.0."),
      code("Print mean dan median dari data [60, 70, 80, 90, 100].", "import statistics\n\ndata = [60, 70, 80, 90, 100]\n", {
        out: "80.0\n80", need: ["statistics\\.mean", "statistics\\.median"],
      }, {
        chips: ["statistics.mean(data)", "statistics.median(data)", "float()"], hint: "Cetak float(statistics.mean(data)), lalu statistics.median(data).",
        solution: "import statistics\n\ndata = [60, 70, 80, 90, 100]\nprint(float(statistics.mean(data)))\nprint(statistics.median(data))",
      }),
    ],
  },
  {
    id: "bo-model-regression", title: "Regresi linear", icon: "Calculator", xp: 250, minutes: 8, level: "menengah", sortOrder: 2,
    steps: [
      learn("Garis regresi", "Regresi linear mencari garis `y = a + bx`. Slope `b` mengukur perubahan y untuk setiap perubahan x.", `xs = [1, 2, 3]
ys = [3, 5, 7]
n = len(xs)
mean_x = sum(xs) / n
mean_y = sum(ys) / n
pembilang = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
penyebut = sum((x - mean_x) ** 2 for x in xs)
b = pembilang / penyebut
a = mean_y - b * mean_x
print(a, b)
print(a + b * 4)`),
      learn("Membaca slope", "Slope positif berarti nilai y cenderung naik saat x bertambah. Intercept adalah nilai y saat x = 0.", `def prediksi(x, a, b):
    return a + b * x

print(prediksi(10, 1.0, 2.0))`),
      quiz("Slope regresi yang positif menunjukkan…", ["y cenderung turun", "y cenderung naik", "data pasti sempurna", "tidak ada hubungan"], 1, "Slope positif berarti kenaikan x diikuti kecenderungan kenaikan y."),
      code("Dari xs=[1,2,3,4] dan ys=[2,4,6,8], hitung slope b, lalu print b dan prediksi untuk x=5.", "xs = [1, 2, 3, 4]\nys = [2, 4, 6, 8]\n", {
        out: "2.0\n10.0", need: ["sum", "len"],
      }, {
        chips: ["sum(xs) / len(xs)", "pembilang / penyebut", "a + b * 5"], hint: "Hitung mean, pembilang, penyebut, lalu b. Intercept a = mean_y - b * mean_x.",
        solution: "xs = [1, 2, 3, 4]\nys = [2, 4, 6, 8]\nn = len(xs)\nmean_x = sum(xs) / n\nmean_y = sum(ys) / n\npembilang = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))\npenyebut = sum((x - mean_x) ** 2 for x in xs)\nb = pembilang / penyebut\na = mean_y - b * mean_x\nprint(b)\nprint(a + b * 5)",
      }),
    ],
  },
  {
    id: "bo-model-eval", title: "Evaluasi prediksi", icon: "Calculator", xp: 250, minutes: 7, level: "menengah", sortOrder: 3,
    steps: [
      learn("MAE", "Mean Absolute Error mengukur rata-rata selisih absolut antara nilai asli dan prediksi. Semakin kecil, semakin baik.", `asli = [10, 20, 30]
prediksi = [12, 18, 33]
error = [abs(a - p) for a, p in zip(asli, prediksi)]
print(error)
print(sum(error) / len(error))`),
      learn("RMSE", "Root Mean Squared Error memberi penalti lebih besar pada error besar. Rumusnya akar dari rata-rata kuadrat error.", `import math

asli = [10, 20, 30]
prediksi = [12, 18, 33]
mse = sum((a - p) ** 2 for a, p in zip(asli, prediksi)) / len(asli)
print(math.sqrt(mse))`),
      quiz("Nilai MAE yang lebih kecil berarti model…", ["lebih buruk", "lebih baik", "pasti sempurna", "tidak bisa dievaluasi"], 1, "MAE kecil berarti prediksi rata-rata lebih dekat ke nilai asli."),
      code("Hitung MAE dari data asli [5, 10, 15] dan prediksi [6, 8, 18], lalu print hasilnya.", "asli = [5, 10, 15]\nprediksi = [6, 8, 18]\n", {
        out: "2.0", need: ["abs", "sum"],
      }, {
        chips: ["abs(a - p)", "sum(error)", "/ len(asli)"], hint: "Hitung error absolut tiap pasangan, jumlahkan, bagi jumlah data.",
        solution: "asli = [5, 10, 15]\nprediksi = [6, 8, 18]\nerror = [abs(a - p) for a, p in zip(asli, prediksi)]\nprint(sum(error) / len(asli))",
      }),
    ],
  },
]);

const machineLearning = mkTrack("Machine Learning Dasar", [
  {
    id: "bo-ml-konsep", title: "Supervised vs unsupervised", icon: "Sparkles", xp: 260, minutes: 8, level: "menengah", sortOrder: 1,
    steps: [
      learn("Supervised learning", "Model supervised belajar dari data berlabel. Contoh: klasifikasi email spam dan prediksi harga.", `data = [("apel", 1), ("jeruk", 0)]
fitur = [teks for teks, label in data]
label = [nilai for teks, nilai in data]
print(fitur)
print(label)`),
      learn("Unsupervised learning", "Model unsupervised mencari pola tanpa label, misalnya mengelompokkan pelanggan dengan kemiripan tertentu.", `nilai = [1, 2, 2, 8, 9, 9]
kelompok = {}
for x in nilai:
    kelompok.setdefault(x, []).append(x)
print(kelompok)`),
      quiz("Clustering termasuk jenis pembelajaran…", ["supervised", "unsupervised", "reinforcement", "deployment"], 1, "Clustering tidak memakai label jawaban, jadi termasuk unsupervised."),
      code("Pisahkan fitur dan label dari data [('apel', 1), ('jeruk', 0)], lalu print keduanya.", `data = [("apel", 1), ("jeruk", 0)]
`, { out: "['apel', 'jeruk']\n[1, 0]", need: ["for"] }, {
        chips: ["for teks, label in data", "fitur", "label"], hint: "Gunakan list comprehension untuk memisahkan teks dan label.",
        solution: 'data = [("apel", 1), ("jeruk", 0)]\nfitur = [teks for teks, label in data]\nlabel = [nilai for teks, nilai in data]\nprint(fitur)\nprint(label)',
      }),
    ],
  },
  {
    id: "bo-ml-knn", title: "KNN dari nol", icon: "Sparkles", xp: 280, minutes: 9, level: "menengah", sortOrder: 2,
    steps: [
      learn("Jarak Euclidean", "KNN membandingkan jarak antar titik. Untuk dua dimensi, jarak = akar dari jumlah kuadrat selisih.", `import math

titik_a = (1, 2)
titik_b = (4, 6)
print(math.dist(titik_a, titik_b))`),
      learn("K tetangga terdekat", "Cari K data latih dengan jarak terkecil, lalu pilih label yang paling sering muncul.", `import math

latih = [((1, 1), "A"), ((2, 2), "A"), ((8, 8), "B")]
uji = (1.5, 1.5)
hasil = sorted((math.dist(uji, x), label) for x, label in latih)
print(hasil)`),
      quiz("Pada KNN, K=1 berarti…", ["ambil satu tetangga terdekat", "abaikan semua data", "pakai satu fitur saja", "latih satu model"], 0, "K adalah jumlah tetangga terdekat yang ikut voting."),
      code("Dengan data latih di bawah, print label dari titik terdekat ke uji (2, 2).", `import math

latih = [((0, 0), "A"), ((1, 1), "A"), ((10, 10), "B")]
uji = (2, 2)
`, { out: "A", need: ["math\\.dist", "min"] }, {
        chips: ["math.dist(uji, titik)", "min(...)", "label"], hint: "Gunakan min dengan key jarak ke uji, lalu ambil labelnya.",
        solution: 'import math\n\nlatih = [((0, 0), "A"), ((1, 1), "A"), ((10, 10), "B")]\nuji = (2, 2)\nterdekat = min(latih, key=lambda item: math.dist(uji, item[0]))\nprint(terdekat[1])',
      }),
    ],
  },
  {
    id: "bo-ml-akurasi", title: "Akurasi & confusion matrix", icon: "Calculator", xp: 280, minutes: 8, level: "menengah", sortOrder: 3,
    steps: [
      learn("Akurasi", "Akurasi = jumlah prediksi benar dibagi jumlah data. Akurasi tinggi belum tentu cukup jika kelasnya tidak seimbang.", `asli = [1, 0, 1, 1]
pred = [1, 0, 0, 1]
benar = sum(a == p for a, p in zip(asli, pred))
print(benar, "/", len(asli))
print(benar / len(asli))`),
      learn("Confusion matrix", "Confusion matrix merinci True Positive, True Negative, False Positive, dan False Negative agar error terlihat lebih jelas.", `asli = [1, 0, 1, 1]
pred = [1, 0, 0, 1]
tp = sum(a == 1 and p == 1 for a, p in zip(asli, pred))
tn = sum(a == 0 and p == 0 for a, p in zip(asli, pred))
print("TP", tp, "TN", tn)`),
      quiz("Akurasi dihitung dengan rumus…", ["prediksi benar / total data", "total data / prediksi benar", "error / total data", "fitur / label"], 0, "Akurasi adalah proporsi prediksi yang benar."),
      code("Hitung akurasi dari data di bawah dan print dalam format persen tanpa desimal, misalnya 75%.", "asli = [1, 0, 1, 1]\npred = [1, 0, 0, 1]\n", {
        out: "75%", need: ["zip", "sum"],
      }, {
        chips: ["sum(a == p ...)", "len(asli)", ":.0%"], hint: "Bagi jumlah prediksi benar dengan len(asli), lalu format dengan :.0%.",
        solution: 'asli = [1, 0, 1, 1]\npred = [1, 0, 0, 1]\nbenar = sum(a == p for a, p in zip(asli, pred))\nprint(f"{benar / len(asli):.0%}")',
      }),
    ],
  },
]);

const security = mkTrack("Keamanan & Deployment", [
  {
    id: "bo-sec-secret", title: "Jangan bocorkan secret", icon: "Lock", xp: 260, minutes: 8, level: "menengah", sortOrder: 1,
    steps: [
      learn("Env dan prefix publik", "Variabel `NEXT_PUBLIC_` ikut terkirim ke browser. Service role, API key, dan admin secret harus tetap di server dan tidak pernah memakai prefix itu.", `import os

api_key = os.environ.get("API_KEY", "")
print("API key terbaca" if api_key else "API key tidak ada di env")`),
      learn("Redaksi log", "Jangan mencetak token mentah ke log. Ganti bagian rahasia dengan tanda bintang sebelum dikirim ke monitoring.", `def redaksi(token):
    return token[:4] + "*" * max(0, len(token) - 4)

print(redaksi("sk-rahasia-panjang"))`),
      quiz("Variabel environment mana yang aman dipakai di browser?", ["SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "GROQ_API_KEY", "ADMIN_SEED_SECRET"], 1, "Hanya variabel `NEXT_PUBLIC_` yang memang dirancang untuk client; anon key dibatasi RLS. Secret lain tetap server-only."),
      code("Samarkan token yang muncul di log: ganti pola sk-... menjadi sk-***.", 'import re\n\nlog = "request dengan token sk-1234567890 gagal"\n', {
        out: "request dengan token sk-*** gagal", need: ["re\\.sub"],
      }, {
        chips: ['re.sub(r"sk-\\w+", "sk-***", log)'], hint: 'Gunakan re.sub(r"sk-\\w+", "sk-***", log).',
        solution: `import re

log = "request dengan token sk-1234567890 gagal"
print(re.sub(r"sk-\\w+", "sk-***", log))`,
      }),
    ],
  },
  {
    id: "bo-sec-ratelimit", title: "Rate limit & auth", icon: "Lock", xp: 270, minutes: 8, level: "menengah", sortOrder: 2,
    steps: [
      learn("Authorization header", "Token dikirim lewat header `Authorization`, bukan URL. Di aplikasi ini endpoint admin memakai header `x-admin-secret` yang hanya diketahui server.", `# Contoh konsep, bukan kode yang dijalankan:
# Authorization: Bearer <token-rahasia>
# x-admin-secret: <secret-admin>

print("Token tidak boleh muncul di URL atau log")`),
      learn("Rate limit", "Rate limit membatasi jumlah request per IP dalam jendela waktu tertentu. Jika lewat batas, server membalas 429.", `from datetime import datetime, timedelta

sekarang = datetime(2026, 1, 1, 12, 0, 0)
batas = sekarang - timedelta(minutes=1)
riwayat = [sekarang - timedelta(seconds=30), sekarang - timedelta(seconds=90)]
print(sum(waktu >= batas for waktu in riwayat))`),
      quiz("Status HTTP saat klien melebihi rate limit adalah…", ["200", "401", "404", "429"], 3, "429 Too Many Requests menunjukkan batas request terlampaui."),
      code("Hitung berapa request yang terjadi dalam 60 detik terakhir dari daftar detik-lalu berikut, lalu print jumlahnya.", "waktu = [10, 40, 80, 120, 150]\n", {
        out: "2", need: ["sum"],
      }, {
        chips: ["sum(t <= 60 for t in waktu)"], hint: "Hitung elemen yang nilainya <= 60.",
        solution: "waktu = [10, 40, 80, 120, 150]\nprint(sum(t <= 60 for t in waktu))",
      }),
    ],
  },
  {
    id: "bo-sec-deploy", title: "Checklist deploy aman", icon: "Database", xp: 280, minutes: 8, level: "menengah", sortOrder: 3,
    steps: [
      learn("Checklist Vercel", "Sebelum deploy: isi env di dashboard Vercel, jangan commit `.env`, aktifkan RLS, pakai HTTPS, dan pastikan service role tidak pernah masuk bundle client.", `checklist = [
    "env server hanya di Vercel",
    "RLS aktif",
    "HTTPS + HSTS",
    "admin secret panjang dan acak",
]
print(len(checklist), "item siap diperiksa")`),
      quiz("Di mana service role key boleh disimpan?", ["environment server", "NEXT_PUBLIC_", "source code", "localStorage"], 0, "Service role adalah kredensial server; jangan pernah dikirim ke browser."),
      code("Print PERIKSA jika ada key NEXT_PUBLIC_ yang mengandung SERVICE_ROLE, selain itu print AMAN.", `config = {
    "SUPABASE_URL": "https://contoh.supabase.co",
    "SERVICE_ROLE": "rahasia-panjang-sekali-123",
    "NEXT_PUBLIC_SERVICE_ROLE": "jangan-bocor",
}
`, { out: "PERIKSA", need: ["startswith", "any"] }, {
        chips: ['k.startswith("NEXT_PUBLIC_")', '"SERVICE_ROLE" in k', "any()"], hint: "Cek setiap key, lalu print PERIKSA jika ada yang bocor.",
        solution: `config = {
    "SUPABASE_URL": "https://contoh.supabase.co",
    "SERVICE_ROLE": "rahasia-panjang-sekali-123",
    "NEXT_PUBLIC_SERVICE_ROLE": "jangan-bocor",
}

bocor = any(k.startswith("NEXT_PUBLIC_") and "SERVICE_ROLE" in k for k in config)
print("PERIKSA" if bocor else "AMAN")`,
      }),
    ],
  },
]);

export const BONUS_CATALOG: Lesson[] = [
  ...automasi,
  ...scraping,
  ...modeling,
  ...machineLearning,
  ...security,
];

/** Urutkan materi bonus berdasarkan jalur, lalu urutan di dalam jalur. */
export function sortBonusLessons(lessons: Lesson[]): Lesson[] {
  return [...lessons].sort((a, b) => {
    const byTrack = (TRACK_RANK.get(a.track ?? "") ?? UNKNOWN_TRACK) - (TRACK_RANK.get(b.track ?? "") ?? UNKNOWN_TRACK);
    if (byTrack !== 0) return byTrack;
    const byOrder = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (byOrder !== 0) return byOrder;
    const byCreated = (a.createdAt ?? 0) - (b.createdAt ?? 0);
    if (byCreated !== 0) return byCreated;
    return a.title.localeCompare(b.title, "id");
  });
}

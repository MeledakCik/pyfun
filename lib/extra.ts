import type { CodeStep, DebugStep, LearnStep, Lesson, PredictStep, QuizStep } from "./types";

const learn = (title: string, body: string, code?: string): LearnStep => ({ type: "learn", title, body, code });
const quiz = (
  q: string,
  options: string[],
  answer: number,
  explain: string,
  wrong?: string[],
): QuizStep => ({ type: "quiz", q, options, answer, explain, wrong });
const code = (
  prompt: string,
  starter: string,
  check: { out?: string; has?: string[]; need?: string[] },
  extra: { chips?: string[]; hint?: string; hint2?: string; solution?: string } = {},
): CodeStep => ({ type: "code", prompt, starter, ...check, ...extra });
const predict = (
  prompt: string,
  source: string,
  extra: { hint?: string; hint2?: string; explain?: string } = {},
): PredictStep => ({ type: "predict", prompt, code: source, ...extra });
const debug = (
  prompt: string,
  starter: string,
  tests: DebugStep["tests"],
  extra: { hint?: string; hint2?: string; solution?: string } = {},
): DebugStep => ({ type: "debug", prompt, starter, tests, ...extra });

/** Nama jalur baru. Urutan tampil diatur di `BONUS_TRACKS` (lib/bonus.ts). */
export const EXTRA_TRACKS = ["Dasar Tambahan", "Algoritma & Logika", "Pustaka Standar"] as const;

type Def = Omit<Lesson, "chapter" | "source" | "track" | "sortOrder"> & { sortOrder: number };

const mkTrack = (track: string, defs: Def[]): Lesson[] =>
  defs.map((d) => ({ ...d, chapter: "Materi Bonus", track, source: "catalog" as const }));

const dasar = mkTrack("Dasar Tambahan", [
  {
    id: "ex-casting", title: "Konversi tipe", icon: "Package", xp: 150, minutes: 5, level: "pemula", sortOrder: 1,
    steps: [
      learn("Mengubah tipe data", "`int()` mengubah teks angka menjadi bilangan bulat, `float()` menjadi desimal, dan `str()` menjadi teks. Konversi yang tidak masuk akal, misalnya `int(\"abc\")`, akan memicu `ValueError`.", `angka = int("42")
desimal = float("3.5")
teks = str(90)
print(angka + 1, desimal, teks)`),
      learn("Desimal ke bulat", "`int(\"3.9\")` gagal karena titik desimal bukan bilangan bulat. Ubah dulu dengan `float()`, baru `int()`: bagian desimal akan dipotong, bukan dibulatkan.", `nilai = int(float("3.9"))
print(nilai)`),
      quiz('Hasil dari int("12") + 3 adalah…', ["123", "15", "12", "Error"], 1, "`int(\"12\")` berubah menjadi angka 12, lalu ditambah 3 menjadi 15."),
      code('Ubah teks "42" menjadi bilangan bulat, tambahkan 8, lalu print hasilnya.', 'teks = "42"\n', {
        out: "50", need: ["int\\s*\\("],
      }, {
        chips: ["int(teks)", "print()"], hint: "Simpan hasil int(teks) ke variabel, lalu tambahkan 8.",
        hint2: "print(int(teks) + 8)", solution: 'teks = "42"\nangka = int(teks)\nprint(angka + 8)',
      }),
      code("Print tipe data dari 10, 2.5, dan \"PyFun\", satu per baris.", "", {
        out: "<class 'int'>\n<class 'float'>\n<class 'str'>", need: ["type\\s*\\("],
      }, {
        chips: ["type(10)", "type(2.5)", "type(\"PyFun\")"], hint: "Gunakan type() di dalam print().",
        solution: 'print(type(10))\nprint(type(2.5))\nprint(type("PyFun"))',
      }),
    ],
  },
  {
    id: "ex-logika", title: "Operator logika", icon: "GitBranch", xp: 160, minutes: 5, level: "pemula", sortOrder: 2,
    steps: [
      learn("and, or, not", "`and` benar hanya jika kedua sisi benar. `or` benar jika salah satu benar. `not` membalik nilai boolean.", `print(True and False)
print(True or False)
print(not True)`),
      learn("Kombinasi kondisi", "Kurung membuat maksud kode lebih jelas. Contoh `(umur >= 17) and (punya_tiket)` hanya benar jika keduanya terpenuhi.", `umur = 18
punya_tiket = True
print((umur >= 17) and punya_tiket)`),
      quiz("Hasil dari True and not False adalah…", ["True", "False", "None", "Error"], 0, "`not False` bernilai True, lalu `True and True` bernilai True."),
      code("Jika umur minimal 17 DAN punya tiket, print Boleh masuk. Selain itu print Tidak boleh.", "umur = 17\npunya_tiket = True\n", {
        out: "Boleh masuk", need: ["and", "if"],
      }, {
        chips: ["if", "and", "else:"], hint: "Gabungkan dua kondisi dengan and di dalam if.",
        hint2: "if umur >= 17 and punya_tiket:", solution: 'if umur >= 17 and punya_tiket:\n    print("Boleh masuk")\nelse:\n    print("Tidak boleh")',
      }),
      predict("Apa output kode ini?", "print(True and False or True)", {
        hint: "Python mengevaluasi `and` sebelum `or`.",
        hint2: "`True and False` bernilai False, lalu `False or True` bernilai True.",
        explain: "Output-nya `True` karena `and` dihitung lebih dulu daripada `or`.",
      }),
    ],
  },
  {
    id: "ex-string-metode", title: "Metode string", icon: "Type", xp: 160, minutes: 6, level: "pemula", sortOrder: 3,
    steps: [
      learn("Memecah dan menggabung", "`split()` memecah teks menjadi list. `join()` menggabungkan list menjadi teks dengan pemisah tertentu.", `kata = "belajar python".split()
print(kata)
print("-".join(kata))`),
      learn("Membersihkan teks", "`strip()` membuang spasi di ujung, `replace(a, b)` mengganti bagian teks, dan `title()` membuat huruf awal setiap kata kapital.", `teks = "  python itu hebat  "
print(teks.strip().title())`),
      quiz('Hasil dari "a,b,c".split(",") adalah…', ["['a,b,c']", "['a', 'b', 'c']", "a b c", "['abc']"], 1, "`split(\",\")` memecah teks pada setiap koma."),
      code("Bersihkan spasi di ujung teks dan ubah menjadi huruf kapital di awal kata, lalu print hasilnya.", 'teks = "  python itu menyenangkan  "\n', {
        out: "Python Itu Menyenangkan", need: ["strip", "title"],
      }, {
        chips: [".strip()", ".title()"], hint: "Gabungkan `teks.strip().title()` di dalam print().",
        solution: 'print(teks.strip().title())',
      }),
      code('Pecah kalimat menjadi kata, lalu print jumlah kata dan kata yang digabung dengan tanda hubung: "python-itu-menyenangkan".', 'kalimat = "python itu menyenangkan"\n', {
        out: "3 python-itu-menyenangkan", need: ["split", "join"],
      }, {
        chips: ["kalimat.split()", "len(kata)", '"-".join(kata)'], hint: "Simpan hasil split() ke variabel kata.",
        solution: 'kata = kalimat.split()\nprint(len(kata), "-".join(kata))',
      }),
    ],
  },
  {
    id: "ex-break-continue", title: "break & continue", icon: "Repeat", xp: 170, minutes: 6, level: "pemula", sortOrder: 4,
    steps: [
      learn("Mengatur alur loop", "`break` menghentikan loop sepenuhnya. `continue` melewati satu putaran dan lanjut ke putaran berikutnya.", `for i in range(1, 6):
    if i == 4:
        break
    print(i)`),
      learn("while dengan syarat berhenti", "Loop `while` harus punya perubahan yang membuat kondisinya akhirnya salah, misalnya `n -= 1`. Tanpa itu, loop berjalan selamanya.", `n = 3
while n > 0:
    print(n)
    n -= 1
print("Go!")`),
      quiz("Apa fungsi continue di dalam loop?", ["Menghentikan loop", "Melewati sisa putaran ini", "Mengulang dari awal program", "Menutup program"], 1, "`continue` langsung menuju putaran berikutnya."),
      code("Print angka 1 sampai 10, lewati kelipatan 3, dan berhenti sebelum angka 8.", "", {
        out: "1\n2\n4\n5\n7", need: ["break", "continue"],
      }, {
        chips: ["for i in range(1, 11):", "continue", "break"], hint: "Cek break lebih dulu, lalu continue untuk kelipatan 3.",
        solution: 'for i in range(1, 11):\n    if i == 8:\n        break\n    if i % 3 == 0:\n        continue\n    print(i)',
      }),
      code("Gunakan while untuk print 3, 2, 1, lalu Go!", "n = 3\n", {
        out: "3\n2\n1\nGo!", need: ["while"],
      }, {
        chips: ["while n > 0:", "n -= 1", "print()"], hint: "Kurangi n di dalam loop agar berhenti.",
        solution: 'n = 3\nwhile n > 0:\n    print(n)\n    n -= 1\nprint("Go!")',
      }),
    ],
  },
  {
    id: "ex-fungsi-return", title: "Return & validasi", icon: "Braces", xp: 190, minutes: 6, level: "pemula", sortOrder: 5,
    steps: [
      learn("Return lebih dari satu nilai", "Fungsi bisa mengembalikan tuple, lalu isinya dibongkar menjadi beberapa variabel. Ini praktis untuk mengembalikan beberapa hasil sekaligus.", `def min_max(data):
    return min(data), max(data)

rendah, tinggi = min_max([4, 9, 2])
print(rendah, tinggi)`),
      learn("Return awal", "`return` langsung menghentikan fungsi. Gunakan untuk menangani kasus khusus sebelum logika utama.", `def bagi(a, b):
    if b == 0:
        return None
    return a / b

print(bagi(8, 2))
print(bagi(8, 0))`),
      quiz("Fungsi yang tidak memiliki return menghasilkan…", ["0", "None", "string kosong", "Error"], 1, "Tanpa `return`, Python mengembalikan `None`."),
      code("Lengkapi fungsi bagi agar mengembalikan None saat pembagi 0, selain itu hasil pembagian.", `def bagi(a, b):
    # tangani b == 0 lebih dulu
    pass


print(bagi(8, 2))
print(bagi(8, 0))`, {
        out: "4.0\nNone", need: ["return", "if"],
      }, {
        chips: ["if b == 0:", "return None", "return a / b"], hint: "Tambahkan pengecekan b == 0 sebelum pembagian.",
        solution: "def bagi(a, b):\n    if b == 0:\n        return None\n    return a / b\n\n\nprint(bagi(8, 2))\nprint(bagi(8, 0))",
      }),
      code("Buat fungsi min_max(data) yang mengembalikan nilai terkecil dan terbesar, lalu print keduanya.", "", {
        out: "3 9", need: ["def\\s+min_max", "return"],
      }, {
        chips: ["def min_max(data):", "return min(data), max(data)", "rendah, tinggi = ..."],
        hint: "Kembalikan dua nilai sekaligus, lalu bongkar hasilnya.",
        solution: "def min_max(data):\n    return min(data), max(data)\n\n\nrendah, tinggi = min_max([3, 9, 1])\nprint(rendah, tinggi)",
      }),
    ],
  },
  {
    id: "ex-loop-pola", title: "Loop bersarang", icon: "Repeat", xp: 200, minutes: 7, level: "pemula", sortOrder: 6,
    steps: [
      learn("Loop di dalam loop", "Loop luar berjalan sekali per kelompok; loop dalam menyelesaikan semua putarannya untuk setiap putaran luar.", `for baris in range(1, 4):
    for kolom in range(1, 4):
        print(baris, kolom)`),
      learn("Membentuk pola", "Variabel loop bisa dipakai untuk mengulang teks. `\"*\" * 3` menghasilkan tiga bintang.", `for i in range(1, 4):
    print("*" * i)`),
      quiz("Jika loop luar berjalan 3 kali dan loop dalam 4 kali, total putaran loop dalam adalah…", ["3", "4", "7", "12"], 3, "Setiap putaran luar menjalankan 4 putaran dalam: 3 × 4 = 12."),
      code("Print segitiga bintang dengan tinggi 3 baris.", "", {
        out: "*\n**\n***", need: ["for"],
      }, {
        chips: ["for i in range(1, 4):", 'print("*" * i)'], hint: "Ulangi teks bintang sebanyak nomor baris.",
        solution: 'for i in range(1, 4):\n    print("*" * i)',
      }),
      code("Gunakan dua loop untuk print pasangan angka dari 1 sampai 2 (contoh: 1 1).", "", {
        out: "1 1\n1 2\n2 1\n2 2", need: ["for.*for|for[\\s\\S]*for"],
      }, {
        chips: ["for i in range(1, 3):", "for j in range(1, 3):", "print(i, j)"],
        hint: "Buat loop i, lalu loop j di dalamnya.",
        solution: "for i in range(1, 3):\n    for j in range(1, 3):\n        print(i, j)",
      }),
    ],
  },
]);

const algoritma = mkTrack("Algoritma & Logika", [
  {
    id: "ex-cari-linear", title: "Pencarian linear", icon: "List", xp: 200, minutes: 6, level: "menengah", sortOrder: 1,
    steps: [
      learn("Memeriksa satu per satu", "Pencarian linear memeriksa setiap elemen sampai target ditemukan. Cocok untuk data kecil atau data yang belum terurut.", `def cari(data, target):
    for i, nilai in enumerate(data):
        if nilai == target:
            return i
    return -1`),
      learn("Kompleksitas", "Dalam kasus terburuk, pencarian linear memeriksa semua elemen sehingga waktunya tumbuh linear, ditulis O(n).", `data = [4, 8, 15, 16]
print(4 in data)
print(data.index(15))`),
      quiz("Pencarian linear pada 100 data paling banyak memeriksa…", ["1 data", "10 data", "100 data", "10.000 data"], 2, "Kasus terburuk memeriksa seluruh n data."),
      code("Lengkapi fungsi cari agar mengembalikan indeks target, atau -1 jika tidak ditemukan.", `def cari(data, target):
    # periksa setiap elemen
    pass


print(cari([4, 8, 15], 15))
print(cari([4, 8, 15], 7))`, {
        out: "2\n-1", need: ["for", "return"],
      }, {
        chips: ["for i, nilai in enumerate(data):", "if nilai == target:", "return -1"],
        hint: "Kembalikan indeks saat cocok, dan -1 setelah loop selesai.",
        solution: "def cari(data, target):\n    for i, nilai in enumerate(data):\n        if nilai == target:\n            return i\n    return -1\n\n\nprint(cari([4, 8, 15], 15))\nprint(cari([4, 8, 15], 7))",
      }),
      debug("Fungsi hitung_target seharusnya menghitung berapa kali target muncul. Perbaiki bug-nya.", `def hitung_target(data, target):
    jumlah = 1
    for nilai in data:
        if nilai == target:
            jumlah += 1
    return jumlah`, [
        { label: "hitung_target([1, 2, 1], 1) → 2", code: "print(hitung_target([1, 2, 1], 1))", expected: "2" },
        { label: "hitung_target([5, 5, 5], 5) → 3", code: "print(hitung_target([5, 5, 5], 5))", expected: "3" },
      ], {
        hint: "Perhatikan nilai awal variabel jumlah.",
        hint2: "Penghitung seharusnya mulai dari 0, bukan 1.",
        solution: "def hitung_target(data, target):\n    jumlah = 0\n    for nilai in data:\n        if nilai == target:\n            jumlah += 1\n    return jumlah",
      }),
    ],
  },
  {
    id: "ex-cari-biner", title: "Pencarian biner", icon: "Calculator", xp: 220, minutes: 7, level: "menengah", sortOrder: 2,
    steps: [
      learn("Membagi dua ruang pencarian", "Pencarian biner hanya bekerja pada data terurut. Bandingkan target dengan nilai tengah, lalu buang separuh data yang tidak mungkin.", `data = [2, 5, 8, 12, 16]
target = 12
kiri, kanan = 0, len(data) - 1
tengah = (kiri + kanan) // 2
print(tengah, data[tengah])`),
      learn("Menggeser batas", "Jika nilai tengah lebih kecil dari target, geser batas kiri ke `tengah + 1`. Jika lebih besar, geser batas kanan ke `tengah - 1`.", `kiri, kanan = 0, 4
tengah = 2
if data[tengah] < target:
    kiri = tengah + 1
print(kiri)`),
      quiz("Syarat data agar pencarian biner benar adalah…", ["harus berupa string", "harus terurut", "harus berisi angka genap", "harus berukuran 100"], 1, "Tanpa urutan, membuang separuh data bisa membuang nilai yang dicari."),
      code("Lengkapi pencarian biner pada data terurut, lalu print indeks 23 dan -1 untuk 7.", `data = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]


def cari_biner(data, target):
    kiri, kanan = 0, len(data) - 1
    while kiri <= kanan:
        # hitung tengah dan bandingkan
        pass
    return -1


print(cari_biner(data, 23))
print(cari_biner(data, 7))`, {
        out: "5\n-1", need: ["while", "//"],
      }, {
        chips: ["tengah = (kiri + kanan) // 2", "if data[tengah] == target:", "kiri = tengah + 1"],
        hint: "Gunakan // untuk indeks tengah dan perbarui kiri/kanan.",
        solution: "data = [2, 5, 8, 12, 16, 23, 38, 56, 72, 91]\n\n\ndef cari_biner(data, target):\n    kiri, kanan = 0, len(data) - 1\n    while kiri <= kanan:\n        tengah = (kiri + kanan) // 2\n        if data[tengah] == target:\n            return tengah\n        if data[tengah] < target:\n            kiri = tengah + 1\n        else:\n            kanan = tengah - 1\n    return -1\n\n\nprint(cari_biner(data, 23))\nprint(cari_biner(data, 7))",
      }),
      quiz("Pencarian biner pada 16 data terurut membutuhkan paling banyak sekitar…", ["1 perbandingan", "4 perbandingan", "8 perbandingan", "16 perbandingan"], 1, "Setiap langkah membagi dua: 16 → 8 → 4 → 2 → 1, sekitar log₂(16) = 4."),
    ],
  },
  {
    id: "ex-bubble-sort", title: "Bubble sort", icon: "Repeat", xp: 220, minutes: 7, level: "menengah", sortOrder: 3,
    steps: [
      learn("Menukar tetangga", "Bubble sort membandingkan dua elemen bersebelahan dan menukarnya jika urutannya salah. Setelah satu putaran penuh, nilai terbesar bergerak ke ujung.", `data = [5, 1, 4]
if data[0] > data[1]:
    data[0], data[1] = data[1], data[0]
print(data)`),
      learn("Mengulang sampai rapi", "Ulangi proses untuk setiap posisi. Jika satu putaran tidak ada pertukaran, data sudah terurut dan loop bisa berhenti lebih awal.", `data = [3, 2, 1]
for i in range(len(data)):
    for j in range(len(data) - 1 - i):
        if data[j] > data[j + 1]:
            data[j], data[j + 1] = data[j + 1], data[j]
print(data)`),
      quiz("Setelah satu putaran penuh bubble sort menaik, elemen terbesar berada di…", ["awal list", "tengah list", "akhir list", "hilang"], 2, "Elemen terbesar terus terdorong ke kanan hingga ujung."),
      code("Urutkan [5, 1, 4, 2, 8] dengan bubble sort, lalu print hasilnya.", "data = [5, 1, 4, 2, 8]\n", {
        out: "[1, 2, 4, 5, 8]", need: ["for", "if"],
      }, {
        chips: ["for i in range(len(data)):", "for j in range(len(data) - 1 - i):", "data[j], data[j + 1] = ..."],
        hint: "Bandingkan data[j] dengan data[j + 1], tukar jika perlu.",
        solution: "data = [5, 1, 4, 2, 8]\nfor i in range(len(data)):\n    for j in range(len(data) - 1 - i):\n        if data[j] > data[j + 1]:\n            data[j], data[j + 1] = data[j + 1], data[j]\nprint(data)",
      }),
      code("Print data yang sama dalam urutan menurun memakai sorted().", "data = [5, 1, 4, 2, 8]\n", {
        out: "[8, 5, 4, 2, 1]", need: ["sorted", "reverse"],
      }, {
        chips: ["sorted(data, reverse=True)"], hint: "sorted() mengembalikan list baru; tambahkan reverse=True.",
        solution: "data = [5, 1, 4, 2, 8]\nprint(sorted(data, reverse=True))",
      }),
    ],
  },
  {
    id: "ex-rekursi", title: "Rekursi", icon: "Braces", xp: 240, minutes: 8, level: "menengah", sortOrder: 4,
    steps: [
      learn("Fungsi memanggil dirinya", "Rekursi memecah masalah menjadi versi lebih kecil. Setiap fungsi rekursif wajib punya base case agar pemanggilan berhenti.", `def hitung_mundur(n):
    if n == 0:
        return
    print(n)
    hitung_mundur(n - 1)

hitung_mundur(3)`),
      learn("Faktorial", "Faktorial 5 adalah 5 × 4 × 3 × 2 × 1. Bentuk rekursifnya: `faktorial(n) = n * faktorial(n - 1)`, dengan `faktorial(1) = 1`.", `def faktorial(n):
    if n <= 1:
        return 1
    return n * faktorial(n - 1)`),
      quiz("Apa yang terjadi jika fungsi rekursif tidak punya base case?", ["Berjalan lebih cepat", "Mengembalikan 0", "RecursionError", "Otomatis berhenti"], 2, "Pemanggilan tidak pernah berhenti hingga Python melempar `RecursionError`."),
      code("Buat fungsi faktorial(n) secara rekursif, lalu print faktorial(5).", "", {
        out: "120", need: ["def\\s+faktorial", "return"],
      }, {
        chips: ["if n <= 1: return 1", "return n * faktorial(n - 1)"], hint: "Mulai dari base case n <= 1.",
        solution: "def faktorial(n):\n    if n <= 1:\n        return 1\n    return n * faktorial(n - 1)\n\n\nprint(faktorial(5))",
      }),
      code("Buat fungsi jumlah(data) rekursif yang menjumlahkan list [1, 2, 3, 4].", "", {
        out: "10", need: ["def\\s+jumlah", "return"],
      }, {
        chips: ["if not data: return 0", "return data[0] + jumlah(data[1:])"],
        hint: "Base case: list kosong bernilai 0.",
        solution: "def jumlah(data):\n    if not data:\n        return 0\n    return data[0] + jumlah(data[1:])\n\n\nprint(jumlah([1, 2, 3, 4]))",
      }),
    ],
  },
  {
    id: "ex-fibonacci", title: "Deret Fibonacci", icon: "Calculator", xp: 230, minutes: 7, level: "menengah", sortOrder: 5,
    steps: [
      learn("Menambah dua nilai sebelumnya", "Deret Fibonacci dimulai 0, 1, lalu setiap nilai adalah jumlah dua nilai sebelumnya: 0, 1, 1, 2, 3, 5, 8, 13.", `a, b = 0, 1
for _ in range(5):
    print(a, end=" ")
    a, b = b, a + b`),
      learn("Versi list", "Menyimpan hasil ke list memudahkan pengecekan dan pencetakan. Ini juga menghindari perhitungan berulang yang sama.", `fib = [0, 1]
while len(fib) < 8:
    fib.append(fib[-1] + fib[-2])
print(fib)`),
      quiz("Nilai Fibonacci ke-6 (mulai dari 0) adalah…", ["5", "8", "13", "21"], 1, "Deretnya 0, 1, 1, 2, 3, 5, 8, jadi indeks ke-6 adalah 8."),
      code("Print 8 angka pertama Fibonacci dalam satu baris, dipisah spasi.", "", {
        out: "0 1 1 2 3 5 8 13", need: ["while|for"],
      }, {
        chips: ["fib = [0, 1]", "fib.append(fib[-1] + fib[-2])", 'join()'], hint: "Bangun list sampai panjangnya 8, lalu gabungkan dengan spasi.",
        solution: 'fib = [0, 1]\nwhile len(fib) < 8:\n    fib.append(fib[-1] + fib[-2])\nprint(" ".join(str(n) for n in fib))',
      }),
      quiz("Pada Fibonacci, fib[-1] berarti…", ["nilai pertama", "nilai terakhir", "panjang list", "jumlah semua nilai"], 1, "Indeks -1 mengambil elemen terakhir."),
    ],
  },
  {
    id: "ex-palindrome", title: "Cek palindrom", icon: "Type", xp: 230, minutes: 7, level: "menengah", sortOrder: 6,
    steps: [
      learn("Membandingkan dari dua arah", "Palindrom dibaca sama dari depan dan belakang. Cara sederhana: bersihkan teks, lalu bandingkan dengan hasil kebalikannya (`[::-1]`).", `teks = "katak"
print(teks == teks[::-1])`),
      learn("Normalisasi teks", "Abaikan huruf besar/kecil, spasi, dan tanda baca. `isalnum()` hanya meloloskan huruf dan angka.", `teks = "Kasur ini rusak"
bersih = "".join(ch.lower() for ch in teks if ch.isalnum())
print(bersih)
print(bersih == bersih[::-1])`),
      quiz('Hasil dari "malam"[::-1] adalah…', ["malam", "mal am", "mala", "Error"], 0, "`[::-1]` membalik urutan karakter; hasilnya tetap `malam` karena palindrom."),
      code('Buat fungsi palindrom(teks) yang mengabaikan huruf besar/kecil dan tanda baca, lalu uji "Kasur ini rusak" dan "Python".', "", {
        out: "True\nFalse", need: ["lower", "isalnum"],
      }, {
        chips: ["ch.lower()", "ch.isalnum()", "[::-1]"], hint: "Bersihkan teks dengan generator, lalu bandingkan dengan kebalikannya.",
        solution: 'def palindrom(teks):\n    bersih = "".join(ch.lower() for ch in teks if ch.isalnum())\n    return bersih == bersih[::-1]\n\n\nprint(palindrom("Kasur ini rusak"))\nprint(palindrom("Python"))',
      }),
      quiz("Mengapa spasi perlu dibuang sebelum mengecek palindrom?", ["Agar kode lebih pendek", "Spasi bisa membuat perbandingan gagal", "Spasi selalu error", "Tidak perlu dibuang"], 1, "Spasi ikut terbalik dan membuat string tidak sama meski katanya palindrom."),
    ],
  },
]);

const pustaka = mkTrack("Pustaka Standar", [
  {
    id: "ex-datetime", title: "Tanggal & waktu", icon: "Package", xp: 220, minutes: 7, level: "menengah", sortOrder: 1,
    steps: [
      learn("date dan timedelta", "Modul `datetime` menyediakan `date` untuk tanggal dan `timedelta` untuk selisih waktu. Mengurangkan dua tanggal menghasilkan `timedelta`.", `from datetime import date

mulai = date(2026, 1, 1)
akhir = date(2026, 1, 31)
print((akhir - mulai).days)`),
      learn("Format dan parse", "`strftime()` mengubah tanggal menjadi teks dengan pola tertentu. `strptime()` melakukan sebaliknya, membaca teks menjadi objek tanggal.", `from datetime import datetime

t = datetime.strptime("17-08-2025", "%d-%m-%Y")
print(t.strftime("%Y/%m/%d"))`),
      quiz("Kode format %Y pada strftime berarti…", ["nama hari", "tahun 4 digit", "bulan angka", "menit"], 1, "`%Y` adalah tahun empat digit, misalnya 2026."),
      code('Hitung selisih hari antara 1 Januari 2026 dan 31 Januari 2026, lalu print tanggal akhir dalam format 31-01-2026.', "from datetime import date\n\nmulai = date(2026, 1, 1)\nakhir = date(2026, 1, 31)\n", {
        out: "30\n31-01-2026", need: ["days", "strftime"],
      }, {
        chips: ["(akhir - mulai).days", 'akhir.strftime("%d-%m-%Y")'], hint: "Selisih tanggal menghasilkan timedelta dengan atribut days.",
        solution: 'from datetime import date\n\nmulai = date(2026, 1, 1)\nakhir = date(2026, 1, 31)\nprint((akhir - mulai).days)\nprint(akhir.strftime("%d-%m-%Y"))',
      }),
      code('Baca tanggal "17-08-2025", lalu print tahun, bulan, dan harinya dipisah spasi.', 'from datetime import datetime\n\nteks = "17-08-2025"\n', {
        out: "2025 8 17", need: ["strptime"],
      }, {
        chips: ['datetime.strptime(teks, "%d-%m-%Y")', ".year", ".month", ".day"],
        hint: "Parse dengan pola hari-bulan-tahun, lalu print atributnya.",
        solution: 'from datetime import datetime\n\nteks = "17-08-2025"\ntanggal = datetime.strptime(teks, "%d-%m-%Y")\nprint(tanggal.year, tanggal.month, tanggal.day)',
      }),
    ],
  },
  {
    id: "ex-counter", title: "Counter & defaultdict", icon: "Database", xp: 230, minutes: 7, level: "menengah", sortOrder: 2,
    steps: [
      learn("Menghitung kemunculan", "`collections.Counter` menghitung frekuensi secara otomatis. `most_common(n)` mengembalikan pasangan nilai dan jumlah terbanyak.", `from collections import Counter

kata = ["apel", "jeruk", "apel", "mangga", "apel"]
hitung = Counter(kata)
print(hitung)
print(hitung.most_common(1))`),
      learn("defaultdict", "`defaultdict(list)` membuat nilai awal list saat kunci belum ada, sehingga tidak perlu mengecek `if kunci not in data` setiap kali.", `from collections import defaultdict

kelompok = defaultdict(list)
for buah in ["apel", "anggur", "jeruk"]:
    kelompok[buah[0]].append(buah)
print(dict(kelompok))`),
      quiz("Counter(['a', 'a', 'b'])['a'] menghasilkan…", ["1", "2", "3", "Error"], 1, "Counter menyimpan jumlah kemunculan setiap nilai."),
      code('Hitung kata pada "apel jeruk apel mangga apel", lalu print kata yang paling sering beserta jumlahnya.', 'from collections import Counter\n\nteks = "apel jeruk apel mangga apel"\n', {
        out: "apel 3", need: ["Counter", "most_common"],
      }, {
        chips: ["Counter(teks.split())", "most_common(1)", "print(kata, jumlah)"],
        hint: "Ambil pasangan pertama dari most_common(1).",
        solution: 'from collections import Counter\n\nteks = "apel jeruk apel mangga apel"\nhitung = Counter(teks.split())\nkata, jumlah = hitung.most_common(1)[0]\nprint(kata, jumlah)',
      }),
      code("Kelompokkan ['apel', 'anggur', 'jeruk'] berdasarkan huruf pertama dengan defaultdict, lalu print tiap kelompok urut abjad.", 'from collections import defaultdict\n\nbuah = ["apel", "anggur", "jeruk"]\n', {
        out: "a ['apel', 'anggur']\nj ['jeruk']", need: ["defaultdict", "sorted"],
      }, {
        chips: ["defaultdict(list)", "kelompok[buah[0]].append(buah)", "sorted(kelompok)"],
        hint: "Isi defaultdict dengan perulangan, lalu print per kunci terurut.",
        solution: 'from collections import defaultdict\n\nbuah = ["apel", "anggur", "jeruk"]\nkelompok = defaultdict(list)\nfor nama in buah:\n    kelompok[nama[0]].append(nama)\n\nfor huruf in sorted(kelompok):\n    print(huruf, kelompok[huruf])',
      }),
    ],
  },
  {
    id: "ex-itertools", title: "Kombinasi & produk", icon: "Calculator", xp: 230, minutes: 7, level: "menengah", sortOrder: 3,
    steps: [
      learn("combinations", "`combinations(data, r)` menghasilkan semua pilihan r elemen tanpa memperhatikan urutan. `(1, 2)` dan `(2, 1)` dianggap sama.", `from itertools import combinations

print(list(combinations([1, 2, 3], 2)))`),
      learn("product dan chain", "`product()` menghasilkan pasangan dari beberapa kumpulan. `chain()` menyambung beberapa iterable menjadi satu aliran.", `from itertools import chain, product

print(list(product("AB", repeat=2)))
print(list(chain([1, 2], [3, 4])))`),
      quiz("Perbedaan combinations dan permutations adalah…", ["tidak ada", "permutations memperhatikan urutan", "combinations hanya untuk angka", "permutations tidak bisa dipakai"], 1, "Permutasi membedakan urutan, kombinasi tidak."),
      code("Print semua kombinasi 2 elemen dari [1, 2, 3] dan semua pasangan dari \"AB\".", "from itertools import combinations, product\n", {
        out: "[(1, 2), (1, 3), (2, 3)]\n[('A', 'A'), ('A', 'B'), ('B', 'A'), ('B', 'B')]", need: ["combinations", "product"],
      }, {
        chips: ["list(combinations([1, 2, 3], 2))", 'list(product("AB", repeat=2))'],
        hint: "Bungkus hasil iterator dengan list() agar bisa dicetak.",
        solution: 'from itertools import combinations, product\n\nprint(list(combinations([1, 2, 3], 2)))\nprint(list(product("AB", repeat=2)))',
      }),
      code("Gabungkan [1, 2] dan [3, 4] dengan chain, lalu print hasilnya sebagai list.", "from itertools import chain\n", {
        out: "[1, 2, 3, 4]", need: ["chain", "list"],
      }, {
        chips: ["chain([1, 2], [3, 4])", "list(...)"], hint: "chain menerima beberapa iterable sebagai argumen.",
        solution: "from itertools import chain\n\nprint(list(chain([1, 2], [3, 4])))",
      }),
    ],
  },
  {
    id: "ex-file-json", title: "File & JSON", icon: "BookOpen", xp: 240, minutes: 8, level: "menengah", sortOrder: 4,
    steps: [
      learn("JSON adalah teks terstruktur", "`json.dumps()` mengubah objek Python menjadi teks JSON, sedangkan `json.loads()` membaca teks JSON menjadi dict/list.", `import json

teks = '{"nama": "Rani", "nilai": [80, 90]}'
data = json.loads(teks)
print(data["nama"])
print(json.dumps(data, ensure_ascii=False))`),
      learn("Menulis ke buffer", "`StringIO` berperilaku seperti file di memori. Cocok untuk latihan membaca/menulis tanpa menyentuh disk. Setelah menulis, panggil `seek(0)` sebelum membaca.", `import json
from io import StringIO

buf = StringIO()
json.dump({"nama": "Budi"}, buf)
buf.seek(0)
print(json.load(buf)["nama"])`),
      quiz("json.loads() menerima input berupa…", ["nama file", "teks JSON", "objek file", "list Python"], 1, "`loads` = load string; `load` dipakai untuk objek file."),
      code('Tulis {"nama": "Rani", "nilai": 90} ke buffer JSON, baca kembali, lalu print nama dan nilai+10.', "import json\nfrom io import StringIO\n\nbuf = StringIO()\n", {
        out: "Rani\n100", need: ["json.dump", "json.load"],
      }, {
        chips: ["json.dump(data, buf)", "buf.seek(0)", "json.load(buf)"], hint: "Jangan lupa seek(0) sebelum membaca buffer.",
        solution: 'import json\nfrom io import StringIO\n\nbuf = StringIO()\ndata = {"nama": "Rani", "nilai": 90}\njson.dump(data, buf)\nbuf.seek(0)\nhasil = json.load(buf)\nprint(hasil["nama"])\nprint(hasil["nilai"] + 10)',
      }),
      quiz("Agar karakter non-ASCII tetap terbaca di JSON, gunakan…", ["ensure_ascii=False", "sort_keys=True", "indent=0", "allow_nan=False"], 0, "`ensure_ascii=False` mempertahankan karakter asli seperti huruf beraksen."),
    ],
  },
  {
    id: "ex-regex-lanjut", title: "Regex lanjutan", icon: "Type", xp: 250, minutes: 8, level: "menengah", sortOrder: 5,
    steps: [
      learn("Mencari semua pola", "`re.findall()` mengembalikan semua kecocokan. Gunakan `re.escape()` jika teks yang dicari berasal dari input dan bukan pola regex.", `import re

teks = "file_2024.csv dan file_2025.csv"
print(re.findall(r"file_\\d{4}", teks))`),
      learn("Grup dan validasi", "Tanda kurung membuat grup. `re.fullmatch()` memastikan seluruh teks cocok, bukan hanya sebagian.", `import re

pola = r"([a-z]+)@([a-z]+)\\.com"
hasil = re.fullmatch(pola, "rani@pyfun.com")
print(hasil.group(1) if hasil else "tidak cocok")`),
      quiz("Apa bedanya re.match dan re.fullmatch?", ["Tidak ada", "fullmatch harus cocok dengan seluruh teks", "match hanya untuk angka", "fullmatch lebih lambat"], 1, "`fullmatch` mewajibkan seluruh string cocok."),
      code('Ambil semua tanggal berformat dd-mm-yyyy dari teks, lalu print list hasilnya.', 'import re\n\nteks = "Rilis 12-05-2026, ujian 31-12-2025"\n', {
        out: "['12-05-2026', '31-12-2025']", need: ["re\\.findall"],
      }, {
        chips: ["re.findall", 'r"\\d{2}-\\d{2}-\\d{4}"'], hint: "Gunakan \\d untuk digit dan {2}/{4} untuk jumlahnya.",
        solution: 'import re\n\nteks = "Rilis 12-05-2026, ujian 31-12-2025"\nprint(re.findall(r"\\d{2}-\\d{2}-\\d{4}", teks))',
      }),
      code("Gunakan fullmatch untuk memeriksa \"rani@pyfun.com\" (valid) dan \"rani@pyfun\" (tidak valid). Print True lalu False.", "import re\n\npola = r\"[^@\\s]+@[^@\\s]+\\.[a-z]{2,}\"\n", {
        out: "True\nFalse", need: ["fullmatch"],
      }, {
        chips: ["re.fullmatch(pola, teks)", "is not None"], hint: "fullmatch mengembalikan objek Match atau None.",
        solution: 'import re\n\npola = r"[^@\\s]+@[^@\\s]+\\.[a-z]{2,}"\nprint(re.fullmatch(pola, "rani@pyfun.com") is not None)\nprint(re.fullmatch(pola, "rani@pyfun") is not None)',
      }),
    ],
  },
  {
    id: "ex-unittest", title: "Unit test", icon: "Check", xp: 260, minutes: 8, level: "menengah", sortOrder: 6,
    steps: [
      learn("Menguji perilaku", "`unittest` menjalankan method yang namanya diawali `test_`. `assertEqual(a, b)` gagal jika nilainya berbeda; hasil test bisa diperiksa lewat `wasSuccessful()`.", `import unittest

class TestAngka(unittest.TestCase):
    def test_sama(self):
        self.assertEqual(2 + 2, 4)

hasil = TestAngka("test_sama").run()
print(hasil.wasSuccessful())`),
      learn("Banyak kasus", "Satu kelas test boleh punya banyak method. Jalankan satu per satu dengan nama method, atau gunakan `TestLoader` untuk menjalankan semuanya.", `class TestTeks(unittest.TestCase):
    def test_panjang(self):
        self.assertEqual(len("abc"), 3)

print(TestTeks("test_panjang").run().testsRun)`),
      quiz("Assert yang tepat untuk memeriksa kesamaan nilai adalah…", ["assertTrue", "assertEqual", "assertIn", "assertRaises"], 1, "`assertEqual(nilai, harapan)` membandingkan dua nilai."),
      code("Buat satu test untuk tambah(2, 3) == 5, jalankan, lalu print apakah berhasil dan berapa test yang dijalankan.", `import unittest


def tambah(a, b):
    return a + b


class TestTambah(unittest.TestCase):
    def test_positif(self):
        # tambahkan assertEqual
        pass


hasil = TestTambah("test_positif").run()
print(hasil.wasSuccessful())
print(hasil.testsRun)`, {
        out: "True\n1", need: ["assertEqual", "run"],
      }, {
        chips: ["self.assertEqual(tambah(2, 3), 5)", '.run()', "wasSuccessful()"],
        hint: "Ganti pass dengan assertEqual, lalu jalankan TestTambah.",
        solution: "import unittest\n\n\ndef tambah(a, b):\n    return a + b\n\n\nclass TestTambah(unittest.TestCase):\n    def test_positif(self):\n        self.assertEqual(tambah(2, 3), 5)\n\n\nhasil = TestTambah(\"test_positif\").run()\nprint(hasil.wasSuccessful())\nprint(hasil.testsRun)",
      }),
      code("Jalankan test pembagian yang benar, lalu print jumlah failures dan errors (keduanya 0).", `import unittest


class TestBagi(unittest.TestCase):
    def test_bagi(self):
        self.assertEqual(10 // 2, 5)


hasil = TestBagi("test_bagi").run()
`, {
        out: "0 0", need: ["failures", "errors"],
      }, {
        chips: ["len(hasil.failures)", "len(hasil.errors)"], hint: "TestResult menyimpan list failures dan errors.",
        solution: "import unittest\n\n\nclass TestBagi(unittest.TestCase):\n    def test_bagi(self):\n        self.assertEqual(10 // 2, 5)\n\n\nhasil = TestBagi(\"test_bagi\").run()\nprint(len(hasil.failures), len(hasil.errors))",
      }),
    ],
  },
  {
    id: "ex-random-math", title: "Random & math", icon: "Calculator", xp: 230, minutes: 7, level: "menengah", sortOrder: 7,
    steps: [
      learn("Angka acak yang bisa diulang", "`random.seed(n)` membuat urutan angka acak deterministik. Ini berguna untuk latihan dan pengujian agar hasilnya sama setiap dijalankan.", `import random

random.seed(42)
a = [random.randint(1, 6) for _ in range(3)]
random.seed(42)
b = [random.randint(1, 6) for _ in range(3)]
print(a == b)`),
      learn("Fungsi math", "`math.gcd()` mencari faktor persekutuan terbesar, `math.factorial()` menghitung faktorial, dan `math.isclose()` membandingkan float dengan toleransi.", `import math

print(math.gcd(48, 18))
print(math.factorial(5))
print(math.isclose(0.1 + 0.2, 0.3))`),
      quiz("Mengapa hasil 0.1 + 0.2 tidak selalu sama persis dengan 0.3?", ["Python salah hitung", "Float punya keterbatasan presisi", "0.3 bukan angka", "Harus pakai int"], 1, "Bilangan desimal disimpan dalam biner, sehingga ada galat pembulatan kecil."),
      code("Print GCD dari 48 dan 18, faktorial 5, lalu apakah 0.1+0.2 mendekati 0.3.", "import math\n", {
        out: "6\n120\nTrue", need: ["gcd", "factorial", "isclose"],
      }, {
        chips: ["math.gcd(48, 18)", "math.factorial(5)", "math.isclose(0.1 + 0.2, 0.3)"],
        hint: "Panggil tiga fungsi math tersebut di dalam print terpisah.",
        solution: "import math\n\nprint(math.gcd(48, 18))\nprint(math.factorial(5))\nprint(math.isclose(0.1 + 0.2, 0.3))",
      }),
      code("Buktikan bahwa seed yang sama menghasilkan urutan acak yang sama: print True.", "import random\n", {
        out: "True", need: ["seed"],
      }, {
        chips: ["random.seed(7)", "random.randint(...)", "a == b"],
        hint: "Buat dua list dengan seed yang sama, lalu bandingkan.",
        solution: "import random\n\nrandom.seed(7)\na = [random.randint(1, 10) for _ in range(3)]\nrandom.seed(7)\nb = [random.randint(1, 10) for _ in range(3)]\nprint(a == b)",
      }),
    ],
  },
]);

export const EXTRA_LESSONS: Lesson[] = [...dasar, ...algoritma, ...pustaka];

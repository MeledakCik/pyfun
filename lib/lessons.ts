import type { CodeStep, DebugStep, DebugTest, Lesson, LearnStep, PredictStep, QuizStep } from "./types";
import { LESSONS_TABLE, supabase } from "./supabase";
import { BONUS_CATALOG, sortBonusLessons } from "./bonus";

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
  code: string,
  extra: { hint?: string; hint2?: string; explain?: string } = {},
): PredictStep => ({ type: "predict", prompt, code, ...extra });
const debug = (
  prompt: string,
  starter: string,
  tests: DebugTest[],
  extra: { hint?: string; hint2?: string; solution?: string } = {},
): DebugStep => ({ type: "debug", prompt, starter, tests, ...extra });

type Def = Omit<Lesson, "source" | "chapter"> & { chapter?: string };
const mk = (chapter: string, defs: Def[]): Lesson[] =>
  defs.map((d) => ({ ...d, chapter, source: "bundled" as const }));

export const CHAPTERS = [
  "Dasar Python",
  "Struktur & Fungsi",
  "String & Koleksi",
  "Fungsi & Modul",
  "Error & OOP",
  "Dasar Python Buku",
  "Kontrol Alur Buku",
  "String & List Buku",
  "Struktur Data Buku",
  "Fungsi Buku",
  "File & Modul Buku",
  "OOP & Error Buku",
  "Algoritma & Math Buku",
  "Topik Lanjut Buku",
  "Python Pro",
  "Algoritma Gacor",
  "Testing & Async",
] as const;

const ch1 = mk(CHAPTERS[0], [
  {
    id: "print", title: "Halo, Dunia", icon: "Terminal", xp: 100, minutes: 3,
    steps: [
      learn("Menampilkan teks", "`print()` menampilkan sesuatu ke layar. Teks harus diapit tanda kutip.", 'print("Halo, dunia!")'),
      quiz("Mana yang menampilkan teks Halo ke layar?", ['print("Halo")', "say Halo", "echo(Halo)", "print Halo"], 0, 'Di Python, fungsi `print()` dengan teks di dalam tanda kutip.'),
      predict("Apa output kode ini?", 'nama = "PyFun"\nprint("Halo,", nama)', {
        hint: "`print()` menampilkan setiap argumen secara berurutan.",
        hint2: 'Argumen pertama "Halo," dan argumen kedua `nama` dipisahkan satu spasi.',
        explain: "Output-nya `Halo, PyFun`.",
      }),
      learn("Komentar", "Baris yang diawali `#` diabaikan Python. Gunakan untuk catatan.", '# ini komentar\nprint("ini tampil")'),
      code("Tampilkan tepat: Halo, PyFun!", "# tulis kodemu di bawah\n", { out: "Halo, PyFun!" }, {
        chips: ["print()", '"Halo, PyFun!"'], hint: 'Pakai print("...") dengan teks persis seperti di soal.', solution: 'print("Halo, PyFun!")',
      }),
    ],
  },
  {
    id: "variabel", title: "Variabel & data", icon: "Package", xp: 120, minutes: 4,
    steps: [
      learn("Variabel", "Variabel adalah wadah bernama untuk menyimpan nilai. Tulis `nama = nilai`.", 'umur = 17\nnama = "Rani"\nprint(nama, umur)'),
      learn("Tipe data", "Ada `str` (teks), `int` (bilangan bulat), `float` (desimal), dan `bool` (True/False). Cek dengan `type()`.", "print(type(3.14))"),
      quiz("Tipe data dari 42 adalah…", ["str", "int", "float", "bool"], 1, "42 adalah bilangan bulat, jadi `int`."),
      quiz('Tipe data dari "42" (pakai kutip) adalah…', ["int", "float", "str", "bool"], 2, "Apa pun yang diapit kutip adalah teks (`str`)."),
      code("Buat variabel kota berisi Bandung, lalu print isinya.", "", { out: "Bandung", need: ["kota\\s*="] }, {
        chips: ["kota =", '"Bandung"', "print(kota)"], hint: 'kota = "Bandung" lalu print(kota)', solution: 'kota = "Bandung"\nprint(kota)',
      }),
    ],
  },
  {
    id: "operator", title: "Hitung-hitungan", icon: "Calculator", xp: 120, minutes: 4,
    steps: [
      learn("Operator", "`+ - * /` untuk hitung biasa. `//` pembagian bulat, `%` sisa bagi, `**` pangkat.", "print(7 // 2)\nprint(7 % 2)\nprint(2 ** 3)"),
      quiz("Hasil dari 10 % 3 adalah…", ["3", "1", "0", "3.33"], 1, "10 dibagi 3 = 3 sisa 1, jadi `%` menghasilkan 1."),
      quiz("Hasil dari 2 ** 4 adalah…", ["8", "6", "16", "24"], 2, "`**` adalah pangkat: 2 × 2 × 2 × 2 = 16."),
      code("Hitung luas persegi panjang 8 × 5 dan print hasilnya.", "panjang = 8\nlebar = 5\n", { out: "40" }, {
        chips: ["print()", "panjang * lebar"], hint: "Kalikan panjang dengan lebar di dalam print().", solution: "print(panjang * lebar)",
      }),
    ],
  },
  {
    id: "kondisi", title: "Kondisi if / else", icon: "GitBranch", xp: 150, minutes: 5,
    steps: [
      learn("Mengambil keputusan", "`if` menjalankan kode hanya jika kondisinya benar. Perhatikan titik dua dan indentasi (4 spasi).", 'nilai = 80\nif nilai >= 75:\n    print("Lulus")\nelse:\n    print("Remedial")'),
      learn("Perbandingan", "`==` sama dengan, `!=` tidak sama, `>` `<` `>=` `<=`. Jangan tertukar dengan `=` yang artinya mengisi variabel.", undefined),
      quiz("Untuk mengecek apakah x sama dengan 5, tulis…", ["x = 5", "x == 5", "x => 5", "x equals 5"], 1, "`==` membandingkan, `=` mengisi nilai."),
      code("Jika suhu lebih dari 30 print Panas, selain itu print Sejuk.", "suhu = 34\n", { out: "Panas", need: ["if\\s", "else"] }, {
        chips: ["if", "else:", "print()"], hint: "if suhu > 30: …", solution: 'if suhu > 30:\n    print("Panas")\nelse:\n    print("Sejuk")',
      }),
    ],
  },
  {
    id: "loop", title: "Loop & perulangan", icon: "Repeat", xp: 150, minutes: 5,
    steps: [
      learn("for", "`for` mengulang kode. `range(n)` menghasilkan 0 sampai n-1.", "for i in range(3):\n    print(i)"),
      learn("while", "`while` mengulang selama kondisinya benar. Pastikan ada yang membuatnya berhenti.", "n = 3\nwhile n > 0:\n    print(n)\n    n -= 1"),
      quiz("range(4) menghasilkan angka…", ["1 2 3 4", "0 1 2 3", "0 1 2 3 4", "1 2 3"], 1, "`range(4)` mulai dari 0 dan berhenti sebelum 4."),
      code("Print angka 1 sampai 5, masing-masing di baris sendiri.", "", { out: "1\n2\n3\n4\n5", need: ["for\\s|while\\s"] }, {
        chips: ["for i in range(1, 6):", "print(i)"], hint: "range(1, 6) menghasilkan 1 sampai 5.", solution: "for i in range(1, 6):\n    print(i)",
      }),
      debug(
        "Fungsi berikut seharusnya menjumlahkan angka 1 sampai n. Perbaiki bug-nya.",
        "def jumlah_sampai(n):\n    total = 0\n    for i in range(1, n):\n        total += i\n    return total\n",
        [
          { label: "jumlah_sampai(3) → 6", code: "print(jumlah_sampai(3))", expected: "6" },
          { label: "jumlah_sampai(5) → 15", code: "print(jumlah_sampai(5))", expected: "15" },
        ],
        {
          hint: "Perhatikan batas `range(1, n)`.",
          hint2: "`range` berhenti sebelum argumen kedua, jadi `n` belum ikut dijumlahkan.",
          solution: "def jumlah_sampai(n):\n    total = 0\n    for i in range(1, n + 1):\n        total += i\n    return total",
        },
      ),
    ],
  },
  {
    id: "boss-1", title: "Boss: FizzBuzz", icon: "Skull", xp: 300, minutes: 8, boss: true,
    steps: [
      learn("Tantangan boss", "Gabungkan loop, kondisi, dan operator `%`. Angka yang habis dibagi 3 diganti `Fizz`, habis dibagi 5 diganti `Buzz`, habis dibagi keduanya `FizzBuzz`."),
      quiz("Angka 15 habis dibagi 3 dan 5. Hasil 15 % 3 adalah…", ["5", "3", "0", "1"], 2, "Habis dibagi artinya sisa bagi = 0."),
      code("Untuk angka 1 sampai 15 print aturan FizzBuzz (angka lain tetap dicetak).", "", {
        out: "1\n2\nFizz\n4\nBuzz\nFizz\n7\n8\nFizz\nBuzz\n11\nFizz\n13\n14\nFizzBuzz", need: ["for\\s", "%"],
      }, {
        hint: "Cek kelipatan 15 lebih dulu, baru 3, lalu 5.",
        solution: 'for i in range(1, 16):\n    if i % 15 == 0:\n        print("FizzBuzz")\n    elif i % 3 == 0:\n        print("Fizz")\n    elif i % 5 == 0:\n        print("Buzz")\n    else:\n        print(i)',
      }),
    ],
  },
]);

const ch2 = mk(CHAPTERS[1], [
  {
    id: "list", title: "List", icon: "List", xp: 150, minutes: 5,
    steps: [
      learn("Daftar nilai", "List menyimpan banyak nilai berurutan. Indeks mulai dari 0.", 'buah = ["apel", "jeruk", "mangga"]\nprint(buah[0])\nbuah.append("pisang")\nprint(len(buah))'),
      quiz('Jika buah = ["apel", "jeruk", "mangga"], maka buah[1] adalah…', ["apel", "jeruk", "mangga", "error"], 1, "Indeks mulai dari 0, jadi indeks 1 adalah elemen kedua."),
      code("Tambahkan 40 ke list nilai, lalu print panjang list.", "nilai = [10, 20, 30]\n", { out: "4", need: ["append"] }, {
        chips: [".append()", "len()"], hint: "nilai.append(40) lalu print(len(nilai))", solution: "nilai.append(40)\nprint(len(nilai))",
      }),
      code("Print jumlah semua angka di list angka.", "angka = [4, 8, 15, 16, 23, 42]\n", { out: "108" }, {
        hint: "Pakai sum(angka) atau loop.", solution: "print(sum(angka))",
      }),
    ],
  },
  {
    id: "dict", title: "Dictionary", icon: "BookOpen", xp: 150, minutes: 5,
    steps: [
      learn("Pasangan kunci-nilai", "Dictionary menyimpan data berpasangan: `kunci: nilai`. Ambil nilai lewat kuncinya.", 'siswa = {"nama": "Rani", "umur": 16}\nprint(siswa["nama"])\nsiswa["kelas"] = "10A"'),
      quiz('Cara mengambil nilai "nama" dari dictionary siswa:', ['siswa.nama', 'siswa["nama"]', 'siswa(nama)', 'siswa[0]'], 1, "Dictionary diakses lewat kunci di dalam kurung siku."),
      code("Print poin milik Budi dari dictionary skor.", 'skor = {"Ani": 80, "Budi": 95}\n', { out: "95" }, {
        hint: 'skor["Budi"]', solution: 'print(skor["Budi"])',
      }),
    ],
  },
  {
    id: "fungsi", title: "Fungsi", icon: "Braces", xp: 180, minutes: 6,
    steps: [
      learn("Membuat fungsi", "`def` membuat blok kode yang bisa dipakai ulang. `return` mengirim hasil keluar.", "def sapa(nama):\n    return \"Halo, \" + nama\n\nprint(sapa(\"Rani\"))"),
      quiz("Kata kunci untuk membuat fungsi di Python:", ["function", "def", "fn", "func"], 1, "Python memakai `def`."),
      code("Buat fungsi kuadrat(n) yang mengembalikan n × n, lalu print kuadrat(7).", "", { out: "49", need: ["def\\s+kuadrat", "return"] }, {
        chips: ["def kuadrat(n):", "return", "print()"], hint: "return n * n", solution: "def kuadrat(n):\n    return n * n\n\nprint(kuadrat(7))",
      }),
    ],
  },
  {
    id: "boss-2", title: "Boss: Statistik mini", icon: "Skull", xp: 350, minutes: 8, boss: true,
    steps: [
      learn("Tantangan boss", "Gabungkan list, loop, dan fungsi. Buat fungsi yang menghitung rata-rata dari sebuah list."),
      code("Buat fungsi rata_rata(data) lalu print rata_rata([70, 80, 90, 100]).", "", { out: "85.0", need: ["def\\s+rata_rata"] }, {
        hint: "sum(data) / len(data)", solution: "def rata_rata(data):\n    return sum(data) / len(data)\n\nprint(rata_rata([70, 80, 90, 100]))",
      }),
      code("Print angka tertinggi dari [12, 45, 7, 88, 23].", "", { out: "88" }, {
        hint: "Ada fungsi bawaan max().", solution: "print(max([12, 45, 7, 88, 23]))",
      }),
    ],
  },
]);

const ch3 = mk(CHAPTERS[2], [
  {
    id: "string", title: "String & slicing", icon: "Type", xp: 150, minutes: 5,
    steps: [
      learn("String adalah urutan karakter", "Setiap karakter punya indeks mulai dari 0. Indeks negatif menghitung dari belakang.", `teks = "PyFun"
print(teks[0])
print(teks[-1])
print(teks[0:3])`),
      learn("Metode string", "String punya metode bawaan seperti `.upper()`, `.lower()`, `.strip()`, dan `.replace()`. Metode mengembalikan string baru.", `teks = "  pyfun  "
print(teks.strip())
print(teks.strip().upper())
print("pyfun".replace("py", "Py"))`),
      quiz('Hasil dari "Python"[1:4] adalah…', ["Pyt", "yth", "ytho", "tho"], 1, "Slicing 1:4 mengambil indeks 1, 2, dan 3 (berhenti sebelum 4)."),
      code("Bersihkan spasi di awal/akhir teks, ubah menjadi huruf besar, lalu print hasilnya.", 'teks = "  pyfun  "\n', { out: "PYFUN", need: ["strip", "upper"] }, {
        chips: [".strip()", ".upper()", "print()"], hint: "Gabungkan teks.strip().upper() di dalam print().", solution: 'print(teks.strip().upper())',
      }),
    ],
  },
  {
    id: "string-format", title: "f-string & format", icon: "Type", xp: 160, minutes: 5,
    steps: [
      learn("f-string", "Awali string dengan `f`, lalu tulis variabel di dalam `{}`. Kamu juga bisa menaruh ekspresi langsung.", `nama = "Rani"
skor = 87.5
print(f"{nama} mendapat {skor} poin")`),
      learn("Mengatur format angka", "Tambahkan `:.2f` untuk dua angka di belakang koma, atau `:>5` untuk mengatur lebar teks.", `print(f"{3.14159:.2f}")
print(f"{7:>3}")`),
      quiz('Hasil dari f"{3.14159:.2f}" adalah…', ["3.14", "3.142", "3.1", "3.14159"], 0, "`:.2f` membulatkan ke dua angka di belakang koma."),
      code("Print nama dan skor dengan format: Rani mendapat 87.5 poin", 'nama = "Rani"\nskor = 87.5\n', { out: "Rani mendapat 87.5 poin", need: ["f[\"']"] }, {
        chips: ["f\"...\"", "{nama}", "{skor:.1f}"], hint: 'Pakai print(f"{nama} mendapat {skor:.1f} poin").', solution: 'print(f"{nama} mendapat {skor:.1f} poin")',
      }),
    ],
  },
  {
    id: "tuple-set", title: "Tuple & set", icon: "Package", xp: 160, minutes: 5,
    steps: [
      learn("Tuple", "Tuple seperti list, tapi isinya tidak bisa diubah. Cocok untuk data yang tetap. Kamu bisa membongkar isinya (unpacking).", `koordinat = (10, 20)
x, y = koordinat
print(x, y)`),
      learn("Set", "Set menyimpan nilai unik tanpa urutan. Gunakan `set()` untuk membuang duplikat, lalu `sorted()` jika ingin urut.", `angka = [1, 2, 2, 3, 1]
unik = set(angka)
print(unik)
print(sorted(unik))`),
      quiz("Berapa hasil dari len(set([1, 1, 2, 3, 3]))?", ["2", "3", "5", "6"], 1, "Set membuang duplikat, jadi tersisa 1, 2, dan 3."),
      code("Print nilai unik dari list angka dalam urutan menaik.", "angka = [3, 1, 3, 2, 1]\n", { out: "[1, 2, 3]", need: ["set"] }, {
        chips: ["set(angka)", "sorted()", "print()"], hint: "print(sorted(set(angka)))", solution: "print(sorted(set(angka)))",
      }),
    ],
  },
  {
    id: "list-methods", title: "List lanjutan", icon: "List", xp: 180, minutes: 6,
    steps: [
      learn("Metode list", "`append` menambah di akhir, `insert` di posisi tertentu, `remove` menghapus nilai, dan `sort` mengurutkan list.", `nilai = [75, 60, 90]
nilai.append(85)
nilai.insert(0, 100)
nilai.remove(60)
nilai.sort(reverse=True)
print(nilai)`),
      learn("Slicing list", "Slicing memakai `[mulai:berhenti:langkah]`. Langkah negatif membalik urutan.", `huruf = ["a", "b", "c", "d"]
print(huruf[1:3])
print(huruf[::-1])`),
      quiz("Setelah a = [3, 1, 2]; a.sort(); print(a) menghasilkan…", ["[3, 1, 2]", "[1, 2, 3]", "None", "Error"], 1, "`sort()` mengurutkan list di tempat, lalu `print(a)` menampilkan hasilnya."),
      code("Urutkan nilai dari besar ke kecil, lalu print list-nya.", "nilai = [75, 90, 60, 85]\n", { out: "[90, 85, 75, 60]", need: ["sort", "reverse"] }, {
        chips: [".sort()", "reverse=True", "print()"], hint: "nilai.sort(reverse=True) lalu print(nilai).", solution: "nilai.sort(reverse=True)\nprint(nilai)",
      }),
    ],
  },
  {
    id: "boss-3", title: "Boss: Hitung kata", icon: "Skull", xp: 350, minutes: 9, boss: true,
    steps: [
      learn("Tantangan boss", "Gabungkan `split()`, `set`, `sorted`, dan dictionary. `split()` memecah kalimat menjadi list kata.", `kalimat = "apel jeruk apel"
kata = kalimat.split()
print(kata)
print(len(kata))
print("-".join(kata))`),
      quiz('Hasil dari "a b a".split() adalah…', ['["a", "b", "a"]', '"a b a"', '["a b a"]', "3"], 0, "`split()` tanpa argumen memecah berdasarkan spasi."),
      code("Print kata unik dari teks dalam urutan abjad.", 'teks = "apel jeruk apel mangga jeruk"\n', { out: "['apel', 'jeruk', 'mangga']", need: ["set", "sorted"] }, {
        chips: ["teks.split()", "set()", "sorted()"], hint: "print(sorted(set(teks.split())))", solution: "print(sorted(set(teks.split())))",
      }),
      code("Hitung kemunculan tiap kata, lalu print kata dan jumlahnya secara urut abjad.", 'teks = "apel jeruk apel mangga jeruk"\n', {
        out: "apel 2\njeruk 2\nmangga 1", need: ["for", "sorted"],
      }, {
        hint: "Buat dictionary frekuensi, isi dengan perulangan, lalu print sorted(frekuensi).",
        solution: 'frekuensi = {}\nfor kata in teks.split():\n    frekuensi[kata] = frekuensi.get(kata, 0) + 1\n\nfor kata in sorted(frekuensi):\n    print(kata, frekuensi[kata])',
      }),
    ],
  },
]);

const ch4 = mk(CHAPTERS[3], [
  {
    id: "fungsi-default", title: "Parameter default", icon: "Braces", xp: 180, minutes: 6,
    steps: [
      learn("Parameter default", "Parameter bisa punya nilai bawaan. Kalau tidak diisi, Python memakai nilai default. Kamu juga bisa memanggil dengan nama parameter.", `def sapa(nama, sapaan="Halo"):
    return f"{sapaan}, {nama}!"

print(sapa("Ani"))
print(sapa("Budi", sapaan="Hai"))`),
      quiz("Manakah definisi fungsi dengan parameter default yang benar?", ["def f(x=1):", "def f(x): = 1", "def f(x =):", "f(x=1)"], 0, "Nilai default ditulis langsung setelah nama parameter."),
      code("Lengkapi fungsi pangkat agar mengembalikan angka pangkat eksponen.", `def pangkat(angka, eksponen=2):
    # kembalikan angka pangkat eksponen
    pass


print(pangkat(5))
print(pangkat(2, 3))`, { out: "25\n8", need: ["return"] }, {
        chips: ["return", "angka ** eksponen"], hint: "return angka ** eksponen", solution: "def pangkat(angka, eksponen=2):\n    return angka ** eksponen\n\n\nprint(pangkat(5))\nprint(pangkat(2, 3))",
      }),
    ],
  },
  {
    id: "args-kwargs", title: "Args & kwargs", icon: "Braces", xp: 200, minutes: 6,
    steps: [
      learn("*args dan **kwargs", "`*args` menampung banyak argumen posisional sebagai tuple. `**kwargs` menampung argumen bernama sebagai dictionary.", `def jumlah(*angka):
    return sum(angka)

def info(**data):
    for kunci, nilai in data.items():
        print(kunci, nilai)

print(jumlah(1, 2, 3))
info(nama="Rani", umur=16)`),
      quiz("*args menampung argumen dalam bentuk…", ["list", "tuple", "dict", "set"], 1, "Argumen posisional tambahan dikumpulkan menjadi tuple."),
      code("Lengkapi fungsi rata_rata agar menerima banyak angka dan mengembalikan rata-ratanya.", `def rata_rata(*angka):
    # jumlahkan lalu bagi dengan banyaknya angka
    pass


print(rata_rata(10, 20, 30))`, { out: "20.0", need: ["sum", "len"] }, {
        chips: ["sum(angka)", "len(angka)", "return"], hint: "return sum(angka) / len(angka)", solution: "def rata_rata(*angka):\n    return sum(angka) / len(angka)\n\n\nprint(rata_rata(10, 20, 30))",
      }),
    ],
  },
  {
    id: "lambda", title: "Lambda & filter", icon: "Code2", xp: 200, minutes: 6,
    steps: [
      learn("Lambda", "Lambda adalah fungsi kecil tanpa nama. Cocok dipakai sekali bersama `filter()` atau `map()`.", `angka = [1, 2, 3, 4, 5]
genap = list(filter(lambda x: x % 2 == 0, angka))
kuadrat = list(map(lambda x: x * x, angka))
print(genap)
print(kuadrat)`),
      quiz("Hasil list(map(lambda x: x * 2, [1, 2, 3])) adalah…", ["[1, 2, 3]", "[2, 4, 6]", "[1, 4, 9]", "[3, 6, 9]"], 1, "`map()` menerapkan fungsi ke setiap elemen."),
      code("Print kuadrat dari angka ganjil saja.", "angka = [1, 2, 3, 4, 5, 6]\n", { out: "[1, 9, 25]", need: ["filter\\s*\\(|\\bfor\\b"] }, {
        chips: ["filter()", "map()", "lambda x: x * x"], hint: "Filter angka ganjil dulu, lalu map ke kuadrat.",
        solution: "hasil = list(map(lambda x: x * x, filter(lambda x: x % 2 == 1, angka)))\nprint(hasil)",
      }),
    ],
  },
  {
    id: "scope-import", title: "Scope & modul", icon: "Globe", xp: 200, minutes: 6,
    steps: [
      learn("Scope variabel", "Variabel di dalam fungsi bersifat lokal. Mengubahnya tidak otomatis mengubah variabel di luar fungsi.", `x = 10

def ubah():
    x = 5
    print("dalam", x)

ubah()
print("luar", x)`),
      learn("Modul", "Modul adalah kumpulan fungsi siap pakai. Contohnya `math` untuk perhitungan matematika.", `import math
print(math.sqrt(81))
print(math.floor(3.9))`),
      quiz("math.sqrt(49) menghasilkan…", ["7", "7.0", "24.5", "49"], 1, "`math.sqrt()` mengembalikan float, jadi hasilnya 7.0."),
      code("Print nilai pi yang dibulatkan ke 2 desimal, lalu print ceil dari 4.1.", "import math\n", { out: "3.14\n5", need: ["ceil", "round\\s*\\(|:\\.2f|format\\s*\\("] }, {
        chips: ["round(math.pi, 2)", "math.ceil(4.1)", "print()"], hint: "print(round(math.pi, 2)) lalu print(math.ceil(4.1)).", solution: "print(round(math.pi, 2))\nprint(math.ceil(4.1))",
      }),
    ],
  },
  {
    id: "boss-4", title: "Boss: Kalkulator fungsi", icon: "Skull", xp: 400, minutes: 9, boss: true,
    steps: [
      learn("Fungsi sebagai nilai", "Di Python, fungsi bisa disimpan di variabel dan dikirim sebagai argumen ke fungsi lain.", `def hitung(a, b, operasi):
    return operasi(a, b)

print(hitung(6, 3, lambda a, b: a + b))
print(hitung(6, 3, lambda a, b: a * b))`),
      quiz("Pada hitung(6, 3, lambda a, b: a * b), parameter operasi berisi…", ["hasil 18", "fungsi lambda", "angka 6", "string kali"], 1, "Fungsi lambda dikirim sebagai nilai ke parameter `operasi`."),
      code("Lengkapi kalkulator: tambah, kali, dan operasi lain mengembalikan 0.", `def kalkulator(a, b, operasi="tambah"):
    # tambah -> a + b, kali -> a * b, selain itu -> 0
    pass


print(kalkulator(8, 4))
print(kalkulator(8, 4, "kali"))
print(kalkulator(8, 4, "bagi"))`, { out: "12\n32\n0", need: ["if", "return"] }, {
        hint: "Gunakan if/elif untuk memilih operasi, lalu return hasilnya.", solution: 'def kalkulator(a, b, operasi="tambah"):\n    if operasi == "tambah":\n        return a + b\n    if operasi == "kali":\n        return a * b\n    return 0\n\n\nprint(kalkulator(8, 4))\nprint(kalkulator(8, 4, "kali"))\nprint(kalkulator(8, 4, "bagi"))',
      }),
    ],
  },
]);

const ch5 = mk(CHAPTERS[4], [
  {
    id: "try-except", title: "Try & except", icon: "GitBranch", xp: 200, minutes: 6,
    steps: [
      learn("Menangkap error", "Kode yang berisiko error diletakkan di `try`. Kalau error terjadi, blok `except` yang sesuai akan dijalankan.", `try:
    angka = int("abc")
except ValueError:
    print("Bukan angka")`),
      learn("ZeroDivisionError", "Setiap jenis error punya nama. Membagi dengan nol memicu `ZeroDivisionError`.", `try:
    print(10 / 0)
except ZeroDivisionError:
    print("Tidak bisa dibagi nol")`),
      quiz('int("abc") memicu exception…', ["ValueError", "TypeError", "ZeroDivisionError", "KeyError"], 0, "Teks yang bukan angka tidak bisa diubah menjadi int."),
      code("Lengkapi fungsi bagi agar mengembalikan hasil pembagian, atau None jika pembagi nol.", `def bagi(a, b):
    try:
        # kembalikan hasil pembagian
        pass
    except ZeroDivisionError:
        return None


print(bagi(10, 2))
print(bagi(10, 0))`, { out: "5.0\nNone", need: ["try", "except"] }, {
        chips: ["try:", "return a / b", "except ZeroDivisionError:"], hint: "return a / b di dalam try.", solution: "def bagi(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return None\n\n\nprint(bagi(10, 2))\nprint(bagi(10, 0))",
      }),
    ],
  },
  {
    id: "raise-finally", title: "Raise & finally", icon: "GitBranch", xp: 220, minutes: 6,
    steps: [
      learn("Melempar error sendiri", "`raise` membuat error secara sengaja. `finally` selalu dijalankan, baik terjadi error maupun tidak.", `def cek_umur(umur):
    if umur < 0:
        raise ValueError("Umur tidak boleh negatif")
    return umur

try:
    cek_umur(-1)
except ValueError as e:
    print(e)
finally:
    print("Selesai")`),
      quiz("Blok yang selalu dijalankan, baik terjadi error maupun tidak, adalah…", ["try", "except", "finally", "raise"], 2, "`finally` dipakai untuk pembersihan yang harus selalu jalan."),
      code("Buat validasi(nilai) yang raise ValueError('Nilai negatif') jika nilai < 0. Panggil dengan -5, tangkap error-nya, lalu print Selesai di finally.", "", { out: "Nilai negatif\nSelesai", need: ["raise", "except", "finally"] }, {
        chips: ["raise ValueError(...)", "try:", "except ValueError as e:", "finally:"],
        hint: "Di dalam try panggil validasi(-5); di except print pesan error; di finally print 'Selesai'.",
        solution: 'def validasi(nilai):\n    if nilai < 0:\n        raise ValueError("Nilai negatif")\n    return nilai\n\n\ntry:\n    validasi(-5)\nexcept ValueError as e:\n    print(e)\nfinally:\n    print("Selesai")',
      }),
    ],
  },
  {
    id: "class-object", title: "Class & objek", icon: "Package", xp: 240, minutes: 7,
    steps: [
      learn("Class dan objek", "Class adalah cetakan untuk membuat objek. `__init__` dijalankan saat objek dibuat, dan `self` merujuk ke objek itu.", `class Siswa:
    def __init__(self, nama, nilai):
        self.nama = nama
        self.nilai = nilai

    def lulus(self):
        return self.nilai >= 75


s = Siswa("Rani", 80)
print(s.nama)
print(s.lulus())`),
      quiz("Dalam method, self merujuk pada…", ["class", "objek/instance", "module", "nilai return"], 1, "`self` adalah referensi ke objek yang sedang memakai method."),
      code("Tambahkan method lulus() yang mengembalikan True jika nilai >= 75, selain itu False.", `class Siswa:
    def __init__(self, nama, nilai):
        self.nama = nama
        self.nilai = nilai

    # tambahkan method lulus di sini


s = Siswa("Budi", 68)
print(s.lulus())`, { out: "False", need: ["def\\s+lulus", "self\\.nilai"] }, {
        chips: ["def lulus(self):", "return self.nilai >= 75"], hint: "return self.nilai >= 75", solution: 'class Siswa:\n    def __init__(self, nama, nilai):\n        self.nama = nama\n        self.nilai = nilai\n\n    def lulus(self):\n        return self.nilai >= 75\n\n\ns = Siswa("Budi", 68)\nprint(s.lulus())',
      }),
    ],
  },
  {
    id: "inheritance", title: "Inheritance", icon: "GitBranch", xp: 240, minutes: 7,
    steps: [
      learn("Mewarisi class", "Class anak bisa mewarisi method class induk. Tulis nama induk di dalam tanda kurung, lalu gunakan `super()` untuk memanggil versi induk.", `class Hewan:
    def suara(self):
        return "Suara hewan"


class Kucing(Hewan):
    def suara(self):
        return "Meong"


print(Kucing().suara())`),
      quiz("class Kucing(Hewan) berarti…", ["Kucing menyalin file Hewan", "Kucing mewarisi Hewan", "Hewan mewarisi Kucing", "Kucing dan Hewan sama"], 1, "Class di dalam kurung adalah induk yang diwarisi."),
      code("Lengkapi method info() di Mobil agar memakai super().info().", `class Kendaraan:
    def info(self):
        return "Kendaraan"


class Mobil(Kendaraan):
    def info(self):
        # gunakan super().info()
        pass


print(Mobil().info())`, { out: "Mobil: Kendaraan", need: ["super\\s*\\("] }, {
        chips: ['return "Mobil: " + super().info()'], hint: 'return "Mobil: " + super().info()', solution: 'class Kendaraan:\n    def info(self):\n        return "Kendaraan"\n\n\nclass Mobil(Kendaraan):\n    def info(self):\n        return "Mobil: " + super().info()\n\n\nprint(Mobil().info())',
      }),
    ],
  },
  {
    id: "boss-5", title: "Boss: Rekening", icon: "Skull", xp: 450, minutes: 10, boss: true,
    steps: [
      learn("Tantangan boss", "Gabungkan class, method, kondisi, dan exception. Method `tarik()` harus menolak penarikan yang melebihi saldo.", `class Rekening:
    def __init__(self, saldo):
        self.saldo = saldo

    def tarik(self, jumlah):
        if jumlah > self.saldo:
            raise ValueError("Saldo tidak cukup")
        self.saldo -= jumlah`),
      quiz("Exception yang cocok saat saldo tidak cukup adalah…", ["ValueError", "KeyError", "TypeError", "IndexError"], 0, "Nilai penarikan tidak valid untuk saldo saat ini, jadi gunakan `ValueError`."),
      code("Lengkapi method tarik(): raise ValueError jika jumlah melebihi saldo, kurangi saldo jika cukup.", `class Rekening:
    def __init__(self, saldo):
        self.saldo = saldo

    def tarik(self, jumlah):
        # raise ValueError("Saldo tidak cukup") jika jumlah > saldo
        # kurangi saldo jika cukup
        pass


r = Rekening(100000)
try:
    r.tarik(150000)
except ValueError as e:
    print(e)

r.tarik(30000)
print(r.saldo)`, { out: "Saldo tidak cukup\n70000", need: ["raise", "self\\.saldo"] }, {
        hint: "Cek jumlah > self.saldo, raise ValueError, lalu self.saldo -= jumlah.",
        solution: 'class Rekening:\n    def __init__(self, saldo):\n        self.saldo = saldo\n\n    def tarik(self, jumlah):\n        if jumlah > self.saldo:\n            raise ValueError("Saldo tidak cukup")\n        self.saldo -= jumlah\n\n\nr = Rekening(100000)\ntry:\n    r.tarik(150000)\nexcept ValueError as e:\n    print(e)\n\nr.tarik(30000)\nprint(r.saldo)',
      }),
    ],
  },
]);
// ============================================================
// BUKU HEINOLD — PART 1
// ============================================================
const ch6 = mk(CHAPTERS[5], [
  { id: "bk-print-var", title: "Print & variabel", icon: "Terminal", xp: 120, minutes: 4, steps: [
    learn("print dan variabel", "print() menampilkan teks. Variabel menyimpan nilai dengan =. Nama tidak boleh diawali angka.", "nama = 'Rani'\nprint(nama)\numur = 16\nprint(umur + 1)"),
    quiz("Cara menyimpan 16 ke variabel umur?", ["umur = 16", "16 = umur", "umur == 16", "let umur = 16"], 0, "Tanda = mengisi; == membandingkan."),
    code("Print isi variabel kota.", "", { out: "Bandung" }, { solution: "kota = 'Bandung'\nprint(kota)" }),
  ]},
  { id: "bk-input-typecast", title: "Input & konversi", icon: "Package", xp: 120, minutes: 5, steps: [
    learn("input() selalu string", "input() mengembalikan teks. Ubah dengan int() atau float() untuk berhitung. type() melihat tipe.", "angka = int(input('Angka: '))\nprint(angka + 1)\nprint(type(angka))"),
    quiz("int('12') + 3 = ?", ["123", "15", "12", "Error"], 1, "int('12') jadi 12, tambah 3 = 15."),
    code("Ubah teks '42' ke int, tambah 8, print.", "teks = '42'\n", { out: "50", need: ["int"] }, { solution: "print(int(teks) + 8)" }),
  ]},
  { id: "bk-identifier", title: "Identifier & komentar", icon: "Code2", xp: 110, minutes: 4, steps: [
    learn("Aturan nama", "Identifier tidak boleh diawali angka atau ada spasi/simbol. Komentar diawali #.", "# ini komentar\nnilai_siswa = 10\nprint(nilai_siswa)"),
    quiz("Identifier valid?", ["1nilai", "nilai_1", "nilai 1", "nilai!"], 1, "Boleh huruf, angka, underscore. Tidak diawali angka."),
  ]},
  { id: "bk-operator-arit", title: "Operator aritmatika", icon: "Calculator", xp: 120, minutes: 5, steps: [
    learn("// % **", "// pembagian bulat, % sisa bagi, ** pangkat. Urutan: ** dulu, lalu * / // %, terakhir + -.", "print(7 // 2)\nprint(7 % 2)\nprint(2 ** 3)"),
    quiz("7 // 2 = ?", ["3.5", "3", "4", "1"], 1, "// membuang bagian desimal."),
    code("Print 17 // 5 lalu 17 % 5.", "", { out: "3\n2" }, { solution: "print(17 // 5)\nprint(17 % 5)" }),
  ]},
  { id: "bk-operator-logika", title: "Operator logika", icon: "GitBranch", xp: 130, minutes: 5, steps: [
    learn("and, or, not", "and benar jika keduanya benar, or benar jika salah satu, not membalik. Perbandingan berantai 1 < x < 10 valid.", "x = 5\nprint(1 < x < 10)\nprint(x == 5 and x != 0)\nprint(not False)"),
    quiz("True and not False = ?", ["True", "False", "None", "Error"], 0, "not False = True; True and True = True."),
    code("Print 3 < 5 and 5 < 10.", "", { out: "True", need: ["and"] }, { solution: "print(3 < 5 and 5 < 10)" }),
  ]},
  { id: "bk-tipe-data", title: "Tipe data", icon: "Package", xp: 130, minutes: 5, steps: [
    learn("int, float, str, bool", "int bilangan bulat, float desimal, str teks, bool True/False. Cek dengan type().", "print(type(42))\nprint(type(3.14))\nprint(type('teks'))\nprint(type(True))"),
    quiz("Tipe 3.14?", ["int", "float", "str", "bool"], 1, "Angka dengan titik desimal bertipe float."),
  ]},
  { id: "bk-casting", title: "Type casting", icon: "Package", xp: 120, minutes: 4, steps: [
    learn("Konversi tipe", "int() ke bilangan bulat, float() ke desimal, str() ke teks. int('3.9') gagal; pakai int(float('3.9')) → 3.", "print(int('12') + 3)\nprint(int(float('3.9')))"),
    quiz("Hasil int('12') + 3?", ["123", "15", "12", "Error"], 1, "int('12') jadi 12, tambah 3 = 15."),
  ]},
]);

const ch7 = mk(CHAPTERS[6], [
  { id: "bk-if", title: "If dasar", icon: "GitBranch", xp: 130, minutes: 5, steps: [
    learn("if dan indentasi", "if menjalankan blok hanya jika benar. Blok diindentasi 4 spasi, akhiri baris if dengan titik dua.", "nilai = 80\nif nilai >= 75:\n    print('Lulus')"),
    quiz("Cek x sama dengan 5?", ["x = 5", "x == 5", "x => 5", "x equals 5"], 1, "== membandingkan, = mengisi."),
  ]},
  { id: "bk-if-else", title: "If-else & elif", icon: "GitBranch", xp: 140, minutes: 5, steps: [
    learn("else dan elif", "else dijalankan jika if salah. elif dicek berurutan sampai salah satu benar.", "nilai = 85\nif nilai >= 90:\n    print('A')\nelif nilai >= 80:\n    print('B')\nelse:\n    print('C')"),
    quiz("nilai = 85, blok mana?", ["if >= 90", "elif >= 80", "else", "semua"], 1, "85 tidak >= 90, tapi >= 80."),
  ]},
  { id: "bk-nested-if", title: "Nested if", icon: "GitBranch", xp: 130, minutes: 5, steps: [
    learn("if dalam if", "Nested if menaruh if di dalam if. Setiap level menambah indentasi 4 spasi.", "umur = 20\nif umur >= 17:\n    if umur < 60:\n        print('Dewasa muda')"),
    quiz("Nested if artinya?", ["if di luar fungsi", "if di dalam if", "if tanpa else", "if banyak elif"], 1, "if di dalam blok if lain."),
  ]},
  { id: "bk-for", title: "For & range", icon: "Repeat", xp: 140, minutes: 5, steps: [
    learn("for dan range", "range(n) = 0 sampai n-1. range(a, b) mulai a sampai b-1. range(a, b, step) melompat step.", "for i in range(3):\n    print(i)\nfor i in range(1, 6, 2):\n    print(i)"),
    quiz("range(4) = ?", ["1 2 3 4", "0 1 2 3", "0 1 2 3 4", "1 2 3"], 1, "range(4) dari 0 sampai sebelum 4."),
  ]},
  { id: "bk-nested-for", title: "Nested for & pola", icon: "Repeat", xp: 150, minutes: 6, steps: [
    learn("Loop di dalam loop", "Loop dalam menyelesaikan semua putaran untuk tiap putaran luar. Cocok untuk tabel dan pola bintang.", "for i in range(1, 4):\n    for j in range(1, 4):\n        print(i, j)\nfor i in range(1, 4):\n    print('*' * i)"),
    quiz("3 luar × 4 dalam = ?", ["7", "12", "3", "4"], 1, "3 × 4 = 12 putaran loop dalam."),
  ]},
  { id: "bk-while", title: "While loop", icon: "Repeat", xp: 140, minutes: 5, steps: [
    learn("while dan syarat berhenti", "while mengulang selama kondisi benar. Wajib ada perubahan yang membuat kondisi salah (misalnya n -= 1).", "n = 3\nwhile n > 0:\n    print(n)\n    n -= 1\nprint('Go!')"),
    quiz("Agar while berhenti?", ["print()", "ubah variabel kondisi", "input()", "komentar"], 1, "Tanpa perubahan, loop berjalan selamanya."),
  ]},
  { id: "bk-break-continue", title: "Break & continue", icon: "Repeat", xp: 150, minutes: 5, steps: [
    learn("Kendali loop", "break menghentikan loop. continue melewati satu putaran. else pada loop dijalankan jika selesai tanpa break.", "for i in range(1, 6):\n    if i == 4:\n        break\n    print(i)"),
    quiz("continue = ?", ["hentikan loop", "lewati sisa putaran", "ulang dari awal", "tutup program"], 1, "continue langsung ke putaran berikutnya."),
  ]},
]);

const ch8 = mk(CHAPTERS[7], [
  { id: "bk-string-dasar", title: "String dasar", icon: "Type", xp: 120, minutes: 4, steps: [
    learn("Membuat string", "String diapit kutip tunggal, ganda, atau triple. len() panjang, + gabung, * ulang.", "s = 'PyFun'\nprint(len(s))\nprint(s + '!')\nprint(s * 2)"),
    quiz("len('PyFun')?", ["4", "5", "6", "0"], 1, "5 huruf: P, y, F, u, n."),
  ]},
  { id: "bk-string-index", title: "Index & slice", icon: "Type", xp: 130, minutes: 5, steps: [
    learn("Index dan slice", "Index mulai 0, negatif dari belakang. Slice [mulai:berhenti:langkah] berhenti sebelum akhir. Langkah -1 membalik.", "s = 'Python'\nprint(s[0], s[-1])\nprint(s[1:4])\nprint(s[::-1])"),
    quiz("'Python'[1:4] = ?", ["Pyt", "yth", "ytho", "tho"], 1, "Slice 1:4 ambil indeks 1, 2, 3."),
  ]},
  { id: "bk-string-metode", title: "Metode string", icon: "Type", xp: 140, minutes: 5, steps: [
    learn("lower, upper, replace, count", "lower/upper ubah kapitalisasi, replace ganti teks, count hitung kemunculan, index cari posisi, isalpha cek huruf.", "s = 'PyFun'\nprint(s.lower())\nprint(s.upper())\nprint('banana'.count('a'))"),
    quiz("s.lower() ubah?", ["string asli", "kembalikan string baru", "angka", "list"], 1, "String immutable, jadi return string baru."),
  ]},
  { id: "bk-string-escape", title: "Escape & format", icon: "Type", xp: 130, minutes: 5, steps: [
    learn("Escape dan f-string", "Baris baru = backslash+n, tab = backslash+t. f-string pakai f'...' dan {ekspresi}. :.2f = 2 desimal.", "print('Halo\\nDunia')\nskor = 87.5\nprint(f'Nilai: {skor:.1f}')"),
    quiz("f'{3.14159:.2f}' = ?", ["3.14", "3.142", "3.1", "3.14159"], 0, ":.2f bulatkan ke 2 desimal."),
  ]},
  { id: "bk-string-split-join", title: "Split & join", icon: "Type", xp: 140, minutes: 5, steps: [
    learn("split & join", "split() pecah jadi list kata. join() gabung dengan pemisah. strip() buang spasi ujung.", "kata = 'apel jeruk mangga'.split()\nprint(kata)\nprint('-'.join(kata))\nprint('  py  '.strip())"),
    quiz("'a,b,c'.split(',')?", ["['a,b,c']", "['a','b','c']", "'abc'", "['abc']"], 1, "split(',') pecah tiap koma."),
  ]},
  { id: "bk-list-dasar", title: "List dasar", icon: "List", xp: 120, minutes: 4, steps: [
    learn("List", "List pakai []. Index mulai 0. len() hitung elemen.", "buah = ['apel', 'jeruk', 'mangga']\nprint(buah[0])\nprint(len(buah))"),
    quiz("buah[1]?", ["apel", "jeruk", "mangga", "error"], 1, "Index 1 = elemen kedua."),
  ]},
  { id: "bk-list-metode", title: "Metode list", icon: "List", xp: 140, minutes: 5, steps: [
    learn("append, insert, remove, sort", "append tambah akhir, insert di posisi, remove hapus nilai, pop berdasarkan indeks, sort urut, reverse balik.", "nilai = [75, 60, 90]\nnilai.append(85)\nnilai.sort(reverse=True)\nprint(nilai)"),
    quiz("[3,1,2]; a.sort(); print(a)?", ["[3,1,2]", "[1,2,3]", "None", "Error"], 1, "sort() urut in-place."),
  ]},
  { id: "bk-list-comp", title: "List comprehension", icon: "List", xp: 150, minutes: 5, steps: [
    learn("List comprehension", "Sintaks [ekspresi for item in iterable if kondisi] buat list ringkas.", "squares = [x*x for x in range(5)]\nprint(squares)\nevens = [x for x in range(10) if x % 2 == 0]\nprint(evens)"),
    quiz("[x*2 for x in [1,2,3]]?", ["[2,4,6]", "[1,2,3]", "[3,6,9]", "[0,2,4]"], 0, "Setiap elemen × 2."),
  ]},
  { id: "bk-list-2d", title: "List 2D", icon: "List", xp: 150, minutes: 6, steps: [
    learn("List berisi list", "List 2D untuk tabel. Akses L[baris][kolom]. Loop bersarang cetak isinya.", "data = [[1, 2], [3, 4]]\nprint(data[1][0])\nfor baris in data:\n    for nilai in baris:\n        print(nilai, end=' ')\n    print()"),
    quiz("L[1][0]?", ["baris 0 kol 1", "baris 1 kol 0", "semua", "error"], 1, "Indeks pertama baris, kedua kolom."),
  ]},
]);

const ch9 = mk(CHAPTERS[8], [
  { id: "bk-tuple", title: "Tuple & unpacking", icon: "Package", xp: 130, minutes: 4, steps: [
    learn("Tuple", "Tuple pakai (). Immutable. Unpacking pecah jadi variabel: a, b = (1, 2).", "koordinat = (10, 20)\nx, y = koordinat\nprint(x, y)"),
    quiz("Tuple bisa diubah?", ["ya", "tidak", "hanya angka", "hanya string"], 1, "Tuple immutable."),
  ]},
  { id: "bk-set", title: "Set & operasinya", icon: "Package", xp: 140, minutes: 5, steps: [
    learn("Set", "Set = nilai unik tanpa urutan. | union, & intersection, - difference, ^ symmetric. sorted() untuk urut.", "a = {1, 2, 3}\nb = {3, 4}\nprint(a | b)\nprint(a & b)\nprint(sorted(set([3, 1, 3, 2, 1])))"),
    quiz("len(set([1,1,2,3,3]))?", ["2", "3", "5", "6"], 1, "Set buang duplikat → 1, 2, 3."),
  ]},
  { id: "bk-dict", title: "Dictionary dasar", icon: "BookOpen", xp: 130, minutes: 5, steps: [
    learn("Kunci-nilai", "Dictionary simpan data berpasangan kunci: nilai. Akses lewat kunci. Tambah dengan d[k] = v.", "siswa = {'nama': 'Rani', 'umur': 16}\nprint(siswa['nama'])\nsiswa['kelas'] = '10A'\nprint(siswa)"),
    quiz("Ambil 'nama'?", ["siswa.nama", "siswa['nama']", "siswa(nama)", "siswa[0]"], 1, "Dict diakses lewat kunci di []."),
  ]},
  { id: "bk-dict-lanjut", title: "Dictionary lanjutan", icon: "BookOpen", xp: 150, minutes: 6, steps: [
    learn("get, items, update", "get(k, default) aman. items() pasangan, keys()/values(). ** gabung dict (kanan menang).", "skor = {'Ani': 80, 'Budi': 95}\nprint(skor.get('Cici', 0))\nprint(list(skor.items()))\ngabung = {**skor, 'Cici': 85}\nprint(gabung)"),
    quiz("d.get('x', 0) jika 'x' tidak ada?", ["None", "0", "KeyError", "False"], 1, "get return default."),
  ]},
]);

const ch10 = mk(CHAPTERS[9], [
  { id: "bk-fungsi", title: "Fungsi dasar", icon: "Braces", xp: 140, minutes: 5, steps: [
    learn("def dan return", "def buat fungsi, return kirim hasil keluar. Tanpa return → None.", "def kuadrat(n):\n    return n * n\n\nprint(kuadrat(7))"),
    quiz("Fungsi tanpa return?", ["0", "None", "string kosong", "Error"], 1, "Return None jika tidak ada return."),
  ]},
  { id: "bk-fungsi-arg", title: "Argumen & return", icon: "Braces", xp: 150, minutes: 5, steps: [
    learn("Default & keyword", "Parameter bisa punya default. Panggil dengan nama parameter. Fungsi bisa return beberapa nilai (tuple).", "def pangkat(angka, eksponen=2):\n    return angka ** eksponen\n\nprint(pangkat(5))\nprint(pangkat(2, 3))"),
    quiz("Definisi default yang benar?", ["def f(x=1):", "def f(x): = 1", "def f(x =):", "f(x=1)"], 0, "Nilai default setelah nama parameter."),
  ]},
  { id: "bk-fungsi-scope", title: "Scope & global", icon: "Globe", xp: 150, minutes: 5, steps: [
    learn("Variabel lokal & global", "Variabel dalam fungsi lokal. Ubah global pakai global, tapi hindari berlebihan.", "x = 10\n\ndef ubah():\n    x = 5\n    print('dalam', x)\n\nubah()\nprint('luar', x)"),
    quiz("Variabel dalam fungsi?", ["global", "lokal", "konstanta", "module"], 1, "Lokal hanya hidup di dalam fungsi."),
  ]},
  { id: "bk-fungsi-rekursi", title: "Rekursi", icon: "Repeat", xp: 170, minutes: 6, steps: [
    learn("Fungsi memanggil diri", "Rekursi pecah masalah jadi lebih kecil. Wajib base case. Contoh: faktorial.", "def faktorial(n):\n    if n <= 1:\n        return 1\n    return n * faktorial(n - 1)\n\nprint(faktorial(5))"),
    quiz("Tanpa base case?", ["lebih cepat", "RecursionError", "return 0", "berhenti sendiri"], 1, "Pemanggilan tak berhenti → RecursionError."),
  ]},
  { id: "bk-lambda", title: "Lambda, map, filter", icon: "Code2", xp: 160, minutes: 5, steps: [
    learn("Lambda", "lambda x: ekspresi buat fungsi singkat. map terapkan ke setiap elemen, filter saring yang True.", "angka = [1, 2, 3, 4, 5]\ngenap = list(filter(lambda x: x % 2 == 0, angka))\nkuadrat = list(map(lambda x: x * x, angka))\nprint(genap)\nprint(kuadrat)"),
    quiz("list(map(lambda x: x*2, [1,2,3]))?", ["[1,2,3]", "[2,4,6]", "[1,4,9]", "[3,6,9]"], 1, "map terapkan ke setiap elemen."),
  ]},
]);

const ch11 = mk(CHAPTERS[10], [
  { id: "bk-file-baca", title: "Baca file", icon: "BookOpen", xp: 150, minutes: 5, steps: [
    learn("open & with", "open(path, mode): r baca, w timpa, a tambah. with tutup otomatis. read() semua, readlines() per baris.", "from io import StringIO\n\nbuf = StringIO('baris 1\\nbaris 2\\n')\nprint(buf.read())"),
    quiz("Mode baca?", ["r", "w", "a", "x"], 0, "r = read."),
  ]},
  { id: "bk-file-tulis", title: "Tulis file", icon: "BookOpen", xp: 150, minutes: 5, steps: [
    learn("Mode w & a", "w timpa isi lama, a tambah di akhir. Tutup dengan with atau close.", "from io import StringIO\n\nbuf = StringIO()\nbuf.write('halo\\n')\nbuf.seek(0)\nprint(buf.read())"),
    quiz("Mode timpa?", ["r", "a", "w", "x"], 2, "w menimpa isi lama."),
  ]},
  { id: "bk-json", title: "JSON", icon: "Database", xp: 160, minutes: 6, steps: [
    learn("json.dumps/loads", "dumps: objek → teks JSON. loads: teks → dict/list. ensure_ascii=False jaga karakter non-ASCII.", "import json\n\nteks = json.dumps({'nama': 'Rani', 'nilai': [80, 90]}, ensure_ascii=False)\ndata = json.loads(teks)\nprint(data['nama'])\nprint(sum(data['nilai']))"),
    quiz("json.loads hasil?", ["string", "dict/list", "CSV", "HTML"], 1, "JSON object → dict, array → list."),
  ]},
  { id: "bk-csv", title: "CSV", icon: "Database", xp: 160, minutes: 6, steps: [
    learn("csv.DictWriter", "DictWriter tulis baris CSV dari dict. StringIO untuk latihan tanpa file.", "import csv\nfrom io import StringIO\n\nbuf = StringIO()\nw = csv.DictWriter(buf, fieldnames=['nama', 'nilai'])\nw.writeheader()\nw.writerow({'nama': 'Rani', 'nilai': 90})\nprint(buf.getvalue().strip())"),
    quiz("Tulis header otomatis?", ["writeheader()", "writeline()", "header()", "write()"], 0, "writeheader() tulis baris judul."),
  ]},
  { id: "bk-pathlib", title: "pathlib & os", icon: "Package", xp: 150, minutes: 5, steps: [
    learn("Path lintas OS", "pathlib.Path aman. .name nama file, .suffix ekstensi, .stem nama tanpa ekstensi. Operator / sambung folder.", "from pathlib import Path\n\np = Path('/data/laporan.csv')\nprint(p.name)\nprint(p.suffix)\nprint(p.stem)"),
    quiz("Path('data/nilai.csv').stem?", ["data", "nilai", "nilai.csv", ".csv"], 1, "stem = nama tanpa ekstensi."),
  ]},
  { id: "bk-modul", title: "Modul & pip", icon: "Globe", xp: 140, minutes: 5, steps: [
    learn("import & pip", "import modul muat semua, from modul import fungsi ambil tertentu, as alias. pip install pasang dari PyPI.", "import math\nprint(math.sqrt(81))\nprint(math.floor(3.9))"),
    quiz("Perintah pasang paket?", ["pip install", "import", "python", "help"], 0, "pip = package manager."),
  ]},
]);

const ch12 = mk(CHAPTERS[11], [
  { id: "bk-class", title: "Class dasar", icon: "Package", xp: 170, minutes: 6, steps: [
    learn("Class & objek", "Class = cetakan objek. __init__ saat buat objek, self rujuk ke objek. Method pakai self untuk data.", "class Siswa:\n    def __init__(self, nama):\n        self.nama = nama\n    def sapa(self):\n        return 'Halo ' + self.nama\n\nprint(Siswa('Rani').sapa())"),
    quiz("self = ?", ["class", "objek", "module", "return"], 1, "self = referensi ke objek."),
  ]},
  { id: "bk-inheritance", title: "Inheritance", icon: "GitBranch", xp: 180, minutes: 6, steps: [
    learn("Mewarisi class induk", "class Anak(Induk) warisi method. Override dengan tulis ulang. super() panggil versi induk.", "class Hewan:\n    def suara(self):\n        return 'Hewan'\n\nclass Kucing(Hewan):\n    def suara(self):\n        return 'Meong'\n\nprint(Kucing().suara())"),
    quiz("class Kucing(Hewan)?", ["salin file", "warisi Hewan", "Hewan warisi Kucing", "sama"], 1, "Class di kurung = induk."),
  ]},
  { id: "bk-exception", title: "Try & except", icon: "GitBranch", xp: 170, minutes: 6, steps: [
    learn("Menangkap error", "Kode berisiko di try. Jika error, except jalan. Setiap error punya nama: ValueError, ZeroDivisionError, dsb.", "try:\n    print(10 / 0)\nexcept ZeroDivisionError:\n    print('Tidak bisa dibagi nol')"),
    quiz("int('abc')?", ["ValueError", "TypeError", "ZeroDivisionError", "KeyError"], 0, "Teks non-angka tidak bisa jadi int."),
  ]},
  { id: "bk-raise", title: "Raise & finally", icon: "GitBranch", xp: 170, minutes: 6, steps: [
    learn("raise & finally", "raise lempar error sengaja. finally selalu jalan, cocok untuk pembersihan.", "def cek(n):\n    if n < 0:\n        raise ValueError('Negatif')\n    return n\n\ntry:\n    cek(-1)\nexcept ValueError as e:\n    print(e)\nfinally:\n    print('Selesai')"),
    quiz("Blok selalu jalan?", ["try", "except", "finally", "raise"], 2, "finally = cleanup yang harus jalan."),
  ]},
]);

const ch13 = mk(CHAPTERS[12], [
  { id: "bk-sort", title: "Sorting", icon: "Calculator", xp: 170, minutes: 6, steps: [
    learn("sorted & sort", "sorted() → list baru. sort() in-place. reverse=True menurun. Bubble sort tukar tetangga salah urutan.", "print(sorted([3, 1, 2]))\nprint(sorted([3, 1, 2], reverse=True))\n\ndata = [5, 1, 4]\nfor i in range(len(data)):\n    for j in range(len(data) - 1 - i):\n        if data[j] > data[j + 1]:\n            data[j], data[j + 1] = data[j + 1], data[j]\nprint(data)"),
    quiz("sort vs sorted?", ["sama", "sort ubah asli, sorted return baru", "sorted hanya angka", "sort tidak ada"], 1, "sort in-place, sorted return list baru."),
  ]},
  { id: "bk-search", title: "Searching", icon: "Calculator", xp: 170, minutes: 6, steps: [
    learn("Linear & biner", "Linear periksa satu-satu. Biner hanya data terurut, buang separuh per langkah.", "def cari(data, target):\n    for i, nilai in enumerate(data):\n        if nilai == target:\n            return i\n    return -1\n\nprint(cari([4, 8, 15], 15))\nprint(cari([4, 8, 15], 7))"),
    quiz("Biner butuh data?", ["acak", "terurut", "string", "genap"], 1, "Tanpa urutan, buang separuh bisa buang target."),
  ]},
  { id: "bk-math", title: "Math module", icon: "Calculator", xp: 160, minutes: 5, steps: [
    learn("Fungsi math", "math: sqrt, floor, ceil, pi, gcd, factorial, isclose (bandingkan float dengan toleransi).", "import math\nprint(math.sqrt(81))\nprint(math.gcd(48, 18))\nprint(math.isclose(0.1 + 0.2, 0.3))"),
    quiz("math.gcd(48, 18)?", ["6", "12", "18", "48"], 0, "48 dan 18 habis dibagi 6."),
  ]},
  { id: "bk-random", title: "Random module", icon: "Calculator", xp: 160, minutes: 5, steps: [
    learn("random", "randint(a, b) inklusif, choice pilih satu, shuffle acak list. random.seed buat urutan bisa diulang.", "import random\nrandom.seed(42)\nprint(random.randint(1, 10))\nprint([random.randint(1, 6) for _ in range(3)])"),
    quiz("randint(1,10)?", ["1-9", "1-10", "0-10", "0-9"], 1, "randint inklusif."),
  ]},
  { id: "bk-datetime", title: "Datetime", icon: "Package", xp: 160, minutes: 6, steps: [
    learn("Tanggal & selisih", "date/datetime wakili tanggal. Kurang dua tanggal = timedelta (.days). strftime ke teks, strptime baca teks.", "from datetime import date, datetime\n\nmulai = date(2026, 1, 1)\nakhir = date(2026, 1, 31)\nprint((akhir - mulai).days)\nprint(akhir.strftime('%d-%m-%Y'))"),
    quiz("%Y artinya?", ["hari", "tahun 4 digit", "bulan", "menit"], 1, "%Y = tahun 4 digit."),
  ]},
]);

const ch14 = mk(CHAPTERS[13], [
  { id: "bk-regex", title: "Regex dasar", icon: "Type", xp: 180, minutes: 6, steps: [
    learn("Pola teks", "re.findall ambil semua cocok. re.sub ganti. [0-9] digit, [a-z] huruf, + satu atau lebih.", "import re\n\nteks = 'file_2024.csv dan file_2025.csv'\nprint(re.findall('[0-9]{4}', teks))\nprint(re.sub('file_', 'data_', teks))"),
    quiz("re.findall('[0-9]+', 'a12b345')?", ["['12','345']", "['a12','b345']", "12", "['12345']"], 0, "[0-9]+ = satu atau lebih digit."),
  ]},
  { id: "bk-regex-lanjut", title: "Regex lanjutan", icon: "Type", xp: 190, minutes: 7, steps: [
    learn("Grup & validasi", "Kurung = grup. re.fullmatch wajib cocok seluruh teks. [.] = titik literal.", "import re\n\npola = r'([a-z]+)@([a-z]+)[.]com'\nhasil = re.fullmatch(pola, 'rani@pyfun.com')\nprint(hasil.group(1) if hasil else 'tidak cocok')"),
    quiz("match vs fullmatch?", ["sama", "fullmatch wajib cocok seluruh", "match hanya angka", "fullmatch lambat"], 1, "fullmatch wajib cocok seluruh string."),
  ]},
  { id: "bk-collections", title: "Counter & defaultdict", icon: "Database", xp: 180, minutes: 6, steps: [
    learn("Hitung & kelompokkan", "Counter hitung frekuensi, most_common(n). defaultdict(list) otomatis list saat kunci baru.", "from collections import Counter, defaultdict\n\nhitung = Counter('apel jeruk apel'.split())\nprint(hitung.most_common(1))\n\nkelompok = defaultdict(list)\nfor buah in ['apel', 'anggur']:\n    kelompok[buah[0]].append(buah)\nprint(dict(kelompok))"),
    quiz("Counter(['a','a','b'])['a']?", ["1", "2", "3", "Error"], 1, "Hitung kemunculan 'a' = 2."),
  ]},
  { id: "bk-itertools", title: "Itertools", icon: "Calculator", xp: 180, minutes: 6, steps: [
    learn("Kombinasi & produk", "combinations r elemen tanpa urutan. product pasangan dari beberapa kumpulan. chain sambung iterable.", "from itertools import combinations, product, chain\n\nprint(list(combinations([1, 2, 3], 2)))\nprint(list(product('AB', repeat=2)))\nprint(list(chain([1, 2], [3, 4])))"),
    quiz("combinations vs permutations?", ["sama", "permutasi perhatikan urutan", "kombinasi hanya angka", "permutasi tidak ada"], 1, "Permutasi bedakan urutan, kombinasi tidak."),
  ]},
  { id: "bk-enumerate-zip", title: "enumerate & zip", icon: "Repeat", xp: 160, minutes: 5, steps: [
    learn("Indeks & pasangan", "enumerate beri indeks+nilai. zip gabung dua iterable. dict(zip(k, v)) buat dictionary.", "for i, huruf in enumerate('abc'):\n    print(i, huruf)\nprint(list(zip([1, 2], ['a', 'b'])))"),
    quiz("list(enumerate(['a','b']))?", ["[('a',0),('b',1)]", "[(0,'a'),(1,'b')]", "['a','b']", "[0,1]"], 1, "enumerate = pasangan (indeks, nilai)."),
  ]},
  { id: "bk-copy", title: "Copy & mutability", icon: "Package", xp: 170, minutes: 6, steps: [
    learn("Referensi & salinan", "List mutable. copy = L hanya referensi. L[:] salinan dangkal. copy.deepcopy untuk list bersarang.", "L = [1, 2, 3]\nsalinan = L[:]\nsalinan[0] = 9\nprint(L)\nprint(salinan)"),
    quiz("Salin list tanpa share?", ["copy = L", "copy = L[:]", "copy = L + 0", "copy = list"], 1, "L[:] buat list baru dengan isi sama."),
  ]},
  { id: "bk-debug", title: "Debugging", icon: "Check", xp: 150, minutes: 5, steps: [
    learn("Strategi debug", "Print di titik curiga, periksa nilai di shell, baca error dari bawah ke atas. Bagi masalah jadi langkah kecil.", "def rata_rata(data):\n    print('data:', data)\n    print('panjang:', len(data))\n    return sum(data) / len(data)\n\nprint(rata_rata([10, 20, 30]))"),
    quiz("Cek variabel saat debug?", ["hapus variabel", "print(variabel)", "restart", "ganti nama"], 1, "print tampilkan nilai saat itu."),
  ]},
  { id: "bk-tkinter", title: "Tkinter dasar", icon: "Globe", xp: 170, minutes: 6, steps: [
    learn("Jendela, label, tombol", "Alur: from tkinter import *, root = Tk(), buat widget, grid(), mainloop(). mainloop tunggu event.", "from tkinter import *\n\nroot = Tk()\nlabel = Label(text='Halo')\nlabel.grid(row=0, column=0)\nmainloop()"),
    quiz("Fungsi event loop Tkinter?", ["Tk()", "mainloop()", "grid()", "Label()"], 1, "mainloop tunggu event sampai jendela ditutup."),
  ]},
]);

// ============================================================
// PYTHON PRO
// ============================================================
const ch15 = mk(CHAPTERS[14], [
  { id: "pro-generator", title: "Generator & yield", icon: "Repeat", xp: 220, minutes: 7, steps: [
    learn("yield = generator", "Fungsi dengan yield jadi generator. Nilai diproduksi satu per satu, hemat memori untuk data besar.", "def hitung_mundur(n):\n    while n > 0:\n        yield n\n        n -= 1\n\nfor x in hitung_mundur(3):\n    print(x)"),
    learn("Generator expression", "Mirip list comprehension, tapi pakai (). Cocok untuk sum, any, all, max karena dipakai sekali.", "total = sum(x*x for x in range(1000000))\nprint(total)"),
    quiz("Fungsi dengan yield return?", ["list", "tuple", "generator", "None"], 2, "yield bikin fungsi jadi generator object."),
  ]},
  { id: "pro-decorator", title: "Decorator", icon: "Code2", xp: 230, minutes: 7, steps: [
    learn("Fungsi bungkus fungsi", "Decorator terima fungsi, kembalikan fungsi baru dengan perilaku tambahan. Dipasang dengan @nama.", "import functools\n\ndef catat(fn):\n    @functools.wraps(fn)\n    def pembungkus(*args, **kwargs):\n        print('memanggil', fn.__name__)\n        return fn(*args, **kwargs)\n    return pembungkus\n\n@catat\ndef tambah(a, b):\n    return a + b\n\nprint(tambah(2, 3))"),
    quiz("@decorator di atas def f() setara?", ["f = decorator", "f = decorator(f)", "decorator = f", "f(decorator)"], 1, "@decorator ganti f dengan decorator(f)."),
  ]},
  { id: "pro-context-manager", title: "Context manager", icon: "Package", xp: 210, minutes: 6, steps: [
    learn("with = manajemen resource", "Context manager jamin pembersihan meski error. Class dengan __enter__/__exit__, atau contextlib.contextmanager.", "from contextlib import contextmanager\n\n@contextmanager\ndef sesi(nama):\n    print('buka', nama)\n    try:\n        yield nama\n    finally:\n        print('tutup', nama)\n\nwith sesi('db') as s:\n    print('pakai', s)"),
    quiz("Method wajib context manager class?", ["__init__ __str__", "__enter__ __exit__", "__start__ __stop__", "__open__ __close__"], 1, "with panggil __enter__ dan __exit__."),
  ]},
  { id: "pro-type-hint", title: "Type hints", icon: "Braces", xp: 200, minutes: 6, steps: [
    learn("Anotasi tipe", "Type hint tidak ubah runtime, tapi bantu editor & mypy. Gunakan list[int], dict[str, int], Optional, | None.", "from typing import Optional\n\ndef rata(data: list[float]) -> float:\n    return sum(data) / len(data)\n\ndef cari(nama: str) -> Optional[int]:\n    return len(nama) or None\n\nprint(rata([1.0, 2.0, 3.0]))"),
    quiz("x: int = 5 runtime berfungsi?", ["casting", "cek ketat", "petunjuk editor/al", "error jika bukan int"], 2, "Python tidak paksa tipe runtime."),
  ]},
  { id: "pro-magic", title: "Magic methods", icon: "Sparkles", xp: 220, minutes: 7, steps: [
    learn("Custom perilaku objek", "__str__ untuk print, __repr__ untuk debug, __eq__ untuk ==, __add__ untuk +, __len__ untuk len().", "class Uang:\n    def __init__(self, nilai):\n        self.nilai = nilai\n    def __add__(self, other):\n        return Uang(self.nilai + other.nilai)\n    def __str__(self):\n        return f'Rp{self.nilai:,}'\n\nprint(Uang(15000) + Uang(7500))"),
    quiz("print() panggil?", ["__repr__", "__str__", "__print__", "__eq__"], 1, "print pakai __str__."),
  ]},
  { id: "pro-property", title: "Property & setter", icon: "Lock", xp: 210, minutes: 6, steps: [
    learn("Akses seperti variabel", "@property buat method jadi atribut. @nama.setter untuk validasi saat diubah.", "class Suhu:\n    def __init__(self, c):\n        self._c = c\n    @property\n    def celsius(self):\n        return self._c\n    @celsius.setter\n    def celsius(self, v):\n        if v < -273:\n            raise ValueError('Di bawah nol absolut')\n        self._c = v\n\ns = Suhu(30)\ns.celsius = 35\nprint(s.celsius)"),
    quiz("@property berguna untuk?", ["sembunyikan method", "akses atribut dengan logika tambahan", "buat class", "hapus atribut"], 1, "Property beri validasi/perhitungan saat atribut dibaca/ditulis."),
  ]},
  { id: "pro-dataclass", title: "Dataclass", icon: "Package", xp: 200, minutes: 6, steps: [
    learn("Kurangi boilerplate", "@dataclass buat __init__, __repr__, __eq__ otomatis. field(default_factory=list) hindari mutable default.", "from dataclasses import dataclass, field\n\n@dataclass\nclass Siswa:\n    nama: str\n    nilai: list[int] = field(default_factory=list)\n\ns = Siswa('Rani')\ns.nilai.append(80)\nprint(s)"),
    quiz("field(default_factory=list) kenapa?", ["lebih cepat", "hindari list dipakai bersama", "buat immutable", "type hint"], 1, "Default mutable dipakai bersama semua instance tanpa default_factory."),
  ]},
  { id: "pro-class-static", title: "Class & static method", icon: "Code2", xp: 200, minutes: 6, steps: [
    learn("3 jenis method", "Instance method pakai self. @classmethod pakai cls (konstruktor alternatif). @staticmethod tidak terima self/cls.", "class Tanggal:\n    def __init__(self, hari):\n        self.hari = hari\n    @classmethod\n    def dari_teks(cls, teks):\n        return cls(int(teks))\n    @staticmethod\n    def valid(hari):\n        return 1 <= hari <= 31\n\nprint(Tanggal.dari_teks('17').hari)\nprint(Tanggal.valid(40))"),
    quiz("@classmethod argumen pertama?", ["self", "cls", "instance", "module"], 1, "classmethod terima class (cls)."),
  ]},
  { id: "pro-sort-key", title: "Sorting key", icon: "Calculator", xp: 190, minutes: 6, steps: [
    learn("Urutkan custom", "sort/sorted terima key fungsi. Bisa operator.itemgetter/attrgetter. reverse=True membalik.", "data = [('Ani', 80), ('Budi', 95), ('Cici', 70)]\nprint(sorted(data, key=lambda x: x[1], reverse=True))\n\nkata = ['apel', 'kiwi', 'jeruk']\nprint(sorted(kata, key=len))"),
    quiz("sorted(['bb','a','ccc'], key=len)?", ["['a','bb','ccc']", "['ccc','bb','a']", "['a','ccc','bb']", "['bb','a','ccc']"], 0, "Urut panjang: 1, 2, 3."),
  ]},
  { id: "pro-walrus", title: "Walrus operator", icon: "Code2", xp: 180, minutes: 5, steps: [
    learn(":= assign + pakai", "Walrus := beri nilai di dalam ekspresi. Berguna untuk while dan comprehension.", "data = [1, 2, 3, 4, 5]\nif (n := len(data)) > 3:\n    print('panjang', n)\n\nganjil = [y for x in range(10) if (y := x * 2) % 3 == 0]\nprint(ganjil)"),
    quiz(":= untuk?", ["perbandingan", "assign dalam ekspresi", "bitwise and", "hapus variabel"], 1, "Walrus assign + kembalikan nilai."),
  ]},
  { id: "pro-match-case", title: "match-case", icon: "GitBranch", xp: 200, minutes: 6, steps: [
    learn("Pattern matching 3.10+", "match-case periksa pola, bukan hanya nilai. Bisa literal, tuple, list, class, guard if. case _ = default.", "def kategori(x):\n    match x:\n        case 0:\n            return 'nol'\n        case int(n) if n > 0:\n            return 'positif'\n        case int(n):\n            return 'negatif'\n        case _:\n            return 'lainnya'\n\nprint(kategori(5), kategori(-2), kategori(0))"),
    quiz("case _ = ?", ["komentar", "wildcard/default", "variabel", "penutup"], 1, "case _ cocok apa saja = default."),
  ]},
  { id: "pro-comp-lanjut", title: "Comprehension lanjutan", icon: "List", xp: 200, minutes: 6, steps: [
    learn("Dict, set, bersarang", "{k: v for} buat dict, {x for} buat set, dua for bersarang buat matriks.", "kata = ['apel', 'kiwi', 'jeruk']\nprint({k: len(k) for k in kata})\nprint({x*x for x in range(5)})\nprint([[i*j for j in range(3)] for i in range(2)])"),
    quiz("{x: x*x for x in range(3)}?", ["[0,1,4]", "{0:0,1:1,2:4}", "{0,1,4}", "(0,1,4)"], 1, "kunci:nilai → dict."),
  ]},
  { id: "pro-fstring-lanjut", title: "f-string lanjutan", icon: "Type", xp: 190, minutes: 6, steps: [
    learn("Format angka & padding", ":, = ribuan, :.2% = persen, :>10 = rata kanan, :^20 = rata tengah, :04d = padding.", "x = 1234567\ny = 0.856\nprint(f'{x:,}')\nprint(f'{y:.1%}')\nprint(f'{42:>10}')\nprint(f'{42:04d}')"),
    quiz("f'{0.1234:.1%}'?", ["0.1", "0.12", "12.3%", "1%"], 2, ":.1% = persen 1 desimal."),
  ]},
  { id: "pro-iter", title: "Iterator & iter", icon: "Repeat", xp: 200, minutes: 6, steps: [
    learn("Protokol iterasi", "Iterable punya __iter__ return iterator. Iterator punya __next__. for pakai keduanya.", "class Hitung:\n    def __init__(self, n):\n        self.n = n\n        self.i = 0\n    def __iter__(self):\n        return self\n    def __next__(self):\n        if self.i >= self.n:\n            raise StopIteration\n        self.i += 1\n        return self.i\n\nprint(list(Hitung(3)))"),
    quiz("Iterasi habis lempar?", ["__end__", "__stop__", "StopIteration", "__iter__"], 2, "StopIteration saat tidak ada elemen."),
  ]},
  { id: "pro-packaging", title: "venv & struktur", icon: "Package", xp: 210, minutes: 6, steps: [
    learn("Virtual environment", "venv isolasi dependensi. Aktifkan source .venv/bin/activate (Linux/Mac) atau .venv\\Scripts\\activate (Win). pip freeze > requirements.txt.", "# python -m venv .venv\n# source .venv/bin/activate\n# pip install requests\n# pip freeze > requirements.txt\nprint('siap')"),
    quiz("Tujuan venv?", ["file cepat", "isolasi dependensi", "hapus Python", "ganti pip"], 1, "venv cegah konflik versi antar project."),
  ]},
]);

// ============================================================
// ALGORITMA GACOR
// ============================================================
const ch16 = mk(CHAPTERS[15], [
  { id: "algo-big-o", title: "Big O", icon: "Calculator", xp: 220, minutes: 7, steps: [
    learn("Pertumbuhan, bukan detik", "Big O gambarkan pertumbuhan waktu vs input. O(1) konstan, O(log n), O(n), O(n log n), O(n^2) kuadratik.", "# O(n) satu loop\nprint(sum(range(100)))\n\n# O(n^2) dua loop bersarang\nfor i in range(100):\n    for j in range(100):\n        pass"),
    quiz("Dua loop n×n = ?", ["O(1)", "O(n)", "O(n log n)", "O(n^2)"], 3, "n × n = n^2 operasi."),
  ]},
  { id: "algo-two-pointers", title: "Two pointers", icon: "Calculator", xp: 230, minutes: 7, steps: [
    learn("Dua penunjuk", "Two pointers kurangi O(n^2) jadi O(n). Cocok untuk cari pasangan jumlah target di data terurut.", "def cari_pasangan(data, target):\n    kiri, kanan = 0, len(data) - 1\n    while kiri < kanan:\n        total = data[kiri] + data[kanan]\n        if total == target:\n            return (data[kiri], data[kanan])\n        if total < target:\n            kiri += 1\n        else:\n            kanan -= 1\n    return None\n\nprint(cari_pasangan([1, 2, 3, 4, 6], 6))"),
    quiz("Two pointers kompleksitas?", ["O(1)", "O(log n)", "O(n)", "O(n^2)"], 2, "Tiap pointer bergerak max n langkah → O(n)."),
  ]},
  { id: "algo-sliding-window", title: "Sliding window", icon: "Calculator", xp: 230, minutes: 7, steps: [
    learn("Jendela bergeser", "Sliding window jaga total dalam jendela, tambah baru buang lama. Cocok untuk cari subarray dengan sifat tertentu.", "def max_sum(data, k):\n    if len(data) < k:\n        return None\n    total = sum(data[:k])\n    terbaik = total\n    for i in range(k, len(data)):\n        total += data[i] - data[i - k]\n        terbaik = max(terbaik, total)\n    return terbaik\n\nprint(max_sum([2, 1, 5, 1, 3, 2], 3))"),
    quiz("Keunggulan vs dua loop?", ["lebih sulit", "ubah O(n^2) ke O(n)", "tidak bisa di list", "hanya string"], 1, "Manfaatkan hasil sebelumnya, satu putaran cukup."),
  ]},
  { id: "algo-hashmap", title: "Hash map", icon: "Database", xp: 220, minutes: 7, steps: [
    learn("Cari O(1) dengan set/dict", "Dict/set lookup rata-rata O(1). Tukar loop cari O(n) jadi O(1) per cek → kadang O(n^2) jadi O(n).", "def ada_duplikat(data):\n    terlihat = set()\n    for x in data:\n        if x in terlihat:\n            return True\n        terlihat.add(x)\n    return False\n\nprint(ada_duplikat([1, 2, 3, 2]))\nprint(ada_duplikat([1, 2, 3]))"),
    quiz("x in set(data)?", ["O(1)", "O(n)", "O(n log n)", "O(n^2)"], 0, "Set pakai hashing → lookup konstan."),
  ]},
  { id: "algo-stack-queue", title: "Stack & queue", icon: "Package", xp: 220, minutes: 7, steps: [
    learn("LIFO vs FIFO", "Stack LIFO pakai list append/pop di ujung. Queue FIFO pakai collections.deque dengan popleft.", "from collections import deque\n\nstack = []\nstack.append(1)\nstack.append(2)\nprint(stack.pop())\n\nq = deque([1, 2, 3])\nq.append(4)\nprint(q.popleft())"),
    quiz("FIFO cocok pakai?", ["list pop()", "deque popleft()", "set", "tuple"], 1, "deque O(1) pop di kiri, list.pop(0) O(n)."),
  ]},
  { id: "algo-linked-list", title: "Linked list", icon: "Package", xp: 240, minutes: 8, steps: [
    learn("Rantai node", "Node simpan nilai + rujukan next. Insert awal O(1), cari O(n).", "class Node:\n    def __init__(self, nilai):\n        self.nilai = nilai\n        self.next = None\n\ndef cetak(head):\n    while head:\n        print(head.nilai)\n        head = head.next\n\nhead = Node(1)\nhead.next = Node(2)\nhead.next.next = Node(3)\ncetak(head)"),
    quiz("Insert awal linked list?", ["O(1)", "O(log n)", "O(n)", "O(n^2)"], 0, "Cukup ubah head ke node baru."),
  ]},
  { id: "algo-bst", title: "Binary search tree", icon: "GitBranch", xp: 250, minutes: 8, steps: [
    learn("BST", "BST simpan nilai kecil di kiri, besar di kanan. Cari rata-rata O(log n) jika seimbang.", "class Node:\n    def __init__(self, nilai):\n        self.nilai = nilai\n        self.kiri = None\n        self.kanan = None\n\ndef sisip(root, nilai):\n    if root is None:\n        return Node(nilai)\n    if nilai < root.nilai:\n        root.kiri = sisip(root.kiri, nilai)\n    else:\n        root.kanan = sisip(root.kanan, nilai)\n    return root\n\nroot = None\nfor x in [5, 3, 8, 1, 4]:\n    root = sisip(root, x)\nprint(root.nilai, root.kiri.nilai, root.kanan.nilai)"),
    quiz("BST nilai lebih kecil disimpan di?", ["kiri", "kanan", "root", "tidak disimpan"], 0, "Kiri lebih kecil, kanan lebih besar."),
  ]},
  { id: "algo-dp", title: "Dynamic programming", icon: "Calculator", xp: 250, minutes: 8, steps: [
    learn("Simpan hasil subproblem", "DP pecah masalah, simpan hasil subproblem. Fib DP O(n), rekursi naif O(2^n).", "def fib(n):\n    if n < 2:\n        return n\n    dp = [0, 1]\n    for i in range(2, n + 1):\n        dp.append(dp[i-1] + dp[i-2])\n    return dp[n]\n\nprint(fib(30))"),
    quiz("Ide utama DP?", ["acak", "simpan hasil subproblem", "urutkan", "bagi file"], 1, "Overlapping subproblem disimpan di tabel."),
  ]},
  { id: "algo-memo", title: "Rekursi + memo", icon: "Repeat", xp: 230, minutes: 7, steps: [
    learn("lru_cache", "lru_cache simpan hasil pemanggilan dengan argumen sama. Satu decorator ubah rekursi eksponensial jadi linear.", "from functools import lru_cache\n\n@lru_cache(maxsize=None)\ndef fib(n):\n    if n < 2:\n        return n\n    return fib(n-1) + fib(n-2)\n\nprint(fib(50))"),
    quiz("Manfaat lru_cache?", ["perlambat", "hindari hitung ulang", "kode panjang", "ubah hasil"], 1, "Hasil argumen sama dari cache."),
  ]},
]);

// ===========================================================

export const BUNDLED: Lesson[] = [...ch1, ...ch2, ...ch3, ...ch4, ...ch5, ...ch6, ...ch7, ...ch8, ...ch9, ...ch10, ...ch11, ...ch12, ...ch13, ...ch14, ...ch15, ...ch16];

/** Bentuk baris di tabel Supabase (kolom camelCase diubah ke snake_case). */
export type LessonRow = {
  id: string;
  chapter: string;
  title: string;
  icon: string | null;
  xp: number | null;
  minutes: number | null;
  boss: boolean | null;
  steps: unknown;
  source: string | null;
  /** `core` = salinan materi bawaan, `bonus` = materi bonus. */
  kind?: string | null;
  track?: string | null;
  sort_order?: number | null;
  level?: string | null;
  created_at: string | null;
};

type Cache = { at: number; rows: Lesson[] };
let cache: Cache | null = null;
const TTL = 30_000; // 30 detik

/** Ubah satu baris tabel Supabase menjadi Lesson. */
export function toLesson(r: LessonRow): Lesson {
  const catalog = BONUS_CATALOG.find((l) => l.id === r.id);
  const level =
    r.level === "menengah" || r.level === "lanjutan" || r.level === "pemula"
      ? r.level
      : catalog?.level;
  // Baris lama (sebelum kolom track ada) masuk ke jalur fondasi, kecuali
  // id-nya sudah ada di katalog sehingga metadata katalog bisa dipakai.
  const track =
    r.track && r.track !== "Materi Bonus"
      ? r.track
      : (catalog?.track ?? "Fondasi Bonus");

  return {
    id: r.id,
    chapter: r.chapter || "Materi Bonus",
    title: r.title || "Materi baru",
    icon: r.icon || "Sparkles",
    xp: r.xp ?? 120,
    minutes: r.minutes ?? 5,
    boss: r.boss ?? false,
    steps: r.steps as Lesson["steps"],
    source: "supabase" as const,
    track,
    level,
    sortOrder:
      typeof r.sort_order === "number" ? r.sort_order : catalog?.sortOrder,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : undefined,
  };
}

/**
 * Ambil materi bonus dari Supabase, lalu gabungkan dengan katalog bawaan.
 *
 * Katalog dipakai sebagai fallback/offline supaya materi tetap tampil sebelum
 * admin menjalankan sync. Baris Supabase dengan id yang sama menimpa katalog,
 * jadi perubahan dari dashboard tetap menjadi sumber terbaru saat tersedia.
 * Baris `kind = core` (salinan materi inti) tidak ditampilkan sebagai bonus.
 */
export async function fetchSupabaseLessons(): Promise<Lesson[]> {
  const fallback = sortBonusLessons(BONUS_CATALOG);
  if (!supabase) return fallback;
  if (cache && Date.now() - cache.at < TTL) return cache.rows;

  // select("*") tanpa .eq("kind") supaya tetap kompatibel dengan tabel lama
  // yang belum menjalankan migrasi kolom kind.
  const { data, error } = await supabase.from(LESSONS_TABLE).select("*");
  if (error || !data) return fallback;

  const rows = (data as LessonRow[])
    .filter(
      (r) =>
        r &&
        typeof r.id === "string" &&
        Array.isArray(r.steps) &&
        r.kind !== "core" &&
        r.source !== "bundled",
    )
    .map(toLesson);

  const merged = new Map(fallback.map((l) => [l.id, l]));
  for (const row of rows) merged.set(row.id, row);
  const sorted = sortBonusLessons([...merged.values()]);

  cache = { at: Date.now(), rows: sorted };
  return sorted;
}

/** Quest bawaan terkunci berurutan; materi bonus (Supabase/katalog) selalu terbuka. */
export function isUnlocked(lesson: Lesson, progress: Record<string, { done: boolean }>) {
  if (lesson.source !== "bundled") return true;
  const i = BUNDLED.findIndex((l) => l.id === lesson.id);
  return i <= 0 || !!progress[BUNDLED[i - 1].id]?.done;
}

/** Cari lesson di materi bawaan, materi buatan user, lalu materi bonus. */
export function findLesson(
  id: string,
  supabaseLessons: Lesson[] = [],
  generatedLessons: Lesson[] = [],
) {
  return (
    BUNDLED.find((l) => l.id === id) ??
    generatedLessons.find((l) => l.id === id) ??
    supabaseLessons.find((l) => l.id === id) ??
    BONUS_CATALOG.find((l) => l.id === id)
  );
}

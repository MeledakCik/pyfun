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

export const BUNDLED: Lesson[] = [...ch1, ...ch2, ...ch3, ...ch4, ...ch5];

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

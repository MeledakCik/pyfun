export type LearnStep = {
  type: "learn";
  title: string;
  body: string; // paragraf biasa; `kode` untuk inline
  code?: string; // contoh kode (opsional)
};

export type QuizStep = {
  type: "quiz";
  q: string;
  options: string[];
  answer: number;
  explain: string;
  /** Penjelasan opsional untuk tiap opsi salah; indeks sama dengan `options`. */
  wrong?: string[];
};

export type CodeStep = {
  type: "code";
  prompt: string;
  starter: string;
  /** stdout harus sama persis (setelah trim) */
  out?: string;
  /** stdout harus memuat semua teks ini */
  has?: string[];
  /** kode harus cocok dengan semua regex ini (mis. wajib pakai `for`) */
  need?: string[];
  chips?: string[];
  /** Petunjuk pertama (ringan). */
  hint?: string;
  /** Petunjuk kedua (lebih spesifik, tanpa membocorkan solusi penuh). */
  hint2?: string;
  solution?: string;
};

export type PredictStep = {
  type: "predict";
  prompt: string;
  /** Kode contoh yang ditampilkan; output sebenarnya didapat dari Pyodide. */
  code: string;
  hint?: string;
  hint2?: string;
  /** Penjelasan setelah tebakan diperiksa. */
  explain?: string;
};

export type DebugTest = {
  /** Label yang ditampilkan, mis. "jumlah(3) = 6". */
  label?: string;
  /** Kode tambahan yang dijalankan setelah kode user; biasanya berisi `print()`. */
  code: string;
  /** stdout yang diharapkan setelah trim. */
  expected: string;
};

export type DebugStep = {
  type: "debug";
  prompt: string;
  /** Kode awal yang masih mengandung bug. */
  starter: string;
  tests: DebugTest[];
  hint?: string;
  hint2?: string;
  solution?: string;
};

export type Step = LearnStep | QuizStep | CodeStep | PredictStep | DebugStep;

export type Lesson = {
  id: string;
  chapter: string;
  title: string;
  icon: string; // nama ikon lucide
  xp: number;
  minutes: number;
  boss?: boolean;
  steps: Step[];
  /** `catalog` = materi bonus bawaan; `generated` = materi buatan user di localStorage. */
  source: "bundled" | "supabase" | "catalog" | "generated";
  /** Jalur/kelompok materi bonus, mis. "Machine Learning Dasar". */
  track?: string;
  level?: "pemula" | "menengah" | "lanjutan";
  /** Urutan di dalam track. */
  sortOrder?: number;
  createdAt?: number;
};

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
  hint?: string;
  solution?: string;
};

export type Step = LearnStep | QuizStep | CodeStep;

export type Lesson = {
  id: string;
  chapter: string;
  title: string;
  icon: string; // nama ikon lucide
  xp: number;
  minutes: number;
  boss?: boolean;
  steps: Step[];
  /** `catalog` = materi bonus bawaan yang dipakai sebagai fallback sebelum Supabase di-seed. */
  source: "bundled" | "supabase" | "catalog";
  /** Jalur/kelompok materi bonus, mis. "Machine Learning Dasar". */
  track?: string;
  level?: "pemula" | "menengah" | "lanjutan";
  /** Urutan di dalam track. */
  sortOrder?: number;
  createdAt?: number;
};

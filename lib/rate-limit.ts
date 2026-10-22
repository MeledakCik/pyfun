import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

/** Ambil IP klien dari header proxy Vercel (fallback ke "unknown"). */
export function clientIp(req: Request): string {
  // Di Vercel, x-real-ip diisi platform dan lebih sulit dipalsukan.
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim().slice(0, 64);
  return "unknown";
}

/**
 * Rate limit fixed-window sederhana. Di Vercel, memori bersifat per-instance,
 * jadi ini lapisan tambahan—bukan pengganti autentikasi/secret yang kuat.
 */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_BUCKETS) {
      // Buang entri yang sudah kedaluwarsa supaya memori tidak tumbuh terus.
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_BUCKETS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

/** Tolak body yang kebesaran sebelum di-parse. */
export function bodyTooLarge(req: Request, maxBytes = 16 * 1024): boolean {
  const raw = req.headers.get("content-length");
  if (!raw) return false;
  const size = Number(raw);
  return Number.isFinite(size) && size > maxBytes;
}

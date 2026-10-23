import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * CSP disusun untuk kebutuhan app:
 * - Pyodide diunduh dari jsDelivr dan dijalankan di Web Worker (blob).
 * - Supabase diakses langsung dari browser (hanya SELECT via RLS).
 * Catatan: Next.js masih membutuhkan 'unsafe-inline' untuk script bootstrap;
 * jangan tambahkan origin script lain selain yang benar-benar dipakai.
 */
const csp = [
  "default-src 'self'",
  // Pyodide membutuhkan eval untuk menjalankan Python hasil kompilasi di
  // worker. Batasi origin script tetap ke app sendiri + jsDelivr.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:",
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cdn.jsdelivr.net${isProd ? "" : " ws://localhost:* ws://127.0.0.1:*"}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'none'",
  "media-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "manifest-src 'self'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

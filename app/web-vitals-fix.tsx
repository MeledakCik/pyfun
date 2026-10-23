'use client';
// @ts-nocheck
import { useEffect } from 'react';

export default function WebVitalsFix() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const Orig = window.PerformanceObserver as any;
    if (!Orig || Orig.__patched) return;

    function Patched(this: any, callback: any) {
      const wrapped = (list: any, observer: any, opts: any) => {
        try {
          const entries = list?.getEntries?.() || [];
          const clean = entries.filter((e: any) => e && typeof e.startTime === 'number');
          if (clean.length === 0) return;
          const fakeList = { getEntries: () => clean };
          callback(fakeList, observer, opts);
        } catch {}
      };
      return new Orig(wrapped);
    }
    Patched.prototype = Orig.prototype;
    (Patched as any).__patched = true;
    (window as any).PerformanceObserver = Patched;
  }, []);
  return null;
}
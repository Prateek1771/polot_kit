"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { RefObject } from "react";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };

/** Every animation runs inside this media query, so reduced-motion users get static, fully visible content. */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
export const EASE = "expo.out";

/**
 * Scroll choreography for a page. Inside `scope`:
 * - `[data-reveal]`  heavy fade-up (y 64, blur 12px -> 0), batched + staggered as they enter
 * - `[data-bar="0.73"]` fill scaleX 0 -> value on enter (GPU-safe; ProbBar renders these)
 * Pass `deps` that change when async content lands; already-animated nodes are skipped.
 */
export function useReveal(scope: RefObject<HTMLElement | null>, deps: unknown[] = []) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(MOTION_OK, () => {
        const root = scope.current;
        if (!root) return;
        const fresh = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel)).filter((el) => !el.dataset.pkDone);

        const reveals = fresh("[data-reveal]");
        const bars = fresh("[data-bar]");
        if (!reveals.length && !bars.length) return;
        reveals.forEach((el) => (el.dataset.pkDone = "1"));
        if (reveals.length) gsap.set(reveals, { autoAlpha: 0, y: 64, filter: "blur(12px)" });
        if (reveals.length) ScrollTrigger.batch(reveals, {
          start: "top 92%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, {
              autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 0.95, ease: EASE, stagger: 0.08, overwrite: true, clearProps: "filter",
              // children (bars, counters) measured their triggers while this parent was still offset; re-measure once it lands
              onComplete: () => ScrollTrigger.refresh(),
            }),
        });

        bars.forEach((el) => (el.dataset.pkDone = "1"));
        if (bars.length) gsap.set(bars, { scaleX: 0 });
        if (bars.length) ScrollTrigger.batch(bars, {
          start: "top 96%",
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { scaleX: (_i: number, el: HTMLElement) => Number(el.dataset.bar) || 0.02, duration: 1.2, ease: EASE, stagger: 0.035 }),
        });
        ScrollTrigger.refresh();
        // on revert (unmount, StrictMode re-run, media change) the nodes are visible again; let a re-run animate them
        return () => [...reveals, ...bars].forEach((el) => delete el.dataset.pkDone);
      });
    },
    { scope, dependencies: deps },
  );
}

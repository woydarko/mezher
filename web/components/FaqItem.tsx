"use client";

import { useRef, type MouseEvent } from "react";

const DURATION_MS = 320;
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * A <details> that opens and closes by animating its measured pixel height (Web Animations API).
 * CSS `interpolate-size: allow-keywords` did this too, but it starved Chrome's renderer on the whole page.
 */
export function FaqItem({ q, a, className }: { q: string; a: string; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const busy = useRef(false);

  function toggle(e: MouseEvent<HTMLElement>) {
    const d = ref.current;
    if (!d) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // native instant toggle
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;

    const summary = d.querySelector("summary") as HTMLElement;
    const style = getComputedStyle(d);
    const closedH = summary.offsetHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const startH = d.offsetHeight;
    const opening = !d.open;
    if (opening) d.open = true;
    const endH = opening ? d.offsetHeight : closedH;

    d.style.overflow = "hidden";
    const anim = d.animate([{ height: startH + "px" }, { height: endH + "px" }], { duration: DURATION_MS, easing: EASE });
    anim.onfinish = anim.oncancel = () => {
      if (!opening) d.open = false;
      d.style.overflow = "";
      busy.current = false;
    };
  }

  return (
    <details ref={ref} className={className}>
      <summary onClick={toggle}>{q}</summary>
      <p>{a}</p>
    </details>
  );
}

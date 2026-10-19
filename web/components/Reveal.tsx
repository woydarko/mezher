"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

type Props = { children: ReactNode; as?: ElementType; className?: string; delayMs?: number; id?: string };

/** Fades and lifts its content in once it scrolls into view (CSS in globals.css `.reveal`). */
export function Reveal({ children, as: Tag = "div", className, delayMs = 0, id }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      id={id}
      className={"reveal" + (visible ? " is-visible" : "") + (className ? " " + className : "")}
      style={{ ["--reveal-delay" as string]: delayMs + "ms" }}
    >
      {children}
    </Tag>
  );
}

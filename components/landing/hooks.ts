"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/** True quando o usuário prefere menos movimento (desliga efeitos pesados). */
export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        setReduced(mq.matches);
        const onChange = () => setReduced(mq.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);
    return reduced;
}

/**
 * Revela o elemento quando entra na viewport (uma única vez).
 * Uso: const { ref, inView } = useInView(); className={inView ? '...' : '...'}
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.2) {
    const ref = useRef<T | null>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setInView(true);
                    observer.disconnect();
                }
            },
            { threshold }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);

    return { ref, inView };
}

/**
 * Progresso de scroll (0→1) de uma seção "sticky stage": 0 quando o topo da
 * seção encosta no topo da viewport, 1 quando o final da seção sai.
 * A seção deve ser mais alta que a viewport (ex.: h-[300vh]) com um filho sticky.
 */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>(): {
    ref: RefObject<T | null>;
    progress: number;
} {
    const ref = useRef<T | null>(null);
    const [progress, setProgress] = useState(0);
    const frame = useRef(0);

    useEffect(() => {
        const update = () => {
            const el = ref.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const total = rect.height - window.innerHeight;
            if (total <= 0) {
                setProgress(rect.top < 0 ? 1 : 0);
                return;
            }
            const raw = -rect.top / total;
            setProgress(Math.min(1, Math.max(0, raw)));
        };
        const onScroll = () => {
            cancelAnimationFrame(frame.current);
            frame.current = requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);
        return () => {
            cancelAnimationFrame(frame.current);
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);
        };
    }, []);

    return { ref, progress };
}

/**
 * Tilt 3D com o mouse: devolve handlers + transform para aplicar em um card
 * com `transform-style: preserve-3d` dentro de um wrapper com `perspective`.
 */
export function useTilt(maxDeg = 7) {
    const [transform, setTransform] = useState("rotateX(0deg) rotateY(0deg)");

    const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        setTransform(`rotateX(${(-py * maxDeg).toFixed(2)}deg) rotateY(${(px * maxDeg).toFixed(2)}deg)`);
    };
    const onMouseLeave = () => setTransform("rotateX(0deg) rotateY(0deg)");

    return { transform, onMouseMove, onMouseLeave };
}

/** Contador animado: conta de 0 até `target` quando `start` vira true. */
export function useCountUp(target: number, start: boolean, durationMs = 1400): number {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!start) return;
        let raf = 0;
        const t0 = performance.now();
        const tick = (now: number) => {
            const t = Math.min(1, (now - t0) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(target * eased));
            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [start, target, durationMs]);
    return value;
}

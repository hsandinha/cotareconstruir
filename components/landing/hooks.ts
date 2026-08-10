"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            const mq = window.matchMedia(query);
            mq.addEventListener("change", onChange);
            return () => mq.removeEventListener("change", onChange);
        },
        () => window.matchMedia(query).matches,
        () => false
    );
}

/** True quando o usuário prefere menos movimento (síncrono, sem frame animado). */
export function usePrefersReducedMotion(): boolean {
    return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** Viewport baixa (landscape mobile etc.): cenas sticky viram estáticas. */
export function useShortViewport(): boolean {
    return useMediaQuery("(max-height: 700px)");
}

/**
 * Revela o elemento quando entra na viewport (uma única vez).
 * O threshold pedido é limitado ao alcançável: elementos mais altos que a
 * viewport nunca atingem ratios altos, então o limite real é ajustado à
 * proporção viewport/elemento (senão a seção ficaria invisível para sempre).
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.2) {
    const ref = useRef<T | null>(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const elHeight = el.getBoundingClientRect().height || 1;
        const reachable = Math.max(0.02, Math.min(threshold, (window.innerHeight * 0.5) / elHeight));
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting) {
                    setInView(true);
                    observer.disconnect();
                }
            },
            { threshold: reachable }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);

    return { ref, inView };
}

/**
 * Progresso de scroll (0→1) de uma seção "sticky stage".
 * O travel considera a altura REAL do filho sticky (primeiro filho), não a
 * viewport: se o conteúdo pinado for mais alto que a tela, o progresso ainda
 * completa 1 antes de despinar (senão o final da coreografia nunca acontece).
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
            const sticky = el.firstElementChild as HTMLElement | null;
            const pinned = Math.max(sticky?.offsetHeight || 0, window.innerHeight);
            const total = rect.height - pinned;
            if (total <= 0) {
                setProgress(rect.top < 0 ? 1 : 0);
                return;
            }
            setProgress(Math.min(1, Math.max(0, -rect.top / total)));
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
 * Tilt 3D com o mouse. O rect é medido no mouseenter (antes do transform) e
 * reutilizado durante o movimento — medir o elemento já rotacionado gera um
 * bounding box errado e o card treme perto das bordas.
 */
export function useTilt(maxDeg = 7) {
    const [transform, setTransform] = useState("rotateX(0deg) rotateY(0deg)");
    const rectRef = useRef<DOMRect | null>(null);

    const onMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
        rectRef.current = e.currentTarget.getBoundingClientRect();
    };
    const onMouseMove = (e: React.MouseEvent<HTMLElement>) => {
        const rect = rectRef.current ?? e.currentTarget.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        setTransform(`rotateX(${(-py * maxDeg).toFixed(2)}deg) rotateY(${(px * maxDeg).toFixed(2)}deg)`);
    };
    const onMouseLeave = () => {
        rectRef.current = null;
        setTransform("rotateX(0deg) rotateY(0deg)");
    };

    return { transform, onMouseEnter, onMouseMove, onMouseLeave };
}

/** Contador animado: conta de 0 até `target` quando `start` vira true. */
export function useCountUp(target: number, start: boolean, durationMs = 1400): number {
    const [value, setValue] = useState(0);
    useEffect(() => {
        if (!start) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setValue(target);
            return;
        }
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

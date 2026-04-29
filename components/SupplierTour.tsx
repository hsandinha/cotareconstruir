"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

export type SupplierTourStep = {
    /** CSS selector of the element to highlight. If omitted, the step is shown as a centered modal. */
    selector?: string;
    title: string;
    description: string;
    /** Optional tab id that should be active before showing this step. */
    requireTab?: string;
    /** Optional placement preference. Auto-flips if not enough space. */
    placement?: "top" | "bottom" | "left" | "right" | "center";
};

type Rect = { top: number; left: number; width: number; height: number };

type Props = {
    open: boolean;
    steps: SupplierTourStep[];
    onClose: () => void;
    onChangeTab?: (tabId: string) => void;
    storageKey?: string;
};

const PADDING = 8;
const TOOLTIP_WIDTH = 360;
const TOOLTIP_GAP = 14;

export function SupplierTour({ open, steps, onClose, onChangeTab, storageKey }: Props) {
    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);
    const [viewport, setViewport] = useState({ w: 0, h: 0 });

    const current = steps[index];

    // Reset when reopening
    useEffect(() => {
        if (open) {
            setIndex(0);
            if (typeof window !== "undefined") {
                window.scrollTo({ top: 0, behavior: "smooth" });
            }
        }
    }, [open]);

    // Switch tabs if step requires it
    useEffect(() => {
        if (!open || !current?.requireTab) return;
        onChangeTab?.(current.requireTab);
    }, [open, current?.requireTab, onChangeTab]);

    const computeRect = useCallback(() => {
        if (typeof window === "undefined") return;
        setViewport({ w: window.innerWidth, h: window.innerHeight });

        if (!current?.selector) {
            setRect(null);
            return;
        }
        const el = document.querySelector(current.selector) as HTMLElement | null;
        if (!el) {
            setRect(null);
            return;
        }
        const r = el.getBoundingClientRect();

        // If the element is taller than the viewport (e.g. an entire page wrapper),
        // fall back to a centered modal instead of trying to highlight all of it.
        if (r.height > window.innerHeight * 0.9 || r.width > window.innerWidth * 1.1) {
            setRect(null);
            return;
        }

        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });

        // scroll into view if needed
        const isVisible = r.top >= 0 && r.bottom <= window.innerHeight;
        if (!isVisible) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [current?.selector]);

    useLayoutEffect(() => {
        if (!open) return;
        // small delay to allow tab switch render
        const t = window.setTimeout(computeRect, 120);
        // recompute again after smooth scroll settles
        const t2 = window.setTimeout(computeRect, 500);
        return () => {
            window.clearTimeout(t);
            window.clearTimeout(t2);
        };
    }, [open, index, computeRect]);

    useEffect(() => {
        if (!open) return;
        const handler = () => computeRect();
        window.addEventListener("resize", handler);
        window.addEventListener("scroll", handler, true);
        return () => {
            window.removeEventListener("resize", handler);
            window.removeEventListener("scroll", handler, true);
        };
    }, [open, computeRect]);

    // Keyboard navigation
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") finish();
            if (e.key === "ArrowRight") next();
            if (e.key === "ArrowLeft") prev();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, index, steps.length]);

    const next = () => {
        if (index < steps.length - 1) setIndex(index + 1);
        else finish();
    };
    const prev = () => {
        if (index > 0) setIndex(index - 1);
    };
    const finish = () => {
        if (storageKey) {
            try { localStorage.setItem(storageKey, "1"); } catch { }
        }
        onClose();
    };

    const tooltipStyle = useMemo<React.CSSProperties>(() => {
        if (!rect || current?.placement === "center" || !current?.selector) {
            return {
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: TOOLTIP_WIDTH,
            };
        }

        const placement = current?.placement || "bottom";
        const spaceBelow = viewport.h - (rect.top + rect.height);
        const spaceAbove = rect.top;
        const TOOLTIP_HEIGHT_GUESS = 220;

        let top = 0;
        let left = 0;

        const finalPlacement =
            placement === "bottom" && spaceBelow < TOOLTIP_HEIGHT_GUESS && spaceAbove > spaceBelow
                ? "top"
                : placement === "top" && spaceAbove < TOOLTIP_HEIGHT_GUESS && spaceBelow > spaceAbove
                    ? "bottom"
                    : placement;

        if (finalPlacement === "bottom") {
            top = rect.top + rect.height + TOOLTIP_GAP;
            left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
        } else if (finalPlacement === "top") {
            top = rect.top - TOOLTIP_GAP - TOOLTIP_HEIGHT_GUESS;
            left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2;
        } else if (finalPlacement === "right") {
            top = rect.top + rect.height / 2 - TOOLTIP_HEIGHT_GUESS / 2;
            left = rect.left + rect.width + TOOLTIP_GAP;
        } else if (finalPlacement === "left") {
            top = rect.top + rect.height / 2 - TOOLTIP_HEIGHT_GUESS / 2;
            left = rect.left - TOOLTIP_GAP - TOOLTIP_WIDTH;
        }

        // clamp
        left = Math.max(12, Math.min(left, viewport.w - TOOLTIP_WIDTH - 12));
        top = Math.max(12, Math.min(top, viewport.h - 80));

        return { top, left, width: TOOLTIP_WIDTH };
    }, [rect, viewport, current?.placement, current?.selector]);

    const spotlightStyle = useMemo<React.CSSProperties | undefined>(() => {
        if (!rect) return undefined;
        return {
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
        };
    }, [rect]);

    if (!open || !current) return null;

    const isCentered = !rect || current.placement === "center" || !current.selector;

    const OVERLAY_CLASS = "absolute bg-slate-950/85";

    return (
        <div className="fixed inset-0 z-[100]" aria-modal="true" role="dialog">
            {/* Overlay using 4 rectangles around the spotlight cutout */}
            {rect ? (
                <>
                    {/* Top */}
                    <div className={OVERLAY_CLASS} style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - PADDING) }} />
                    {/* Bottom */}
                    <div className={OVERLAY_CLASS} style={{ top: rect.top + rect.height + PADDING, left: 0, right: 0, bottom: 0 }} />
                    {/* Left */}
                    <div className={OVERLAY_CLASS} style={{ top: Math.max(0, rect.top - PADDING), left: 0, width: Math.max(0, rect.left - PADDING), height: rect.height + PADDING * 2 }} />
                    {/* Right */}
                    <div className={OVERLAY_CLASS} style={{ top: Math.max(0, rect.top - PADDING), left: rect.left + rect.width + PADDING, right: 0, height: rect.height + PADDING * 2 }} />
                    {/* Bright halo around the spotlight to make it pop */}
                    <div
                        className="absolute rounded-xl pointer-events-none transition-all duration-200"
                        style={{
                            ...spotlightStyle,
                            boxShadow:
                                "0 0 0 3px rgba(16,185,129,0.95), 0 0 0 9px rgba(16,185,129,0.35), 0 0 60px 20px rgba(255,255,255,0.18)",
                        }}
                    />
                </>
            ) : (
                <div className="absolute inset-0 bg-slate-950/85" />
            )}

            {/* Tooltip */}
            <div
                className="absolute rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
                style={tooltipStyle}
            >
                <div className="p-5">
                    <div className="flex items-center justify-between gap-4">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            Tour guiado
                        </span>
                        <span className="text-xs font-medium text-slate-400">
                            {index + 1} / {steps.length}
                        </span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-slate-900">{current.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{current.description}</p>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
                    <button
                        type="button"
                        onClick={finish}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                        Pular tour
                    </button>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={prev}
                            disabled={index === 0}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Voltar
                        </button>
                        <button
                            type="button"
                            onClick={next}
                            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                            {index === steps.length - 1 ? "Concluir" : "Próximo"}
                        </button>
                    </div>
                </div>
            </div>

            {/* For centered steps, also dim full screen */}
            {isCentered && (
                <button
                    type="button"
                    aria-label="Fechar tour"
                    onClick={finish}
                    className="absolute inset-0 -z-10 cursor-default"
                />
            )}
        </div>
    );
}

export default SupplierTour;

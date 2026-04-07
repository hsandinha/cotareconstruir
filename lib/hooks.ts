"use client";

import { useEffect, useState, useRef, useCallback } from "react";

/**
 * useDebounce — Returns a debounced version of the input value.
 *
 * Usage:
 *   const [search, setSearch] = useState("");
 *   const debouncedSearch = useDebounce(search, 300);
 *
 *   useEffect(() => { fetchResults(debouncedSearch); }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

/**
 * usePolling — Runs a callback at a given interval, only when the page is visible.
 *
 * Usage:
 *   usePolling(() => fetchData(), 30000);
 */
export function usePolling(callback: () => void, intervalMs: number, enabled: boolean = true) {
    const savedCallback = useRef(callback);

    useEffect(() => {
        savedCallback.current = callback;
    }, [callback]);

    useEffect(() => {
        if (!enabled) return;

        const tick = () => {
            if (document.visibilityState === 'visible') {
                savedCallback.current();
            }
        };

        const id = setInterval(tick, intervalMs);
        return () => clearInterval(id);
    }, [intervalMs, enabled]);
}

/**
 * usePaginatedQuery — Manages pagination state for table views.
 *
 * Usage:
 *   const { page, setPage, pageSize, offset, totalPages, setTotal } = usePaginatedQuery(15);
 */
export function usePaginatedQuery(defaultPageSize: number = 15) {
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const pageSize = defaultPageSize;

    const offset = page * pageSize;
    const totalPages = Math.ceil(total / pageSize);

    const goNext = useCallback(() => {
        if (page < totalPages - 1) setPage(p => p + 1);
    }, [page, totalPages]);

    const goPrev = useCallback(() => {
        if (page > 0) setPage(p => p - 1);
    }, [page]);

    const reset = useCallback(() => setPage(0), []);

    return { page, setPage, pageSize, offset, total, setTotal, totalPages, goNext, goPrev, reset };
}

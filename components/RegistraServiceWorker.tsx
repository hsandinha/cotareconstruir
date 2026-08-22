"use client";

import { useEffect } from "react";

/**
 * Registra o service worker (necessário para o app ser instalável).
 * Só em produção: em desenvolvimento o cache atrapalha o hot reload.
 */
export function RegistraServiceWorker() {
    useEffect(() => {
        if (process.env.NODE_ENV !== "production") return;
        if (!("serviceWorker" in navigator)) return;

        const registrar = () => {
            navigator.serviceWorker
                .register("/sw.js")
                .catch((erro) => console.error("Falha ao registrar service worker:", erro));
        };

        // Espera a página carregar para não competir por banda
        if (document.readyState === "complete") registrar();
        else window.addEventListener("load", registrar, { once: true });
    }, []);

    return null;
}

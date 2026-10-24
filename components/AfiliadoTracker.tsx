"use client";

import { useEffect } from "react";

/**
 * Avisa o servidor que o visitante chegou por um link de parceiro.
 *
 * O cookie com o código quem grava é o `proxy.ts`, na borda — este
 * componente só registra a visita para o funil do parceiro (quantos cliques
 * viraram cadastro). Fica no layout raiz porque o parceiro divulga o link
 * apontando para qualquer página do site.
 *
 * Registra UMA vez por aba (`sessionStorage`): quem navega por cinco páginas
 * fez uma visita, não cinco. Se o `sessionStorage` estiver bloqueado, o pior
 * caso é registrar de novo — o rate limit da rota segura o resto.
 */
export function AfiliadoTracker() {
    useEffect(() => {
        const temRef = document.cookie.split("; ").some((c) => c.startsWith("cc_ref="));
        if (!temRef) return;

        const marca = "cc_ref_registrado";
        try {
            if (sessionStorage.getItem(marca)) return;
            sessionStorage.setItem(marca, "1");
        } catch {
            // Aba anônima ou storage bloqueado: segue e registra
        }

        const params = new URLSearchParams(window.location.search);
        const utm: Record<string, string> = {};
        for (const [chave, valor] of params.entries()) {
            if (chave.startsWith("utm_")) utm[chave] = valor;
        }

        fetch("/api/afiliados/clique", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                destino: window.location.pathname,
                utm: Object.keys(utm).length ? utm : undefined,
            }),
            keepalive: true,
        }).catch(() => {
            // Métrica de funil não pode atrapalhar a navegação de ninguém
        });
    }, []);

    return null;
}

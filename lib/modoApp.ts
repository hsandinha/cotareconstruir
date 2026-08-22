"use client";

import { useEffect, useState } from "react";

const MARCA_APP = "modo_app";

/**
 * O app está rodando instalado (fora do navegador)?
 *
 * Três sinais, porque nenhum é confiável sozinho:
 *  1. `?modo=app` no start_url — o mais forte, o navegador abre essa URL
 *     exata a partir do ícone. Fica gravado na sessão porque some na
 *     primeira navegação interna.
 *  2. `display-mode: standalone/fullscreen` — falha em alguns launchers.
 *  3. `navigator.standalone` — o jeito antigo do Safari no iPhone.
 */
export function rodandoComoApp(): boolean {
    if (typeof window === "undefined") return false;

    try {
        if (new URLSearchParams(window.location.search).get("modo") === "app") {
            sessionStorage.setItem(MARCA_APP, "1");
            return true;
        }
        if (sessionStorage.getItem(MARCA_APP) === "1") return true;
    } catch {
        /* modo privado: segue pelos outros sinais */
    }

    return window.matchMedia("(display-mode: standalone)").matches
        || window.matchMedia("(display-mode: fullscreen)").matches
        || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

/**
 * Versão para render: começa `false` e só vira `true` depois de montar,
 * senão o HTML do servidor e o do cliente divergem na hidratação.
 */
export function useModoApp(): boolean {
    const [modoApp, setModoApp] = useState(false);
    useEffect(() => { setModoApp(rodandoComoApp()); }, []);
    return modoApp;
}

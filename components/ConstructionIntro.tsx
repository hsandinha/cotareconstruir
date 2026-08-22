"use client";

import { useEffect, useState } from "react";
import { rodandoComoApp } from "@/lib/modoApp";

/**
 * Abertura do app instalado: um prédio sendo construído.
 *
 * Só roda no PWA (`display-mode: standalone`). No navegador não aparece —
 * quem chega pela busca quer ler a página, não esperar animação.
 *
 * SVG + CSS puro, sem biblioteca. A sequência é a da obra de verdade:
 * fundação → pilares → lajes subindo → alvenaria → janelas acendendo,
 * com a grua girando ao lado.
 *
 * Regras que valem mais que o efeito:
 *   - roda uma vez por sessão (reabrir o app não faz esperar de novo);
 *   - qualquer toque ou tecla pula;
 *   - com "reduzir movimento" ligado no aparelho, nem aparece;
 *   - é só uma camada por cima — a tela já está montada embaixo.
 */

const CHAVE_SESSAO = "app_abertura_vista";
const DURACAO_MS = 3600;

export function ConstructionIntro() {
    const [visivel, setVisivel] = useState(false);
    const [saindo, setSaindo] = useState(false);

    useEffect(() => {
        // Só no app instalado
        if (!rodandoComoApp()) return;

        // Consulta direta ao matchMedia: na hidratação um hook ainda
        // devolveria o valor do servidor e a abertura escaparia para quem
        // pediu menos movimento.
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        try {
            if (sessionStorage.getItem(CHAVE_SESSAO) === "1") return;
            sessionStorage.setItem(CHAVE_SESSAO, "1");
        } catch {
            /* modo privado: mostra assim mesmo, uma vez */
        }
        setVisivel(true);
    }, []);

    useEffect(() => {
        if (!visivel) return;

        // Trava a rolagem enquanto a abertura ocupa a tela
        const overflowAnterior = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        const encerrar = () => setSaindo(true);
        const timer = setTimeout(encerrar, DURACAO_MS);
        window.addEventListener("keydown", encerrar, { once: true });

        return () => {
            clearTimeout(timer);
            window.removeEventListener("keydown", encerrar);
            document.body.style.overflow = overflowAnterior;
        };
    }, [visivel]);

    useEffect(() => {
        if (!saindo) return;
        const t = setTimeout(() => setVisivel(false), 700);
        return () => clearTimeout(t);
    }, [saindo]);

    if (!visivel) return null;

    return (
        <div
            className={`lp-abertura ${saindo ? "lp-abertura-saindo" : ""}`}
            onClick={() => setSaindo(true)}
            role="presentation"
            aria-hidden
        >
            <div className="lp-abertura-palco">
                <svg viewBox="0 0 320 300" className="lp-obra" role="img" aria-label="Prédio sendo construído">
                    {/* ---------- Grua ---------- */}
                    <g className="lp-grua">
                        <line x1="252" y1="252" x2="252" y2="70" stroke="#F97316" strokeWidth="5" />
                        <line x1="252" y1="110" x2="240" y2="252" stroke="#F97316" strokeWidth="2" opacity="0.5" />
                        <line x1="252" y1="110" x2="264" y2="252" stroke="#F97316" strokeWidth="2" opacity="0.5" />
                        <g className="lp-grua-lanca">
                            <line x1="150" y1="70" x2="278" y2="70" stroke="#F97316" strokeWidth="5" />
                            <line x1="252" y1="56" x2="278" y2="70" stroke="#F97316" strokeWidth="2" />
                            <line x1="252" y1="56" x2="160" y2="70" stroke="#F97316" strokeWidth="2" />
                            <line x1="252" y1="70" x2="252" y2="56" stroke="#F97316" strokeWidth="3" />
                            {/* cabo + carga */}
                            <line x1="176" y1="70" x2="176" y2="112" stroke="#1C1917" strokeWidth="1.5" className="lp-cabo" />
                            <rect x="167" y="112" width="18" height="12" rx="1.5" fill="#1C1917" className="lp-carga" />
                        </g>
                    </g>

                    {/* ---------- Prédio: lajes subindo ---------- */}
                    <g className="lp-predio">
                        {[0, 1, 2, 3, 4].map((andar) => {
                            const y = 216 - andar * 34;
                            return (
                                <g key={andar} className="lp-andar" style={{ animationDelay: `${0.35 + andar * 0.32}s` }}>
                                    {/* laje */}
                                    <rect x="52" y={y} width="112" height="8" rx="1" fill="#1C1917" />
                                    {/* alvenaria */}
                                    <rect x="56" y={y - 24} width="104" height="24" fill="#F1EDE7" stroke="#D6D3D1" strokeWidth="1.5" />
                                    {/* janelas acendendo */}
                                    <rect x="64" y={y - 18} width="20" height="13" fill="#FAF8F5" className="lp-janela"
                                        style={{ animationDelay: `${1.5 + andar * 0.28}s` }} />
                                    <rect x="98" y={y - 18} width="20" height="13" fill="#FAF8F5" className="lp-janela"
                                        style={{ animationDelay: `${1.65 + andar * 0.28}s` }} />
                                    <rect x="132" y={y - 18} width="20" height="13" fill="#FAF8F5" className="lp-janela"
                                        style={{ animationDelay: `${1.8 + andar * 0.28}s` }} />
                                </g>
                            );
                        })}
                        {/* pilares aparecendo antes das lajes */}
                        <rect x="52" y="60" width="7" height="164" fill="#1C1917" className="lp-pilar" />
                        <rect x="157" y="60" width="7" height="164" fill="#1C1917" className="lp-pilar" style={{ animationDelay: "0.15s" }} />
                    </g>

                    {/* ---------- Fundação e terreno ---------- */}
                    <rect x="40" y="224" width="136" height="10" fill="#1C1917" className="lp-fundacao" />
                    <line x1="8" y1="252" x2="312" y2="252" stroke="#1C1917" strokeWidth="3" className="lp-terreno" />
                    <line x1="8" y1="258" x2="312" y2="258" stroke="#D6D3D1" strokeWidth="2" strokeDasharray="6 8" className="lp-terreno" />
                </svg>

                <p className="lp-abertura-marca">Comprar &amp; Construir</p>
                <p className="lp-abertura-frase">a obra começa na cotação</p>
            </div>

            <button type="button" className="lp-abertura-pular" onClick={() => setSaindo(true)}>
                Pular
            </button>
        </div>
    );
}

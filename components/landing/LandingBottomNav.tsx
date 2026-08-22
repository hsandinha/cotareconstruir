"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Home, Map, Video, Rocket, LogIn } from "lucide-react";

/**
 * Menu inferior flutuante da página inicial (só no celular).
 *
 * Diferente do menu dos painéis, aqui os itens são âncoras da própria
 * página — o item ativo acompanha a seção que está na tela, como um índice
 * que anda junto com a rolagem.
 */

const SECOES = [
    { id: "hero", label: "Início", icon: Home },
    { id: "metodologia", label: "Como é", icon: Map },
    { id: "depoimentos", label: "Depoimentos", icon: Video },
    { id: "teste-gratuito", label: "Testar", icon: Rocket },
] as const;

export function LandingBottomNav() {
    const [ativo, setAtivo] = useState<string>("hero");
    const [temDepoimentos, setTemDepoimentos] = useState(false);

    // A seção de depoimentos só existe quando há vídeo publicado, e ela
    // entra depois do fetch — por isso reconferimos algumas vezes.
    useEffect(() => {
        const conferir = () => setTemDepoimentos(Boolean(document.getElementById("depoimentos")));
        conferir();
        const t1 = setTimeout(conferir, 1500);
        const t2 = setTimeout(conferir, 4000);
        return () => { clearTimeout(t1); clearTimeout(t2); };
    }, []);

    // Marca como ativa a seção que ocupa o meio da tela
    useEffect(() => {
        const observador = new IntersectionObserver(
            (entradas) => {
                const visivel = entradas
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
                if (visivel?.target.id) setAtivo(visivel.target.id);
            },
            { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.25, 0.5, 1] }
        );

        SECOES.forEach((s) => {
            const el = document.getElementById(s.id);
            if (el) observador.observe(el);
        });
        return () => observador.disconnect();
    }, [temDepoimentos]);

    const itens = SECOES.filter((s) => s.id !== "depoimentos" || temDepoimentos);

    return (
        <nav
            aria-label="Seções da página"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D6D3D1] bg-[#FAF8F5]/95 backdrop-blur-lg md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <ul className="mx-auto flex max-w-lg items-stretch">
                {itens.map((secao) => {
                    const Icone = secao.icon;
                    const selecionado = ativo === secao.id;
                    return (
                        <li key={secao.id} className="flex-1">
                            <Link
                                href={`#${secao.id}`}
                                aria-current={selecionado ? "true" : undefined}
                                className="flex flex-col items-center gap-0.5 px-1 py-2 transition-transform active:scale-95"
                            >
                                <Icone className={`h-6 w-6 transition-colors ${selecionado ? "text-[#F97316]" : "text-[#A8A29E]"}`} />
                                <span className={`max-w-full truncate text-[10px] font-bold uppercase tracking-wide ${selecionado ? "text-[#1C1917]" : "text-[#78716C]"}`}>
                                    {secao.label}
                                </span>
                            </Link>
                        </li>
                    );
                })}

                {/* Entrar fecha a barra: quem já é cliente vai direto */}
                <li className="flex-1">
                    <Link
                        href="/login"
                        className="flex flex-col items-center gap-0.5 px-1 py-2 transition-transform active:scale-95"
                    >
                        <LogIn className="h-6 w-6 text-[#A8A29E]" />
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#78716C]">Entrar</span>
                    </Link>
                </li>
            </ul>
        </nav>
    );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Home, Map, Rocket, LogIn } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { floatingWhatsApp } from "@/lib/content";

/**
 * Menu inferior flutuante da página inicial (só no celular).
 *
 * Diferente do menu dos painéis, aqui os itens são âncoras da própria
 * página — o item ativo acompanha a seção que está na tela, como um índice
 * que anda junto com a rolagem.
 */

/**
 * Cinco alvos é o teto para a barra caber em 375px sem apertar. O WhatsApp
 * entrou aqui porque, flutuando, ele cobria o menu. "Depoimentos" saiu da
 * barra: continua na página, alcançável rolando.
 */
const SECOES = [
    { id: "hero", label: "Início", icon: Home },
    { id: "metodologia", label: "Como é", icon: Map },
    { id: "teste-gratuito", label: "Testar", icon: Rocket },
] as const;

export function LandingBottomNav() {
    const [ativo, setAtivo] = useState<string>("hero");
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
    }, []);

    return (
        <nav
            aria-label="Seções da página"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-[#D6D3D1] bg-[#FAF8F5]/95 backdrop-blur-lg md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <ul className="mx-auto flex max-w-lg items-stretch">
                {SECOES.map((secao) => {
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

                {/* WhatsApp: era um botão flutuante que cobria esta barra */}
                <li className="flex-1">
                    <a
                        href={`https://wa.me/${floatingWhatsApp.phone}?text=${encodeURIComponent(floatingWhatsApp.message)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-0.5 px-1 py-2 transition-transform active:scale-95"
                    >
                        <span className="flex h-6 w-6 items-center justify-center">
                            <FontAwesomeIcon icon={faWhatsapp} className="text-[22px] text-[#25D366]" />
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#78716C]">WhatsApp</span>
                    </a>
                </li>

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

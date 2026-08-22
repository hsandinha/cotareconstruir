"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Share, Plus, X, Smartphone } from "lucide-react";

/**
 * Instalação do app (PWA).
 *
 * Android/Chrome dispara `beforeinstallprompt` e dá para instalar com um
 * clique. iPhone/Safari não tem essa API — a instalação é manual pelo menu
 * Compartilhar, então lá mostramos o passo a passo.
 */

type PromptInstalacao = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CHAVE_DISPENSADO = "pwa_convite_dispensado_v1";

/** Já está rodando instalado? Então não há o que oferecer. */
function estaInstalado(): boolean {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(display-mode: standalone)").matches
        || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
}

function ehIos(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    // iPadOS recente se identifica como Mac; o toque é o que o denuncia
    return /iPad|iPhone|iPod/.test(ua)
        || (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
}

export function useInstalacaoPwa() {
    const [prompt, setPrompt] = useState<PromptInstalacao | null>(null);
    const [instalado, setInstalado] = useState(true); // pessimista até checar
    const [ios, setIos] = useState(false);

    useEffect(() => {
        setInstalado(estaInstalado());
        setIos(ehIos());

        const aoReceberPrompt = (e: Event) => {
            e.preventDefault(); // sem isso o Chrome mostra o banner dele
            setPrompt(e as PromptInstalacao);
        };
        const aoInstalar = () => { setInstalado(true); setPrompt(null); };

        window.addEventListener("beforeinstallprompt", aoReceberPrompt);
        window.addEventListener("appinstalled", aoInstalar);
        return () => {
            window.removeEventListener("beforeinstallprompt", aoReceberPrompt);
            window.removeEventListener("appinstalled", aoInstalar);
        };
    }, []);

    const instalar = useCallback(async () => {
        if (!prompt) return false;
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        setPrompt(null);
        return outcome === "accepted";
    }, [prompt]);

    return { podeInstalarDireto: Boolean(prompt), instalar, instalado, ios };
}

/** Passo a passo do iPhone, onde não existe botão de instalar. */
export function PassosIphone() {
    return (
        <ol className="space-y-3 text-sm text-slate-600">
            <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">1</span>
                <span className="flex flex-wrap items-center gap-1.5">
                    Toque em <Share className="inline h-4 w-4 text-blue-600" aria-hidden />
                    <strong>Compartilhar</strong>, na barra do Safari.
                </span>
            </li>
            <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">2</span>
                <span className="flex flex-wrap items-center gap-1.5">
                    Role a lista e escolha <Plus className="inline h-4 w-4" aria-hidden />
                    <strong>Adicionar à Tela de Início</strong>.
                </span>
            </li>
            <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">3</span>
                <span>Confirme em <strong>Adicionar</strong>. O ícone aparece junto dos seus apps.</span>
            </li>
            <li className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Precisa ser pelo <strong>Safari</strong>. No iPhone, Chrome e Firefox não conseguem instalar.
            </li>
        </ol>
    );
}

/**
 * Faixa flutuante convidando a instalar. Aparece uma vez; se a pessoa
 * dispensar, some e não volta a incomodar.
 */
export function ConviteInstalarPwa() {
    const { podeInstalarDireto, instalar, instalado, ios } = useInstalacaoPwa();
    const [dispensado, setDispensado] = useState(true);
    const [mostrandoPassos, setMostrandoPassos] = useState(false);

    useEffect(() => {
        try {
            setDispensado(localStorage.getItem(CHAVE_DISPENSADO) === "1");
        } catch {
            setDispensado(false);
        }
    }, []);

    const dispensar = () => {
        setDispensado(true);
        try { localStorage.setItem(CHAVE_DISPENSADO, "1"); } catch { /* modo privado */ }
    };

    if (instalado || dispensado) return null;
    if (!podeInstalarDireto && !ios) return null; // desktop sem suporte: nada a oferecer

    return (
        <>
            <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-40 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:inset-x-auto md:right-6 md:bottom-6 md:max-w-sm">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
                        <Smartphone className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">Instale o app</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                            Acesso direto da tela inicial, sem barra de navegador.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                onClick={() => (podeInstalarDireto ? instalar() : setMostrandoPassos(true))}
                                className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                                {podeInstalarDireto ? "Instalar" : "Como instalar"}
                            </button>
                            <button onClick={dispensar} className="rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100">
                                Agora não
                            </button>
                        </div>
                    </div>
                    <button onClick={dispensar} aria-label="Fechar" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {mostrandoPassos && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setMostrandoPassos(false)}>
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-900">Instalar no iPhone</h3>
                            <button onClick={() => setMostrandoPassos(false)} aria-label="Fechar" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <PassosIphone />
                    </div>
                </div>
            )}
        </>
    );
}

/** Botão de instalar para colocar em página (ex.: Ajuda). */
export function BotaoInstalarPwa() {
    const { podeInstalarDireto, instalar, instalado, ios } = useInstalacaoPwa();
    const [mostrandoPassos, setMostrandoPassos] = useState(false);

    if (instalado) {
        return (
            <p className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                <Smartphone className="h-4 w-4" />
                App já instalado neste aparelho.
            </p>
        );
    }

    return (
        <>
            <button
                onClick={() => (podeInstalarDireto ? instalar() : setMostrandoPassos(true))}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
                <Download className="h-4 w-4" />
                {podeInstalarDireto ? "Instalar app" : ios ? "Como instalar no iPhone" : "Como instalar"}
            </button>

            {mostrandoPassos && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setMostrandoPassos(false)}>
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-900">
                                {ios ? "Instalar no iPhone" : "Instalar o app"}
                            </h3>
                            <button onClick={() => setMostrandoPassos(false)} aria-label="Fechar" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {ios ? (
                            <PassosIphone />
                        ) : (
                            <ol className="space-y-3 text-sm text-slate-600">
                                <li>1. Abra o menu do navegador (⋮).</li>
                                <li>2. Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</li>
                                <li>3. Confirme. O ícone aparece junto dos seus apps.</li>
                            </ol>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}

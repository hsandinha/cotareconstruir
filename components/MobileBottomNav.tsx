"use client";

import type { ComponentType } from "react";

export type ItemMenu = {
    id: string;
    label: string;
    icon: ComponentType<{ className?: string }>;
    badge?: number;
};

type Props = {
    itens: ItemMenu[];
    ativo: string;
    onSelecionar: (id: string) => void;
    /** Abre a lista completa quando há mais itens do que cabem na barra. */
    onMais?: () => void;
};

/**
 * Menu inferior flutuante do celular, no formato de app (estilo Instagram).
 *
 * Só aparece abaixo de `md`; no desktop as abas de cima continuam mandando.
 * A altura reservada no corpo da página vem da classe `.tem-menu-inferior`
 * (globals.css), que já soma a área segura do iPhone.
 *
 * A barra comporta no máximo 5 alvos de toque sem apertar demais — havendo
 * mais seções, a quinta vira "Mais" e abre a lista completa.
 */
export function MobileBottomNav({ itens, ativo, onSelecionar, onMais }: Props) {
    const cabemDireto = itens.length <= 5;
    const visiveis = cabemDireto ? itens : itens.slice(0, 4);
    const ocultos = cabemDireto ? [] : itens.slice(4);
    const ativoEstaOculto = ocultos.some((i) => i.id === ativo);

    return (
        <nav
            aria-label="Navegação principal"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-lg md:hidden"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
            <ul className="mx-auto flex max-w-lg items-stretch">
                {visiveis.map((item) => {
                    const Icone = item.icon;
                    const selecionado = ativo === item.id;
                    return (
                        <li key={item.id} className="flex-1">
                            <button
                                type="button"
                                onClick={() => onSelecionar(item.id)}
                                aria-current={selecionado ? "page" : undefined}
                                className="relative flex w-full flex-col items-center gap-0.5 px-1 py-2 active:scale-95 transition-transform"
                            >
                                <span className="relative">
                                    <Icone
                                        className={`h-6 w-6 transition-colors ${selecionado ? "text-blue-600" : "text-slate-400"}`}
                                    />
                                    {item.badge ? (
                                        <span className="absolute -right-1.5 -top-1 min-w-[16px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-4 text-white">
                                            {item.badge > 9 ? "9+" : item.badge}
                                        </span>
                                    ) : null}
                                </span>
                                <span
                                    className={`max-w-full truncate text-[10px] font-medium leading-tight ${selecionado ? "text-blue-600" : "text-slate-500"}`}
                                >
                                    {item.label}
                                </span>
                            </button>
                        </li>
                    );
                })}

                {ocultos.length > 0 && (
                    <li className="flex-1">
                        <button
                            type="button"
                            onClick={onMais}
                            aria-label="Mais seções"
                            className="relative flex w-full flex-col items-center gap-0.5 px-1 py-2 active:scale-95 transition-transform"
                        >
                            <span className={`flex h-6 w-6 items-center justify-center ${ativoEstaOculto ? "text-blue-600" : "text-slate-400"}`}>
                                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
                                    <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
                                    <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
                                </svg>
                            </span>
                            <span className={`text-[10px] font-medium leading-tight ${ativoEstaOculto ? "text-blue-600" : "text-slate-500"}`}>
                                Mais
                            </span>
                        </button>
                    </li>
                )}
            </ul>
        </nav>
    );
}

/** Folha inferior com as seções que não couberam na barra. */
export function MenuMaisSheet({
    aberto, itens, ativo, onSelecionar, onFechar,
}: {
    aberto: boolean;
    itens: ItemMenu[];
    ativo: string;
    onSelecionar: (id: string) => void;
    onFechar: () => void;
}) {
    if (!aberto) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 md:hidden" onClick={onFechar}>
            <div
                className="w-full rounded-t-2xl bg-white p-4"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-300" />
                <ul className="space-y-1">
                    {itens.map((item) => {
                        const Icone = item.icon;
                        const selecionado = ativo === item.id;
                        return (
                            <li key={item.id}>
                                <button
                                    type="button"
                                    onClick={() => { onSelecionar(item.id); onFechar(); }}
                                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium ${selecionado ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}
                                >
                                    <Icone className={`h-5 w-5 ${selecionado ? "text-blue-600" : "text-slate-400"}`} />
                                    <span className="flex-1 truncate">{item.label}</span>
                                    {item.badge ? (
                                        <span className="rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">{item.badge}</span>
                                    ) : null}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}

"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { parseFlexibleNumber } from "@/lib/csvSpreadsheet";

export interface ItemCotacao {
    id: string;
    nome: string;
    fabricante?: string | null;
    unidade?: string | null;
    quantidade: number;
}

export interface ValoresProposta {
    precos: Record<string, string>;
    frete: string;
    impostos: string;
    desconto: string;
    prazoEntrega: string;
    condicoesPagamento: string;
    validade: string;
    observacoes: string;
}

export interface PayloadProposta {
    itens: Array<{
        cotacao_item_id: string;
        preco_unitario: number;
        quantidade: number;
        subtotal: number;
        disponibilidade: "disponivel" | "indisponivel";
        prazo_dias: number;
    }>;
    valorTotal: number;
    valorFrete: number;
    valorImpostos: number;
    valorDesconto: number;
    prazoEntrega: number | null;
    condicoesPagamento: string;
    observacoes: string;
    dataValidade: string;
}

const VALIDADES = ["7-dias", "15-dias", "30-dias", "60-dias"];

const brl = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Converte o que foi digitado, aceitando "38,90" e "R$ 1.250,00". */
const numero = (texto: string): number => Math.max(parseFlexibleNumber(texto) || 0, 0);

export const VALORES_VAZIOS: ValoresProposta = {
    precos: {},
    frete: "",
    impostos: "",
    desconto: "",
    prazoEntrega: "",
    condicoesPagamento: "",
    validade: "30-dias",
    observacoes: "",
};

/**
 * Formulário de proposta do fornecedor.
 *
 * Mora aqui, e não dentro de uma das telas, porque dois lugares precisam da
 * MESMA conta: o modal do administrador lançando pelo fornecedor e a página
 * pública que o fornecedor abre pelo link do WhatsApp. Se o cálculo do total
 * divergisse entre os dois, o mapa comparativo do cliente passaria a depender
 * de por onde a proposta entrou.
 *
 * Desenhado para telas pequenas primeiro: o uso principal é dentro do
 * navegador do WhatsApp, com o fornecedor em pé no balcão da loja.
 */
export function PropostaForm({
    itens,
    inicial,
    onSubmit,
    enviando,
    rotuloBotao = "Enviar proposta",
    aviso,
}: {
    itens: ItemCotacao[];
    inicial?: Partial<ValoresProposta>;
    onSubmit: (payload: PayloadProposta) => void;
    enviando?: boolean;
    rotuloBotao?: string;
    aviso?: string;
}) {
    const [v, setV] = useState<ValoresProposta>({ ...VALORES_VAZIOS, ...inicial });
    const [erro, setErro] = useState<string | null>(null);

    const set = (campo: keyof ValoresProposta, valor: string) =>
        setV((atual) => ({ ...atual, [campo]: valor }));

    const setPreco = (itemId: string, valor: string) =>
        setV((atual) => ({ ...atual, precos: { ...atual.precos, [itemId]: valor } }));

    const calculo = useMemo(() => {
        const mercadoria = itens.reduce((soma, item) => {
            const preco = numero(v.precos[item.id] || "");
            return soma + preco * (Number(item.quantidade) || 0);
        }, 0);

        const frete = numero(v.frete);
        const impostos = numero(v.impostos);
        // O desconto abate a mercadoria e não pode superá-la — a mesma regra
        // que o painel do fornecedor aplica.
        const desconto = Math.min(numero(v.desconto), mercadoria);
        const cotados = itens.filter((i) => numero(v.precos[i.id] || "") > 0).length;

        return { mercadoria, frete, impostos, desconto, cotados, total: mercadoria - desconto + frete + impostos };
    }, [itens, v]);

    const enviar = () => {
        if (calculo.cotados === 0) {
            setErro("Preencha o preço de pelo menos um item.");
            return;
        }
        setErro(null);

        const dias = Number(v.validade.match(/\d+/)?.[0] || 30);
        const validade = new Date();
        validade.setDate(validade.getDate() + dias);

        onSubmit({
            itens: itens.map((item) => {
                const preco = numero(v.precos[item.id] || "");
                const qtd = Number(item.quantidade) || 0;
                // Item sem preço entra como indisponível em vez de sumir: no
                // mapa comparativo, item ausente é lido como erro de envio.
                return {
                    cotacao_item_id: item.id,
                    preco_unitario: preco,
                    quantidade: qtd,
                    subtotal: preco * qtd,
                    disponibilidade: preco > 0 ? "disponivel" : "indisponivel",
                    prazo_dias: preco > 0 ? 0 : -1,
                };
            }),
            valorTotal: calculo.total,
            valorFrete: calculo.frete,
            valorImpostos: calculo.impostos,
            valorDesconto: calculo.desconto,
            prazoEntrega: v.prazoEntrega ? Math.max(0, parseInt(v.prazoEntrega, 10) || 0) : null,
            condicoesPagamento: v.condicoesPagamento.trim(),
            observacoes: v.observacoes.trim(),
            dataValidade: validade.toISOString(),
        });
    };

    const campo = "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:border-orange-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-100";
    const rotulo = "mb-1 block text-xs font-medium text-slate-600";

    return (
        <div className="space-y-5">
            {aviso && (
                <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-800">{aviso}</p>
            )}

            {/* Itens */}
            <div className="space-y-3">
                <div className="flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold text-slate-900">Itens da cotação</h3>
                    <span className="text-xs text-slate-400">{calculo.cotados} de {itens.length} cotados</span>
                </div>

                {itens.map((item) => {
                    const preco = numero(v.precos[item.id] || "");
                    const subtotal = preco * (Number(item.quantidade) || 0);
                    return (
                        <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <p className="text-sm font-medium leading-snug text-slate-900">{item.nome}</p>
                            <p className="mt-0.5 text-xs text-slate-500">
                                {item.fabricante ? `${item.fabricante} · ` : ""}
                                {Number(item.quantidade).toLocaleString("pt-BR")} {item.unidade || ""}
                            </p>
                            <div className="mt-2.5 flex items-end gap-3">
                                <div className="flex-1">
                                    <label className={rotulo}>Preço unitário</label>
                                    <input
                                        value={v.precos[item.id] || ""}
                                        onChange={(e) => setPreco(item.id, e.target.value)}
                                        inputMode="decimal"
                                        placeholder="0,00"
                                        className={campo}
                                    />
                                </div>
                                <div className="pb-2.5 text-right">
                                    <span className="block text-[10px] uppercase tracking-wide text-slate-400">Subtotal</span>
                                    <span className={`text-sm font-semibold ${subtotal > 0 ? "text-slate-900" : "text-slate-300"}`}>
                                        {brl(subtotal)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <p className="text-[11px] text-slate-400">
                    Deixe em branco o item que você não fornece — ele entra como indisponível.
                </p>
            </div>

            {/* Condições */}
            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Condições comerciais</h3>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={rotulo}>Frete (R$)</label>
                        <input value={v.frete} onChange={(e) => set("frete", e.target.value)} inputMode="decimal" placeholder="0,00" className={campo} />
                    </div>
                    <div>
                        <label className={rotulo}>Impostos (R$)</label>
                        <input value={v.impostos} onChange={(e) => set("impostos", e.target.value)} inputMode="decimal" placeholder="0,00" className={campo} />
                    </div>
                    <div>
                        <label className={rotulo}>Desconto (R$)</label>
                        <input value={v.desconto} onChange={(e) => set("desconto", e.target.value)} inputMode="decimal" placeholder="0,00" className={campo} />
                    </div>
                    <div>
                        <label className={rotulo}>Prazo de entrega (dias)</label>
                        <input value={v.prazoEntrega} onChange={(e) => set("prazoEntrega", e.target.value)} inputMode="numeric" placeholder="7" className={campo} />
                    </div>
                    <div className="col-span-2">
                        <label className={rotulo}>Condições de pagamento</label>
                        <input
                            value={v.condicoesPagamento}
                            onChange={(e) => set("condicoesPagamento", e.target.value)}
                            placeholder="Ex.: Boleto 28/42/56 dias"
                            className={campo}
                        />
                    </div>
                    <div className="col-span-2">
                        <label className={rotulo}>Validade da proposta</label>
                        <select value={v.validade} onChange={(e) => set("validade", e.target.value)} className={campo}>
                            {VALIDADES.map((d) => (
                                <option key={d} value={d}>{d.replace("-dias", " dias")}</option>
                            ))}
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className={rotulo}>Observações</label>
                        <textarea
                            value={v.observacoes}
                            onChange={(e) => set("observacoes", e.target.value)}
                            rows={2}
                            className={campo}
                        />
                    </div>
                </div>
            </div>

            {/* Total */}
            <div className="rounded-xl bg-slate-900 p-4 text-white">
                <div className="space-y-1 text-xs text-slate-300">
                    <div className="flex justify-between"><span>Mercadoria</span><span>{brl(calculo.mercadoria)}</span></div>
                    {calculo.desconto > 0 && <div className="flex justify-between"><span>Desconto</span><span>− {brl(calculo.desconto)}</span></div>}
                    {calculo.frete > 0 && <div className="flex justify-between"><span>Frete</span><span>{brl(calculo.frete)}</span></div>}
                    {calculo.impostos > 0 && <div className="flex justify-between"><span>Impostos</span><span>{brl(calculo.impostos)}</span></div>}
                </div>
                <div className="mt-2 flex items-baseline justify-between border-t border-white/15 pt-2">
                    <span className="text-sm font-medium">Total</span>
                    <span className="text-xl font-bold">{brl(calculo.total)}</span>
                </div>
            </div>

            {erro && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>}

            <button
                onClick={enviar}
                disabled={enviando}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
            >
                {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                {rotuloBotao}
            </button>
        </div>
    );
}

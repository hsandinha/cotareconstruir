"use client";

import { useCallback, useEffect, useState } from "react";
import { use } from "react";
import { CheckCircle2, Loader2, AlertCircle, MapPin } from "lucide-react";
import { PropostaForm, type ItemCotacao, type PayloadProposta } from "@/components/proposta/PropostaForm";

type Dados = {
    cotacao: { numero: string | null; aberta: boolean; local: string | null };
    fornecedor: { nome: string | null };
    itens: ItemCotacao[];
    propostaAtual: {
        enviadaEm: string;
        frete: number | null;
        impostos: number | null;
        desconto: number | null;
        prazoEntrega: number | null;
        condicoesPagamento: string | null;
        observacoes: string | null;
        precos: Record<string, string>;
    } | null;
};

const comoTexto = (v: number | null | undefined) =>
    v === null || v === undefined || Number(v) === 0 ? "" : String(v).replace(".", ",");

/**
 * Resposta de cotação pelo link — sem login.
 *
 * O fornecedor toca no link da notificação e cai aqui, dentro do navegador do
 * WhatsApp. É a alternativa ao .xlsx: baixar planilha, preencher num app e
 * devolver o arquivo derruba a taxa de resposta no celular.
 *
 * O token na URL é a credencial (ver lib/propostaLink.ts), então a página não
 * pede nada a quem chega — e também não mostra nada além desta cotação.
 */
export default function PropostaPorLink({ params }: { params: Promise<{ token: string }> }) {
    const { token } = use(params);

    const [dados, setDados] = useState<Dados | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [enviada, setEnviada] = useState<{ atualizada: boolean; numero: string } | null>(null);

    const carregar = useCallback(async () => {
        try {
            const res = await fetch(`/api/proposta-link?token=${encodeURIComponent(token)}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Não foi possível abrir esta cotação.");
            setDados(json);
        } catch (e: any) {
            setErro(e?.message || "Não foi possível abrir esta cotação.");
        } finally {
            setCarregando(false);
        }
    }, [token]);

    useEffect(() => { carregar(); }, [carregar]);

    const enviar = async (payload: PayloadProposta) => {
        setEnviando(true);
        setErro(null);
        try {
            const res = await fetch("/api/proposta-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, ...payload }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Não foi possível enviar.");
            setEnviada({ atualizada: !!json.atualizada, numero: json.cotacaoNumero });
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (e: any) {
            setErro(e?.message || "Não foi possível enviar.");
        } finally {
            setEnviando(false);
        }
    };

    if (carregando) {
        return (
            <Moldura>
                <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin" /> Abrindo cotação...
                </div>
            </Moldura>
        );
    }

    if (erro && !dados) {
        return (
            <Moldura>
                <div className="py-20 text-center">
                    <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
                    <p className="mt-3 text-sm font-medium text-slate-800">{erro}</p>
                </div>
            </Moldura>
        );
    }

    if (enviada) {
        return (
            <Moldura>
                <div className="py-16 text-center">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                    <h1 className="mt-4 text-lg font-bold text-slate-900">
                        {enviada.atualizada ? "Proposta atualizada!" : "Proposta enviada!"}
                    </h1>
                    <p className="mt-2 text-sm text-slate-600">
                        O cliente já foi avisado da sua proposta na cotação #{enviada.numero}.
                    </p>
                    <p className="mt-4 text-xs text-slate-400">
                        Precisa corrigir algum valor? Abra este mesmo link de novo e reenvie.
                    </p>
                    <button
                        onClick={() => { setEnviada(null); carregar(); }}
                        className="mt-5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700"
                    >
                        Revisar minha proposta
                    </button>
                </div>
            </Moldura>
        );
    }

    if (!dados) return null;

    if (!dados.cotacao.aberta) {
        return (
            <Moldura>
                <div className="py-20 text-center">
                    <AlertCircle className="mx-auto h-10 w-10 text-slate-400" />
                    <p className="mt-3 text-sm font-medium text-slate-800">
                        A cotação #{dados.cotacao.numero} não está mais aberta para propostas.
                    </p>
                </div>
            </Moldura>
        );
    }

    const atual = dados.propostaAtual;

    return (
        <Moldura>
            <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                    Cotação #{dados.cotacao.numero}
                </p>
                <h1 className="mt-1 text-lg font-bold leading-tight text-slate-900">
                    {atual ? "Revise sua proposta" : "Envie sua proposta"}
                </h1>
                {dados.fornecedor.nome && (
                    <p className="mt-1 text-sm text-slate-600">{dados.fornecedor.nome}</p>
                )}
                {dados.cotacao.local && (
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5" /> {dados.cotacao.local}
                    </p>
                )}
            </div>

            {erro && (
                <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{erro}</p>
            )}

            <PropostaForm
                itens={dados.itens}
                enviando={enviando}
                onSubmit={enviar}
                rotuloBotao={atual ? "Atualizar proposta" : "Enviar proposta"}
                aviso={atual
                    ? `Você já respondeu esta cotação em ${new Date(atual.enviadaEm).toLocaleDateString("pt-BR")}. Reenviar substitui os valores anteriores.`
                    : undefined}
                inicial={atual
                    ? {
                        precos: atual.precos,
                        frete: comoTexto(atual.frete),
                        impostos: comoTexto(atual.impostos),
                        desconto: comoTexto(atual.desconto),
                        prazoEntrega: atual.prazoEntrega != null ? String(atual.prazoEntrega) : "",
                        condicoesPagamento: atual.condicoesPagamento || "",
                        observacoes: atual.observacoes || "",
                    }
                    : undefined}
            />

            <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
                Este link é pessoal e vale só para esta cotação. Não repasse —
                quem o tiver responde no lugar da sua empresa.
            </p>
        </Moldura>
    );
}

/** Container estreito: o uso principal é no navegador do WhatsApp. */
function Moldura({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-50">
            <header className="border-b border-slate-200 bg-white">
                <div className="mx-auto max-w-lg px-4 py-3">
                    <span className="text-sm font-bold text-slate-900">
                        Comprar <span className="text-orange-500">&</span> Construir
                    </span>
                </div>
            </header>
            <main className="mx-auto max-w-lg px-4 py-6">{children}</main>
        </div>
    );
}

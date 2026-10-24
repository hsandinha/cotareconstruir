"use client";

import { useCallback, useEffect, useState } from "react";
import { X, Loader2, Link2, Copy, Check, Send, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { getAuthHeaders } from "@/lib/authHeaders";
import { PropostaForm, type ItemCotacao, type PayloadProposta } from "@/components/proposta/PropostaForm";

type Dados = {
    cotacao: { id: string; numero: string | null; status: string };
    fornecedor: { razao_social: string; nome_fantasia: string | null; whatsapp: string | null; telefone: string | null } | null;
    itens: ItemCotacao[];
    link: { ativo: boolean; expiraEm: string | null; abertoEm: string | null };
    propostaAtual: {
        origem: string | null;
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

const dataBr = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

/**
 * Lança a proposta de um fornecedor que não respondeu, ou manda a ele o link
 * para responder sozinho.
 *
 * São os dois tratamentos do mesmo problema: fornecedor que recebeu a cotação
 * e não voltou. Ou ele já passou o preço por fora (telefone, áudio, foto) e
 * alguém digita aqui, ou ainda não passou e o link é o empurrão — mais curto
 * que baixar planilha, preencher e devolver arquivo.
 */
export function PropostaManualModal({
    cotacaoId,
    fornecedorId,
    onFechar,
    onSalvo,
}: {
    cotacaoId: string;
    fornecedorId: string;
    onFechar: () => void;
    onSalvo?: () => void;
}) {
    const { showToast } = useToast();

    const [dados, setDados] = useState<Dados | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [gerando, setGerando] = useState(false);
    const [link, setLink] = useState<string | null>(null);
    const [copiado, setCopiado] = useState(false);
    const [aba, setAba] = useState<"lancar" | "link">("lancar");

    const carregar = useCallback(async () => {
        setCarregando(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(
                `/api/admin/proposta-manual?cotacaoId=${encodeURIComponent(cotacaoId)}&fornecedorId=${encodeURIComponent(fornecedorId)}`,
                { headers, credentials: "include" }
            );
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Erro ao carregar");
            setDados(json);
        } catch (e: any) {
            setErro(e?.message || "Não foi possível carregar a cotação.");
        } finally {
            setCarregando(false);
        }
    }, [cotacaoId, fornecedorId]);

    useEffect(() => { carregar(); }, [carregar]);

    const lancar = async (payload: PayloadProposta) => {
        setEnviando(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/proposta-manual", {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ acao: "lancar", cotacaoId, fornecedorId, ...payload }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Erro ao lançar");

            showToast("success", json.atualizada
                ? `Proposta atualizada na cotação #${json.cotacaoNumero}. O cliente foi avisado.`
                : `Proposta lançada na cotação #${json.cotacaoNumero}. O cliente foi avisado.`);
            onSalvo?.();
            onFechar();
        } catch (e: any) {
            showToast("error", e?.message || "Não foi possível lançar a proposta.");
        } finally {
            setEnviando(false);
        }
    };

    const gerarLink = async (enviarWhatsapp: boolean) => {
        setGerando(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch("/api/admin/proposta-manual", {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ acao: "gerar-link", cotacaoId, fornecedorId, enviarWhatsapp }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json?.error || "Erro ao gerar link");

            setLink(json.url);

            if (enviarWhatsapp) {
                if (json.whatsapp?.enviado) {
                    showToast("success", "Link enviado no WhatsApp do fornecedor.");
                } else {
                    // Fora da janela de 24h a Meta recusa texto livre. Dizer
                    // isso é melhor que um "enviado" que não chegou.
                    showToast("error", `Link gerado, mas o envio falhou: ${json.whatsapp?.erro || "motivo desconhecido"}. Copie e mande manualmente.`);
                }
            } else {
                showToast("success", "Link gerado. Copie e envie ao fornecedor.");
            }
        } catch (e: any) {
            showToast("error", e?.message || "Não foi possível gerar o link.");
        } finally {
            setGerando(false);
        }
    };

    const copiar = async () => {
        if (!link) return;
        try {
            await navigator.clipboard.writeText(link);
            setCopiado(true);
            setTimeout(() => setCopiado(false), 2000);
        } catch {
            showToast("error", "Copie manualmente da caixa acima.");
        }
    };

    const nome = dados?.fornecedor?.nome_fantasia || dados?.fornecedor?.razao_social || "Fornecedor";
    const atual = dados?.propostaAtual;

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
            <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
                {/* Cabeçalho */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                            Cotação #{dados?.cotacao?.numero || "…"}
                        </p>
                        <h2 className="truncate text-base font-bold text-slate-900">{nome}</h2>
                    </div>
                    <button onClick={onFechar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Abas */}
                <div className="flex gap-1 border-b border-slate-100 px-5 pt-3">
                    {([["lancar", "Lançar proposta"], ["link", "Enviar link"]] as const).map(([id, rotulo]) => (
                        <button
                            key={id}
                            onClick={() => setAba(id)}
                            className={`rounded-t-lg px-3 py-2 text-sm font-medium ${aba === id
                                ? "border-b-2 border-orange-500 text-orange-600"
                                : "text-slate-500 hover:text-slate-800"}`}
                        >
                            {rotulo}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5">
                    {carregando && (
                        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                            <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
                        </div>
                    )}

                    {erro && !carregando && (
                        <div className="py-12 text-center">
                            <AlertCircle className="mx-auto h-8 w-8 text-amber-500" />
                            <p className="mt-2 text-sm text-slate-700">{erro}</p>
                        </div>
                    )}

                    {dados && !carregando && aba === "lancar" && (
                        <PropostaForm
                            itens={dados.itens}
                            enviando={enviando}
                            onSubmit={lancar}
                            rotuloBotao={atual ? "Atualizar proposta" : "Lançar proposta"}
                            aviso={atual
                                ? `Este fornecedor já tem proposta de ${dataBr(atual.enviadaEm)}${atual.origem === "admin" ? " (lançada aqui)" : ""}. Salvar substitui os valores.`
                                : "Os valores entram como proposta do fornecedor e ficam marcados como lançados pela administração. O cliente é avisado como em qualquer outra proposta."}
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
                    )}

                    {dados && !carregando && aba === "link" && (
                        <div className="space-y-4">
                            <p className="text-sm leading-relaxed text-slate-600">
                                O fornecedor abre o link no próprio WhatsApp e preenche os preços pela tela — sem
                                baixar planilha e sem fazer login. O link é exclusivo dele e vale só para esta cotação.
                            </p>

                            {dados.link.ativo && !link && (
                                <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-800">
                                    Já existe um link ativo para este fornecedor (vence em {dataBr(dados.link.expiraEm)}
                                    {dados.link.abertoEm ? `, aberto em ${dataBr(dados.link.abertoEm)}` : ", ainda não aberto"}).
                                    Gerar outro invalida o anterior.
                                </div>
                            )}

                            {link && (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        Link gerado
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <input
                                            readOnly
                                            value={link}
                                            onFocus={(e) => e.currentTarget.select()}
                                            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs"
                                        />
                                        <button
                                            onClick={copiar}
                                            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100"
                                        >
                                            {copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col gap-2 sm:flex-row">
                                <button
                                    onClick={() => gerarLink(true)}
                                    disabled={gerando}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    Gerar e enviar no WhatsApp
                                </button>
                                <button
                                    onClick={() => gerarLink(false)}
                                    disabled={gerando}
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    <Link2 className="h-4 w-4" />
                                    Só gerar o link
                                </button>
                            </div>

                            <p className="text-[11px] leading-relaxed text-slate-400">
                                O envio automático só entrega se o fornecedor tiver conversado com a gente nas
                                últimas 24h — é regra da Meta para mensagem de texto livre. Fora disso, copie o
                                link e mande por onde preferir.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

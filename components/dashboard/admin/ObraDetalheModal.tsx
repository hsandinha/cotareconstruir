'use client';

/**
 * Tudo que aconteceu com uma obra na plataforma.
 *
 * Cinco abas porque as perguntas são diferentes: "como está o cronograma",
 * "o que foi cotado e quem respondeu", "o que virou pedido" e "o que
 * aconteceu, em ordem". O resumo abre primeiro, com os números que
 * respondem de bate-pronto.
 */

import { useEffect, useState } from 'react';
import {
    X, Loader2, Briefcase, MapPin, Calendar, Layers, FileText, ShoppingCart,
    Activity, ChevronDown, ChevronRight, Check, Eye, Ban, Paperclip,
    MessageSquare, TrendingDown, Building2, User,
} from 'lucide-react';
import { authFetch } from '@/lib/authHeaders';
import { useToast } from '@/components/ToastProvider';

// ============================================================
// TIPOS
// ============================================================

interface Etapa {
    id: string;
    nome: string;
    categoria: string | null;
    data_prevista: string | null;
    data_fim_prevista: string | null;
    data_conclusao: string | null;
    is_completed: boolean;
    ordem: number | null;
    dias_antecedencia_cotacao: number | null;
    fase?: { id: string; nome: string; cronologia: number } | null;
}

interface ItemCotacao {
    id: string;
    nome: string;
    quantidade: number;
    unidade: string;
    grupo: string | null;
    fase_nome: string | null;
    servico_nome: string | null;
    observacao: string | null;
}

interface Proposta {
    id: string;
    status: string;
    fornecedor_nome: string;
    valor_total: number;
    valor_frete: number;
    prazo_entrega: number | null;
    condicoes_pagamento: string | null;
    data_envio: string | null;
    created_at: string;
}

interface Convite {
    fornecedor_nome: string;
    notificado_em: string | null;
    visualizado_em: string | null;
    declinado_em: string | null;
    motivo_declinio: string | null;
}

interface Cotacao {
    id: string;
    numero: string | null;
    status: string;
    observacoes: string | null;
    data_envio: string | null;
    created_at: string;
    itens: ItemCotacao[];
    anexos: Array<{ id: string; nome: string; url: string; tipo: string | null }>;
    propostas: Proposta[];
    convites: Convite[];
    total_mensagens: number;
    menor_proposta: number | null;
    maior_proposta: number | null;
}

interface Pedido {
    id: string;
    numero: string | null;
    status: string;
    valor_total: number;
    impostos: number;
    forma_pagamento: string | null;
    condicoes_pagamento: string | null;
    data_confirmacao: string | null;
    data_previsao_entrega: string | null;
    data_entrega: string | null;
    observacoes: string | null;
    created_at: string;
    fornecedor_nome: string;
    itens: Array<{ id: string; nome: string; quantidade: number; unidade: string; preco_unitario: number; subtotal: number }>;
}

interface Evento {
    em: string;
    tipo: 'obra' | 'etapa' | 'cotacao' | 'convite' | 'proposta' | 'pedido' | 'mensagem';
    titulo: string;
    detalhe?: string | null;
}

interface Detalhe {
    obra: any;
    etapas: Etapa[];
    cotacoes: Cotacao[];
    pedidos: Pedido[];
    eventos: Evento[];
    resumo: {
        total_etapas: number;
        etapas_concluidas: number;
        total_cotacoes: number;
        total_itens_cotados: number;
        total_convites: number;
        total_propostas: number;
        total_pedidos: number;
        valor_pedidos: number;
    };
}

type Aba = 'resumo' | 'cronograma' | 'cotacoes' | 'pedidos' | 'timeline';

// ============================================================
// APRESENTAÇÃO
// ============================================================

function moeda(v: number | null | undefined): string {
    if (v == null) return '—';
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function data(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
}

function dataHora(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
    });
}

const STATUS_COTACAO: Record<string, string> = {
    rascunho: 'bg-slate-100 text-slate-600',
    enviada: 'bg-blue-100 text-blue-700',
    em_analise: 'bg-amber-100 text-amber-700',
    respondida: 'bg-indigo-100 text-indigo-700',
    fechada: 'bg-emerald-100 text-emerald-700',
    cancelada: 'bg-rose-100 text-rose-700',
};

const STATUS_PEDIDO: Record<string, string> = {
    pendente: 'bg-slate-100 text-slate-600',
    aprovado: 'bg-blue-100 text-blue-700',
    confirmado: 'bg-indigo-100 text-indigo-700',
    em_preparacao: 'bg-amber-100 text-amber-700',
    enviado: 'bg-cyan-100 text-cyan-700',
    entregue: 'bg-emerald-100 text-emerald-700',
    cancelado: 'bg-rose-100 text-rose-700',
};

const CORES_EVENTO: Record<Evento['tipo'], string> = {
    obra: 'bg-slate-400',
    etapa: 'bg-indigo-500',
    cotacao: 'bg-blue-500',
    convite: 'bg-amber-500',
    proposta: 'bg-violet-500',
    pedido: 'bg-emerald-500',
    mensagem: 'bg-cyan-500',
};

function Selo({ texto, cls }: { texto: string; cls: string }) {
    return (
        <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold capitalize ${cls}`}>
            {texto.replace(/_/g, ' ')}
        </span>
    );
}

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: string | number; destaque?: boolean }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500">{rotulo}</p>
            <p className={`mt-0.5 font-bold ${destaque ? 'text-lg text-emerald-700' : 'text-lg text-slate-900'}`}>
                {valor}
            </p>
        </div>
    );
}

// ============================================================
// COMPONENTE
// ============================================================

export default function ObraDetalheModal({
    obraId,
    onClose,
}: {
    obraId: string;
    onClose: () => void;
}) {
    const { showToast } = useToast();
    const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
    const [loading, setLoading] = useState(true);
    const [aba, setAba] = useState<Aba>('resumo');
    const [expandida, setExpandida] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let ativo = true;
        (async () => {
            setLoading(true);
            try {
                const res = await authFetch(`/api/admin/obras/detalhe?obra_id=${obraId}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Erro ao carregar a obra');
                if (ativo) setDetalhe(json);
            } catch (e: any) {
                if (ativo) showToast('error', e.message || 'Erro ao carregar a obra');
            } finally {
                if (ativo) setLoading(false);
            }
        })();
        return () => { ativo = false; };
    }, [obraId, showToast]);

    // Esc fecha, como nos outros modais do painel
    useEffect(() => {
        const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [onClose]);

    const obra = detalhe?.obra;
    const resumo = detalhe?.resumo;

    const ABAS: Array<{ id: Aba; label: string; icon: any; contador?: number }> = [
        { id: 'resumo', label: 'Resumo', icon: Briefcase },
        { id: 'cronograma', label: 'Cronograma', icon: Layers, contador: resumo?.total_etapas },
        { id: 'cotacoes', label: 'Cotações', icon: FileText, contador: resumo?.total_cotacoes },
        { id: 'pedidos', label: 'Pedidos', icon: ShoppingCart, contador: resumo?.total_pedidos },
        { id: 'timeline', label: 'Linha do tempo', icon: Activity, contador: detalhe?.eventos.length },
    ];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Cabeçalho */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <Briefcase className="h-5 w-5 shrink-0 text-amber-600" />
                            <h3 className="truncate text-xl font-bold text-slate-900">
                                {obra?.nome || 'Obra'}
                            </h3>
                            {obra?.status && (
                                <Selo texto={obra.status} cls={obra.status === 'ativa' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'} />
                            )}
                        </div>
                        {obra && (
                            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                                <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {[obra.logradouro, obra.numero, obra.bairro, obra.cidade, obra.estado]
                                        .filter(Boolean).join(', ') || 'Endereço não informado'}
                                </span>
                                {(obra.cliente || obra.dono) && (
                                    <span className="flex items-center gap-1">
                                        <User className="h-3 w-3" />
                                        {obra.cliente?.razao_social || obra.cliente?.nome || obra.dono?.nome || obra.dono?.email}
                                    </span>
                                )}
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Abas */}
                <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4">
                    {ABAS.map(({ id, label, icon: Icone, contador }) => (
                        <button
                            key={id}
                            onClick={() => setAba(id)}
                            className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition ${
                                aba === id
                                    ? 'border-blue-600 text-blue-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700'
                            }`}
                        >
                            <Icone className="h-4 w-4" />
                            {label}
                            {contador != null && contador > 0 && (
                                <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold text-slate-600">
                                    {contador}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
                    {loading ? (
                        <div className="flex h-48 items-center justify-center text-slate-400">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : !detalhe ? (
                        <p className="py-12 text-center text-slate-500">Não foi possível carregar esta obra.</p>
                    ) : (
                        <>
                            {aba === 'resumo' && <AbaResumo detalhe={detalhe} />}
                            {aba === 'cronograma' && <AbaCronograma etapas={detalhe.etapas} />}
                            {aba === 'cotacoes' && (
                                <AbaCotacoes
                                    cotacoes={detalhe.cotacoes}
                                    expandida={expandida}
                                    alternar={(id) => setExpandida((e) => ({ ...e, [id]: !e[id] }))}
                                />
                            )}
                            {aba === 'pedidos' && (
                                <AbaPedidos
                                    pedidos={detalhe.pedidos}
                                    expandida={expandida}
                                    alternar={(id) => setExpandida((e) => ({ ...e, [id]: !e[id] }))}
                                />
                            )}
                            {aba === 'timeline' && <AbaTimeline eventos={detalhe.eventos} />}
                        </>
                    )}
                </div>

                <div className="flex items-center justify-end border-t border-slate-200 bg-slate-50 p-4">
                    <button onClick={onClose} className="rounded-xl px-4 py-2 text-slate-600 transition-colors hover:bg-slate-200">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// ABAS
// ============================================================

function AbaResumo({ detalhe }: { detalhe: Detalhe }) {
    const { obra, resumo } = detalhe;
    const progresso = resumo.total_etapas
        ? Math.round((resumo.etapas_concluidas / resumo.total_etapas) * 100)
        : 0;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Numero rotulo="Cotações" valor={resumo.total_cotacoes} />
                <Numero rotulo="Propostas recebidas" valor={resumo.total_propostas} />
                <Numero rotulo="Pedidos" valor={resumo.total_pedidos} />
                <Numero rotulo="Comprado" valor={moeda(resumo.valor_pedidos)} destaque />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                    <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                        <Layers className="h-4 w-4 text-indigo-600" />
                        Andamento do cronograma
                    </h4>
                    <span className="text-sm font-semibold text-slate-700">
                        {resumo.etapas_concluidas} de {resumo.total_etapas} fases
                    </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progresso}%` }} />
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
                <CampoFicha rotulo="Tipo" valor={obra.tipo} />
                <CampoFicha rotulo="Fase atual" valor={obra.etapa} />
                <CampoFicha rotulo="Início" valor={data(obra.data_inicio)} />
                <CampoFicha rotulo="Previsão de término" valor={data(obra.data_previsao_fim)} />
                <CampoFicha rotulo="Cadastrada em" valor={data(obra.created_at)} />
                <CampoFicha rotulo="CEP" valor={obra.cep} />
                {obra.descricao && <CampoFicha rotulo="Descrição" valor={obra.descricao} largo />}
                {obra.restricoes_entrega && (
                    <CampoFicha rotulo="Restrições de entrega" valor={obra.restricoes_entrega} largo />
                )}
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <Numero rotulo="Itens cotados" valor={resumo.total_itens_cotados} />
                <Numero rotulo="Fornecedores convidados" valor={resumo.total_convites} />
                <Numero rotulo="Eventos registrados" valor={detalhe.eventos.length} />
            </div>
        </div>
    );
}

function CampoFicha({ rotulo, valor, largo }: { rotulo: string; valor: any; largo?: boolean }) {
    return (
        <div className={`rounded-xl border border-slate-200 bg-white p-3 ${largo ? 'sm:col-span-2' : ''}`}>
            <p className="text-xs text-slate-500">{rotulo}</p>
            <p className="mt-0.5 text-sm text-slate-800">{valor || '—'}</p>
        </div>
    );
}

function AbaCronograma({ etapas }: { etapas: Etapa[] }) {
    if (etapas.length === 0) {
        return <Vazio icone={Layers} texto="Nenhuma fase no cronograma desta obra." />;
    }

    return (
        <div className="space-y-2">
            {etapas.map((etapa, i) => (
                <div
                    key={etapa.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${
                        etapa.is_completed ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                            etapa.is_completed ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
                        }`}>
                            {etapa.is_completed ? <Check className="h-4 w-4" /> : i + 1}
                        </span>
                        <div>
                            <p className="text-sm font-semibold text-slate-800">{etapa.nome}</p>
                            <p className="text-xs text-slate-500">
                                {etapa.categoria || 'Fase da Obra'}
                                {etapa.dias_antecedencia_cotacao
                                    ? ` · cotar ${etapa.dias_antecedencia_cotacao} dias antes`
                                    : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {data(etapa.data_prevista)}
                            {etapa.data_fim_prevista && ` → ${data(etapa.data_fim_prevista)}`}
                        </span>
                        {etapa.is_completed ? (
                            <Selo texto={`concluída ${data(etapa.data_conclusao)}`} cls="bg-emerald-100 text-emerald-700" />
                        ) : (
                            <Selo texto="pendente" cls="bg-slate-100 text-slate-600" />
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function AbaCotacoes({
    cotacoes, expandida, alternar,
}: {
    cotacoes: Cotacao[];
    expandida: Record<string, boolean>;
    alternar: (id: string) => void;
}) {
    if (cotacoes.length === 0) {
        return <Vazio icone={FileText} texto="Nenhuma cotação foi aberta para esta obra." />;
    }

    return (
        <div className="space-y-3">
            {cotacoes.map((cotacao) => {
                const aberta = expandida[cotacao.id];
                return (
                    <div key={cotacao.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <button
                            onClick={() => alternar(cotacao.id)}
                            className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-slate-900">Cotação #{cotacao.numero || '—'}</span>
                                    <Selo texto={cotacao.status} cls={STATUS_COTACAO[cotacao.status] || 'bg-slate-100 text-slate-600'} />
                                </div>
                                <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                                    <span>{dataHora(cotacao.created_at)}</span>
                                    <span>{cotacao.itens.length} itens</span>
                                    <span>{cotacao.convites.length} convidados</span>
                                    <span>{cotacao.propostas.length} propostas</span>
                                    {cotacao.total_mensagens > 0 && (
                                        <span className="flex items-center gap-1">
                                            <MessageSquare className="h-3 w-3" />
                                            {cotacao.total_mensagens}
                                        </span>
                                    )}
                                    {cotacao.anexos.length > 0 && (
                                        <span className="flex items-center gap-1">
                                            <Paperclip className="h-3 w-3" />
                                            {cotacao.anexos.length}
                                        </span>
                                    )}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                                {cotacao.menor_proposta != null && (
                                    <span className="flex items-center gap-1 text-sm font-semibold text-emerald-700">
                                        <TrendingDown className="h-4 w-4" />
                                        {moeda(cotacao.menor_proposta)}
                                    </span>
                                )}
                                {aberta ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                            </div>
                        </button>

                        {aberta && (
                            <div className="space-y-5 border-t border-slate-200 p-4">
                                {cotacao.observacoes && (
                                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{cotacao.observacoes}</p>
                                )}

                                {/* Itens */}
                                <div>
                                    <h5 className="mb-2 text-sm font-semibold text-slate-700">Itens cotados</h5>
                                    {cotacao.itens.length === 0 ? (
                                        <p className="text-sm italic text-slate-400">Sem itens.</p>
                                    ) : (
                                        <div className="overflow-x-auto rounded-lg border border-slate-100">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left">Material</th>
                                                        <th className="px-3 py-2 text-right">Qtd</th>
                                                        <th className="px-3 py-2 text-left">Origem</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {cotacao.itens.map((item) => (
                                                        <tr key={item.id}>
                                                            <td className="px-3 py-2 text-slate-800">
                                                                {item.nome}
                                                                {item.observacao && (
                                                                    <span className="block text-xs text-slate-400">{item.observacao}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-slate-600">
                                                                {Number(item.quantidade)} {item.unidade}
                                                            </td>
                                                            <td className="px-3 py-2 text-xs text-slate-500">
                                                                {[item.fase_nome, item.servico_nome].filter(Boolean).join(' · ') || item.grupo || '—'}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                {/* Fornecedores: convidado → viu → respondeu/declinou */}
                                <div>
                                    <h5 className="mb-2 text-sm font-semibold text-slate-700">Fornecedores</h5>
                                    {cotacao.convites.length === 0 && cotacao.propostas.length === 0 ? (
                                        <p className="text-sm italic text-slate-400">Nenhum fornecedor registrado nesta cotação.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {cotacao.convites.map((convite, i) => (
                                                <div key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                                                    <span className="flex items-center gap-2 text-sm text-slate-800">
                                                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                                                        {convite.fornecedor_nome}
                                                    </span>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                                        {convite.notificado_em && (
                                                            <span className="text-slate-500">Notificado {data(convite.notificado_em)}</span>
                                                        )}
                                                        {convite.visualizado_em && (
                                                            <span className="flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-blue-700">
                                                                <Eye className="h-3 w-3" /> Viu {data(convite.visualizado_em)}
                                                            </span>
                                                        )}
                                                        {convite.declinado_em && (
                                                            <span
                                                                className="flex items-center gap-1 rounded bg-rose-100 px-2 py-0.5 text-rose-700"
                                                                title={convite.motivo_declinio || undefined}
                                                            >
                                                                <Ban className="h-3 w-3" /> Declinou
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Propostas */}
                                {cotacao.propostas.length > 0 && (
                                    <div>
                                        <h5 className="mb-2 text-sm font-semibold text-slate-700">Propostas recebidas</h5>
                                        <div className="overflow-x-auto rounded-lg border border-slate-100">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left">Fornecedor</th>
                                                        <th className="px-3 py-2 text-right">Total</th>
                                                        <th className="px-3 py-2 text-right">Frete</th>
                                                        <th className="px-3 py-2 text-right">Prazo</th>
                                                        <th className="px-3 py-2 text-left">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {[...cotacao.propostas]
                                                        .sort((a, b) => a.valor_total - b.valor_total)
                                                        .map((p) => (
                                                            <tr key={p.id} className={p.status === 'aceita' ? 'bg-emerald-50' : ''}>
                                                                <td className="px-3 py-2 text-slate-800">{p.fornecedor_nome}</td>
                                                                <td className="px-3 py-2 text-right font-semibold text-slate-900">{moeda(p.valor_total)}</td>
                                                                <td className="px-3 py-2 text-right text-slate-600">{moeda(p.valor_frete)}</td>
                                                                <td className="px-3 py-2 text-right text-slate-600">
                                                                    {p.prazo_entrega ? `${p.prazo_entrega} dias` : '—'}
                                                                </td>
                                                                <td className="px-3 py-2">
                                                                    <Selo texto={p.status} cls={p.status === 'aceita' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'} />
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Anexos */}
                                {cotacao.anexos.length > 0 && (
                                    <div>
                                        <h5 className="mb-2 text-sm font-semibold text-slate-700">Anexos</h5>
                                        <div className="flex flex-wrap gap-2">
                                            {cotacao.anexos.map((anexo) => (
                                                <a
                                                    key={anexo.id}
                                                    href={anexo.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50"
                                                >
                                                    <Paperclip className="h-3 w-3" />
                                                    {anexo.nome}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function AbaPedidos({
    pedidos, expandida, alternar,
}: {
    pedidos: Pedido[];
    expandida: Record<string, boolean>;
    alternar: (id: string) => void;
}) {
    if (pedidos.length === 0) {
        return <Vazio icone={ShoppingCart} texto="Nenhum pedido foi fechado nesta obra." />;
    }

    return (
        <div className="space-y-3">
            {pedidos.map((pedido) => {
                const aberto = expandida[pedido.id];
                return (
                    <div key={pedido.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <button
                            onClick={() => alternar(pedido.id)}
                            className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-slate-900">Pedido #{pedido.numero || '—'}</span>
                                    <Selo texto={pedido.status} cls={STATUS_PEDIDO[pedido.status] || 'bg-slate-100 text-slate-600'} />
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                    {pedido.fornecedor_nome} · {dataHora(pedido.created_at)}
                                    {pedido.data_previsao_entrega && ` · entrega prevista ${data(pedido.data_previsao_entrega)}`}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                                <span className="font-semibold text-slate-900">{moeda(pedido.valor_total)}</span>
                                {aberto ? <ChevronDown className="h-5 w-5 text-slate-400" /> : <ChevronRight className="h-5 w-5 text-slate-400" />}
                            </div>
                        </button>

                        {aberto && (
                            <div className="space-y-4 border-t border-slate-200 p-4">
                                <div className="grid gap-3 sm:grid-cols-3">
                                    <CampoFicha rotulo="Forma de pagamento" valor={pedido.forma_pagamento} />
                                    <CampoFicha rotulo="Condições" valor={pedido.condicoes_pagamento} />
                                    <CampoFicha rotulo="Impostos" valor={moeda(pedido.impostos)} />
                                    <CampoFicha rotulo="Confirmado em" valor={dataHora(pedido.data_confirmacao)} />
                                    <CampoFicha rotulo="Entrega prevista" valor={data(pedido.data_previsao_entrega)} />
                                    <CampoFicha rotulo="Entregue em" valor={dataHora(pedido.data_entrega)} />
                                </div>

                                {pedido.observacoes && (
                                    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{pedido.observacoes}</p>
                                )}

                                {pedido.itens.length > 0 && (
                                    <div className="overflow-x-auto rounded-lg border border-slate-100">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">Material</th>
                                                    <th className="px-3 py-2 text-right">Qtd</th>
                                                    <th className="px-3 py-2 text-right">Unitário</th>
                                                    <th className="px-3 py-2 text-right">Subtotal</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {pedido.itens.map((item) => (
                                                    <tr key={item.id}>
                                                        <td className="px-3 py-2 text-slate-800">{item.nome}</td>
                                                        <td className="px-3 py-2 text-right text-slate-600">
                                                            {Number(item.quantidade)} {item.unidade}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-slate-600">{moeda(item.preco_unitario)}</td>
                                                        <td className="px-3 py-2 text-right font-medium text-slate-900">{moeda(item.subtotal)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function AbaTimeline({ eventos }: { eventos: Evento[] }) {
    if (eventos.length === 0) {
        return <Vazio icone={Activity} texto="Nada registrado nesta obra ainda." />;
    }

    return (
        <div className="relative space-y-4 pl-6">
            {/* O fio que liga os eventos */}
            <div className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200" />
            {eventos.map((evento, i) => (
                <div key={i} className="relative">
                    <span className={`absolute -left-[22px] top-1.5 h-3 w-3 rounded-full ring-4 ring-slate-50 ${CORES_EVENTO[evento.tipo]}`} />
                    <p className="text-sm font-medium text-slate-800">{evento.titulo}</p>
                    <p className="text-xs text-slate-500">
                        {dataHora(evento.em)}
                        {evento.detalhe && ` · ${evento.detalhe}`}
                    </p>
                </div>
            ))}
        </div>
    );
}

function Vazio({ icone: Icone, texto }: { icone: any; texto: string }) {
    return (
        <div className="py-14 text-center">
            <Icone className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">{texto}</p>
        </div>
    );
}

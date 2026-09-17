'use client';

/**
 * Ficha do cliente: cadastro, conta de acesso, números do relacionamento
 * e as obras — cada uma abrindo o histórico completo.
 */

import { useEffect, useState } from 'react';
import {
    X, Loader2, UserCircle2, Mail, Phone, MapPin, FileText, ShoppingCart,
    Briefcase, ChevronRight, ShieldCheck, ShieldAlert, KeyRound, Calendar, Building2,
} from 'lucide-react';
import { authFetch } from '@/lib/authHeaders';
import { useToast } from '@/components/ToastProvider';
import { formatPhoneBr, formatCpfBr, formatCnpjBr, formatCepBr } from '@/lib/utils';

interface ObraResumida {
    id: string;
    nome: string;
    etapa: string | null;
    status: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    data_inicio: string | null;
    data_previsao_fim: string | null;
    total_etapas: number;
    etapas_concluidas: number;
    total_cotacoes: number;
    total_pedidos: number;
    valor_pedidos: number;
}

interface Detalhe {
    cliente: any;
    conta: any;
    obras: ObraResumida[];
    resumo: {
        total_obras: number;
        obras_ativas: number;
        total_cotacoes: number;
        total_propostas: number;
        total_pedidos: number;
        valor_comprado: number;
        ultima_cotacao_em: string | null;
    };
}

function moeda(v: number | null | undefined): string {
    if (v == null) return '—';
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function data(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
}

/** CPF e CNPJ dividem a mesma coluna; o tamanho decide a máscara. */
function documento(cpfCnpj: string | null | undefined): string {
    const d = (cpfCnpj || '').replace(/\D/g, '');
    if (d.length === 11) return formatCpfBr(d);
    if (d.length === 14) return formatCnpjBr(d);
    return cpfCnpj || '—';
}

export default function ClienteDetalheModal({
    clienteId,
    onClose,
    onAbrirObra,
}: {
    clienteId: string;
    onClose: () => void;
    /** Abre o histórico daquela obra (modal de cima). */
    onAbrirObra: (obraId: string) => void;
}) {
    const { showToast } = useToast();
    const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let ativo = true;
        (async () => {
            setLoading(true);
            try {
                const res = await authFetch(`/api/admin/clientes/detalhe?cliente_id=${clienteId}`);
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Erro ao carregar o cliente');
                if (ativo) setDetalhe(json);
            } catch (e: any) {
                if (ativo) showToast('error', e.message || 'Erro ao carregar o cliente');
            } finally {
                if (ativo) setLoading(false);
            }
        })();
        return () => { ativo = false; };
    }, [clienteId, showToast]);

    useEffect(() => {
        const aoTeclar = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', aoTeclar);
        return () => window.removeEventListener('keydown', aoTeclar);
    }, [onClose]);

    const cliente = detalhe?.cliente;
    const conta = detalhe?.conta;
    const resumo = detalhe?.resumo;

    const endereco = cliente
        ? [cliente.logradouro, cliente.numero, cliente.complemento, cliente.bairro,
           cliente.cidade && `${cliente.cidade} - ${cliente.estado || ''}`]
            .filter(Boolean).join(', ')
        : '';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
                            {(cliente?.razao_social || cliente?.nome || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <h3 className="truncate text-xl font-bold text-slate-900">
                                {cliente?.razao_social || cliente?.nome || 'Cliente'}
                            </h3>
                            <p className="text-sm text-slate-500">Ficha completa do cliente</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/50 p-6">
                    {loading ? (
                        <div className="flex h-48 items-center justify-center text-slate-400">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : !detalhe ? (
                        <p className="py-12 text-center text-slate-500">Não foi possível carregar este cliente.</p>
                    ) : (
                        <>
                            {/* Números do relacionamento */}
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                                <Cartao icone={Briefcase} rotulo="Obras" valor={`${resumo!.total_obras}`} nota={`${resumo!.obras_ativas} ativas`} />
                                <Cartao icone={FileText} rotulo="Cotações" valor={`${resumo!.total_cotacoes}`} nota={`${resumo!.total_propostas} propostas`} />
                                <Cartao icone={ShoppingCart} rotulo="Pedidos" valor={`${resumo!.total_pedidos}`} />
                                <Cartao icone={Calendar} rotulo="Comprado" valor={moeda(resumo!.valor_comprado)} destaque />
                            </div>

                            {/* Cadastro */}
                            <Bloco titulo="Cadastro" icone={UserCircle2}>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Campo icone={UserCircle2} rotulo="Nome" valor={cliente.nome} />
                                    <Campo icone={Building2} rotulo="Razão social" valor={cliente.razao_social} />
                                    <Campo icone={FileText} rotulo="CPF / CNPJ" valor={documento(cliente.cpf_cnpj)} />
                                    <Campo icone={Mail} rotulo="E-mail" valor={cliente.email} />
                                    <Campo icone={Phone} rotulo="Telefone" valor={cliente.telefone ? formatPhoneBr(cliente.telefone) : null} />
                                    <Campo icone={Phone} rotulo="WhatsApp" valor={cliente.whatsapp ? formatPhoneBr(cliente.whatsapp) : null} />
                                    <Campo icone={MapPin} rotulo="Endereço" valor={endereco} largo />
                                    <Campo icone={MapPin} rotulo="CEP" valor={cliente.cep ? formatCepBr(cliente.cep) : null} />
                                    <Campo icone={Calendar} rotulo="Cadastrado em" valor={data(cliente.created_at)} />
                                </div>
                            </Bloco>

                            {/* Acesso */}
                            <Bloco titulo="Acesso à plataforma" icone={KeyRound}>
                                {conta ? (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <Campo icone={Mail} rotulo="Login" valor={conta.email} />
                                        <Campo icone={UserCircle2} rotulo="Perfil" valor={(conta.roles || [conta.role]).join(', ')} />
                                        <Campo
                                            icone={conta.status === 'active' ? ShieldCheck : ShieldAlert}
                                            rotulo="Situação"
                                            valor={conta.status === 'active' ? 'Ativa' : conta.status === 'pending' ? 'Pendente' : 'Suspensa'}
                                        />
                                        <Campo
                                            icone={ShieldCheck}
                                            rotulo="Verificação em 2 fatores"
                                            valor={conta.two_factor_enabled ? 'Ativada' : 'Desativada'}
                                        />
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">
                                        Este cliente ainda não tem conta de acesso. Crie uma pela coluna "Acesso" da lista.
                                    </p>
                                )}
                            </Bloco>

                            {/* Obras */}
                            <Bloco titulo={`Obras (${detalhe.obras.length})`} icone={Briefcase}>
                                {detalhe.obras.length === 0 ? (
                                    <p className="text-sm text-slate-500">Nenhuma obra cadastrada para este cliente.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {detalhe.obras.map((obra) => (
                                            <button
                                                key={obra.id}
                                                onClick={() => onAbrirObra(obra.id)}
                                                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
                                            >
                                                <div className="min-w-0">
                                                    <p className="truncate font-semibold text-slate-900">{obra.nome}</p>
                                                    <p className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                                                        <span className="flex items-center gap-1">
                                                            <MapPin className="h-3 w-3" />
                                                            {[obra.bairro, obra.cidade].filter(Boolean).join(', ') || 'Sem endereço'}
                                                        </span>
                                                        <span>{obra.etapas_concluidas}/{obra.total_etapas} fases</span>
                                                        <span>{obra.total_cotacoes} cotações</span>
                                                        <span>{obra.total_pedidos} pedidos</span>
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                    {obra.valor_pedidos > 0 && (
                                                        <span className="text-sm font-semibold text-emerald-700">
                                                            {moeda(obra.valor_pedidos)}
                                                        </span>
                                                    )}
                                                    <ChevronRight className="h-5 w-5 text-slate-400" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </Bloco>
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

function Cartao({
    icone: Icone, rotulo, valor, nota, destaque,
}: {
    icone: any; rotulo: string; valor: string; nota?: string; destaque?: boolean;
}) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icone className="h-3.5 w-3.5" />
                {rotulo}
            </p>
            <p className={`mt-0.5 text-lg font-bold ${destaque ? 'text-emerald-700' : 'text-slate-900'}`}>{valor}</p>
            {nota && <p className="text-xs text-slate-400">{nota}</p>}
        </div>
    );
}

function Bloco({ titulo, icone: Icone, children }: { titulo: string; icone: any; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Icone className="h-4 w-4 text-blue-600" />
                {titulo}
            </h4>
            {children}
        </div>
    );
}

function Campo({
    icone: Icone, rotulo, valor, largo,
}: {
    icone: any; rotulo: string; valor: any; largo?: boolean;
}) {
    return (
        <div className={largo ? 'sm:col-span-2' : ''}>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icone className="h-3 w-3" />
                {rotulo}
            </p>
            <p className="mt-0.5 break-words text-sm text-slate-800">{valor || '—'}</p>
        </div>
    );
}

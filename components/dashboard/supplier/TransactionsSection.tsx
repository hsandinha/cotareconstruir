"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseAuth";

export function SupplierTransactionsSection() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const loadTransactions = async () => {
            setLoading(true);
            setError(null);

            try {
                const { data: { session } } = await supabase.auth.getSession();
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };

                if (session?.access_token) {
                    headers['Authorization'] = `Bearer ${session.access_token}`;
                }

                const res = await fetch('/api/pedidos', { headers });
                if (!res.ok) {
                    throw new Error('Erro ao carregar transações');
                }

                const payload = await res.json();
                if (!mounted) return;
                setTransactions(payload?.data || []);
            } catch (err: any) {
                if (!mounted) return;
                setError(err?.message || 'Não foi possível carregar suas transações.');
                setTransactions([]);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        loadTransactions();

        return () => {
            mounted = false;
        };
    }, []);

    const stats = useMemo(() => {
        const total = transactions.length;
        const delivered = transactions.filter(t => t.status === 'entregue').length;
        const inProgress = transactions.filter(t => ['confirmado', 'em_preparacao', 'enviado'].includes(t.status)).length;
        const totalValue = transactions.reduce((acc, t) => acc + Number(t.valor_total || 0), 0);

        return { total, delivered, inProgress, totalValue };
    }, [transactions]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmado': return 'bg-green-100 text-green-800';
            case 'em_preparacao': return 'bg-yellow-100 text-yellow-800';
            case 'enviado': return 'bg-blue-100 text-blue-800';
            case 'entregue': return 'bg-emerald-100 text-emerald-800';
            case 'cancelado': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatStatus = (status: string) => {
        const map: Record<string, string> = {
            confirmado: 'Confirmado',
            em_preparacao: 'Em Preparação',
            enviado: 'Enviado',
            entregue: 'Entregue',
            cancelado: 'Cancelado',
        };
        return map[status] || status;
    };

    const formatDateTime = (value?: string | null) => {
        if (!value) return null;
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return date.toLocaleString('pt-BR');
    };

    const formatDeliveryAddress = (raw: any) => {
        if (!raw) return null;
        if (typeof raw === 'string') return raw;

        const fields = [
            raw?.logradouro,
            raw?.numero,
            raw?.bairro,
            raw?.cidade,
            raw?.estado,
        ].filter(Boolean);

        return fields.length > 0 ? fields.join(' - ') : null;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-medium text-gray-900">Acompanhamento e Transações</h3>
                <p className="mt-1 text-sm text-gray-600">
                    Gerencie suas propostas aprovadas e finalize negócios com os clientes
                </p>
            </div>

            {/* Informações importantes */}
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h4 className="text-sm font-medium text-green-800">Processo de Finalização</h4>
                        <div className="mt-2 text-sm text-green-700">
                            <ul className="list-disc list-inside space-y-1">
                                <li><strong>Proposta aprovada:</strong> Você terá acesso aos dados completos do cliente</li>
                                <li><strong>Contato direto liberado:</strong> Negociação e entrega são feitas diretamente com o cliente</li>
                                <li><strong>Fora da plataforma:</strong> A transação financeira é realizada entre você e o cliente</li>
                                <li><strong>Ordem de Compra:</strong> O cliente recebe a OC gerada pela plataforma</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            {/* Estatísticas */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                        <div className="text-sm text-gray-500">Subpedidos</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{stats.inProgress}</div>
                        <div className="text-sm text-gray-500">Em andamento</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{stats.delivered}</div>
                        <div className="text-sm text-gray-500">Entregues</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">R$ {stats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                        <div className="text-sm text-gray-500">Valor Total</div>
                    </div>
                </div>
            </div>

            {/* Lista de transações */}
            <div className="space-y-4">
                {loading && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500">
                        Carregando transações...
                    </div>
                )}

                {!loading && error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {!loading && !error && transactions.length === 0 && (
                    <div className="bg-white border border-gray-200 rounded-lg p-6 text-sm text-gray-500">
                        Nenhum subpedido encontrado para sua conta.
                    </div>
                )}

                {!loading && !error && transactions.map((transaction) => (
                    <div key={transaction.id} className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="flex items-center space-x-3 mb-2">
                                    <h4 className="text-base font-medium text-gray-900">
                                        {transaction?._cliente?.nome || transaction?._cliente?.email || 'Cliente'}
                                    </h4>
                                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(transaction.status)}`}>
                                        {formatStatus(transaction.status)}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-600">
                                    Pedido: #{transaction.numero || String(transaction.id).slice(0, 8)}
                                    {transaction.cotacao_id && <> | Cotação: {transaction.cotacao_id}</>}
                                    {' '}| Valor: <span className="font-medium text-green-600">R$ {Number(transaction.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                            <div className="flex space-x-2">
                                <button className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100">
                                    Detalhes
                                </button>
                            </div>
                        </div>

                        {/* Informações da obra / entrega */}
                        {(transaction?._obra?.nome || formatDeliveryAddress(transaction.endereco_entrega)) && (
                            <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                <h5 className="text-sm font-medium text-gray-900 mb-2">Dados da Entrega</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    {transaction?._obra?.nome && (
                                        <div>
                                            <span className="font-medium text-gray-700">Obra:</span>
                                            <div className="text-gray-900">{transaction._obra.nome}</div>
                                        </div>
                                    )}
                                    {formatDeliveryAddress(transaction.endereco_entrega) && (
                                        <div>
                                            <span className="font-medium text-gray-700">Endereço de Entrega:</span>
                                            <div className="text-gray-900">{formatDeliveryAddress(transaction.endereco_entrega)}</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Timeline */}
                        <div className="border-t border-gray-200 pt-4">
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                                {formatDateTime(transaction.created_at) && (
                                    <div>
                                        <span className="font-medium">Criado:</span> {formatDateTime(transaction.created_at)}
                                    </div>
                                )}
                                {formatDateTime(transaction.data_confirmacao) && (
                                    <div>
                                        <span className="font-medium">Confirmado:</span> {formatDateTime(transaction.data_confirmacao)}
                                    </div>
                                )}
                                {formatDateTime(transaction.data_entrega) && (
                                    <div>
                                        <span className="font-medium">Entregue:</span> {formatDateTime(transaction.data_entrega)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Nota sobre comparativo */}
            <div className="bg-purple-50 border border-purple-200 rounded-md p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h4 className="text-sm font-medium text-purple-800">Mapa Comparativo Premium</h4>
                        <p className="mt-1 text-sm text-purple-700">
                            * O acesso ao comparativo com valores e condições dos concorrentes (sem identidade) está disponível mediante pagamento. Este recurso fomenta a concorrência e ajuda a melhorar suas propostas futuras.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
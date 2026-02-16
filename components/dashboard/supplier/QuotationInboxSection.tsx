"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { SupplierQuotationResponseSection } from "./QuotationResponseSection";
import { ChatInterface } from "@/components/ChatInterface";

const MAX_INVOICE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_INVOICE_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
]);

// Helper para obter headers com token de autenticação
async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    return headers;
}

export function SupplierQuotationInboxSection() {
    const { user, profile, initialized } = useAuth();
    const [quotations, setQuotations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isInactive, setIsInactive] = useState(false);
    const [selectedQuotation, setSelectedQuotation] = useState<any | null>(null);
    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [invoiceFiles, setInvoiceFiles] = useState<Record<string, File | null>>({});
    const [openChats, setOpenChats] = useState<Array<{ recipientName: string; recipientId: string; roomId: string }>>([]);
    const [fornecedorId, setFornecedorId] = useState<string | null>(null);
    const [filters, setFilters] = useState({
        regions: [] as string[],
        categories: [] as string[]
    });
    const [statusFilter, setStatusFilter] = useState<"all" | "received" | "responded" | "won" | "lost">("all");

    const openChat = (context: { recipientName: string; recipientId: string; roomId: string }) => {
        setOpenChats((prev) => {
            if (prev.some((chat) => chat.roomId === context.roomId)) {
                return prev;
            }
            return [...prev, context];
        });
    };

    const closeChat = (roomId: string) => {
        setOpenChats((prev) => prev.filter((chat) => chat.roomId !== roomId));
    };

    // Fetch cotações via API route (bypasses RLS)
    const fetchQuotations = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/cotacoes', { headers });

            if (!res.ok) {
                console.error('Erro ao carregar cotações:', res.status);
                setQuotations([]);
                setLoading(false);
                return;
            }

            const json = await res.json();

            const pedidosRes = await fetch('/api/pedidos', { headers });
            const pedidosJson = pedidosRes.ok ? await pedidosRes.json() : { data: [] };
            const pedidosData = pedidosJson.data || [];
            const pedidoByCotacao = new Map(pedidosData.map((pedido: any) => [pedido.cotacao_id, pedido]));

            // Handle fornecedor not found or suspended
            if (json.fornecedor_status === 'not_found' || json.fornecedor_status === 'suspended') {
                setIsInactive(true);
                setLoading(false);
                return;
            }

            setFornecedorId(json.fornecedor_id);
            const regioes = (json.regioes || []) as string[];
            setFilters(prev => ({ ...prev, regions: regioes }));

            const data = json.data || [];

            let items = data.map((doc: any) => {
                const obra = doc._obra;
                const cliente = doc._cliente;
                return {
                    id: doc.id,
                    user_id: doc.user_id,
                    obra_id: doc.obra_id,
                    status: doc.status,
                    clientCode: cliente?.nome || ("Cliente " + (doc.user_id ? doc.user_id.substring(0, 5) : "Anon")),
                    locationRaw: obra?.cidade || "",
                    location: obra ? `${obra.bairro || ''}, ${obra.cidade || ''} - ${obra.estado || ''}` : "Não informado",
                    // Dados completos da obra para exibição na resposta
                    obraEndereco: obra ? {
                        logradouro: obra.logradouro || '',
                        numero: obra.numero || '',
                        complemento: obra.complemento || '',
                        bairro: obra.bairro || '',
                        cidade: obra.cidade || '',
                        estado: obra.estado || '',
                        cep: obra.cep || ''
                    } : null,
                    obraHorarioEntrega: obra?.horario_entrega || null,
                    obraRestricoesEntrega: obra?.restricoes_entrega || null,
                    receivedAt: doc.created_at ? new Date(doc.created_at).toLocaleString() : "N/A",
                    deadline: doc.data_validade ? new Date(doc.data_validade).toLocaleDateString('pt-BR') : "Sem prazo",
                    itemsCount: doc.cotacao_itens?.length || 0,
                    items: (doc.cotacao_itens || []).map((item: any) => ({
                        id: item.id,
                        descricao: item.nome,
                        quantidade: item.quantidade,
                        unidade: item.unidade,
                        observacao: item.observacao,
                        grupo: item.grupo,
                        fase_nome: item.fase_nome,
                        servico_nome: item.servico_nome
                    })),
                    urgency: "Média",
                    _proposta_status: doc._proposta_status || null,
                    _closed_with_me: !!doc._closed_with_me,
                    _closed_with_other: !!doc._closed_with_other,
                    _pedido_status: doc._pedido_status || null,
                    _pedido_id: doc._pedido_id || null,
                    _pedido_summary: doc._pedido_summary || null,
                    _pedido: pedidoByCotacao.get(doc.id) || null,
                    _proposta_resumo: doc._proposta_resumo || null
                };
            });

            // Filtrar por região se configurado
            if (regioes.length > 0) {
                items = items.filter((item: any) => {
                    const loc = item.location.toLowerCase();
                    return regioes.some((region: string) => loc.includes(region));
                });
            }

            setQuotations(items);
        } catch (err) {
            console.error('Erro ao carregar cotações:', err);
            setQuotations([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!initialized || !user) return;

        fetchQuotations();

        // Set up realtime subscription
        // Escuta TODAS as mudanças em cotacoes (sem filtro de status)
        // porque cotações com status 'respondida' também são abertas para outros fornecedores
        const channel = supabase
            .channel('cotacoes-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'cotacoes'
                },
                () => {
                    fetchQuotations();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, initialized, fetchQuotations]);

    const getUrgencyColor = (urgency: string) => {
        switch (urgency) {
            case 'Alta': return 'bg-red-100 text-red-800';
            case 'Média': return 'bg-orange-100 text-orange-800';
            case 'Baixa': return 'bg-blue-100 text-blue-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getProposalStatusBadge = (proposalStatus: string | null, quotationStatus: string) => {
        if (!proposalStatus) {
            return {
                label: 'Aguardando resposta',
                className: 'bg-yellow-100 text-yellow-800'
            };
        }

        if (proposalStatus === 'aceita') {
            return {
                label: quotationStatus === 'fechada' ? 'Selecionada' : 'Pré-selecionada',
                className: 'bg-green-100 text-green-800'
            };
        }

        if (proposalStatus === 'recusada') {
            return {
                label: 'Não selecionada',
                className: 'bg-red-100 text-red-800'
            };
        }

        if (proposalStatus === 'expirada') {
            return {
                label: 'Expirada',
                className: 'bg-gray-100 text-gray-700'
            };
        }

        return {
            label: 'Respondida',
            className: 'bg-blue-100 text-blue-800'
        };
    };

    const getUnifiedPedidoStatus = (quotation: any): "received" | "responded" | "won" | "lost" => {
        if (quotation.status === 'fechada') {
            return quotation._closed_with_me ? 'won' : 'lost';
        }
        return quotation._proposta_status ? 'responded' : 'received';
    };

    const mapOrderWorkflowStatus = (pedidoStatus: string | null): 'aprovado' | 'emissao_nota' | 'em_separacao' | 'a_caminho' | 'entregue' => {
        if (pedidoStatus === 'entregue') return 'entregue';
        if (pedidoStatus === 'enviado') return 'a_caminho';
        if (pedidoStatus === 'em_preparacao') return 'em_separacao';
        if (pedidoStatus === 'confirmado') return 'emissao_nota';
        return 'aprovado';
    };

    const getOrderWorkflowLabel = (workflow: 'aprovado' | 'emissao_nota' | 'em_separacao' | 'a_caminho' | 'entregue') => {
        const labels = {
            aprovado: 'Aprovado',
            emissao_nota: 'Emissão de nota',
            em_separacao: 'Em separação',
            a_caminho: 'A caminho',
            entregue: 'Entregue'
        };
        return labels[workflow];
    };

    const getOrderActionByStep = (step: 'aprovado' | 'emissao_nota' | 'em_separacao' | 'a_caminho' | 'entregue') => {
        const actionMap = {
            aprovado: { label: 'Aprovar pedido', nextStatus: 'confirmado' },
            emissao_nota: { label: 'Anexar nota e avançar', nextStatus: 'em_preparacao' },
            em_separacao: { label: 'Marcar a caminho', nextStatus: 'enviado' },
            a_caminho: { label: 'Marcar entregue', nextStatus: 'entregue' },
            entregue: null
        } as const;
        return actionMap[step];
    };

    const canNegotiate = (quotation: any) => {
        const unifiedStatus = getUnifiedPedidoStatus(quotation);
        if (unifiedStatus === 'received' || unifiedStatus === 'responded') return true;
        if (unifiedStatus === 'won') {
            const step = mapOrderWorkflowStatus(quotation._pedido_status);
            return step === 'aprovado' || step === 'emissao_nota';
        }
        return false;
    };

    const fileToBase64 = async (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = String(reader.result || '');
                const base64 = result.includes(',') ? result.split(',')[1] : result;
                resolve(base64);
            };
            reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
            reader.readAsDataURL(file);
        });
    };

    const handleAdvanceWonOrder = async (quotation: any) => {
        const workflowStatus = mapOrderWorkflowStatus(quotation._pedido_status);
        const action = getOrderActionByStep(workflowStatus);
        if (!action || !quotation._pedido_id) return;

        const summaryUpdate: Record<string, any> = {};
        const nowIso = new Date().toISOString();

        if (workflowStatus === 'aprovado') {
            summaryUpdate.billingStartedAt = nowIso;
        }

        if (workflowStatus === 'emissao_nota') {
            summaryUpdate.billingCompletedAt = nowIso;
            summaryUpdate.pickingStartedAt = nowIso;
        }

        if (workflowStatus === 'em_separacao') {
            summaryUpdate.pickingCompletedAt = nowIso;
            summaryUpdate.deliveryStartedAt = nowIso;
        }

        if (workflowStatus === 'a_caminho') {
            summaryUpdate.deliveryCompletedAt = nowIso;
        }

        if (workflowStatus === 'emissao_nota') {
            const selectedFile = invoiceFiles[quotation.id];
            if (!selectedFile) {
                alert('Selecione a nota fiscal para avançar para Em separação.');
                return;
            }
        }

        setActionLoadingId(quotation.id);
        try {
            const headers = await getAuthHeaders();
            let invoiceFilePayload: any = undefined;

            if (workflowStatus === 'emissao_nota') {
                const selectedFile = invoiceFiles[quotation.id];
                if (!selectedFile) {
                    throw new Error('Selecione a nota fiscal para avançar.');
                }

                const fileBase64 = await fileToBase64(selectedFile);
                invoiceFilePayload = {
                    fileName: selectedFile.name,
                    fileType: selectedFile.type || 'application/octet-stream',
                    fileSize: selectedFile.size,
                    fileBase64,
                };
            }

            const res = await fetch('/api/pedidos', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    action: 'update_status',
                    pedido_id: quotation._pedido_id,
                    status: action.nextStatus,
                    summary_update: Object.keys(summaryUpdate).length > 0 ? summaryUpdate : undefined,
                    invoice_file: invoiceFilePayload,
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao avançar pedido');
            }

            if (workflowStatus === 'emissao_nota') {
                setInvoiceFiles(prev => ({ ...prev, [quotation.id]: null }));
            }

            await fetchQuotations();
        } catch (error: any) {
            console.error('Erro ao avançar pedido:', error);
            alert(error?.message || 'Erro ao avançar pedido.');
        } finally {
            setActionLoadingId(null);
        }
    };

    const activeQuotationsCount = quotations.filter(q => getUnifiedPedidoStatus(q) === 'received').length;
    const respondedOpenCount = quotations.filter(q => getUnifiedPedidoStatus(q) === 'responded').length;
    const receivedOpenCount = quotations.filter(q => getUnifiedPedidoStatus(q) === 'received').length;
    const wonClosedCount = quotations.filter(q => q.status === 'fechada' && q._closed_with_me).length;
    const lostClosedCount = quotations.filter(q => q.status === 'fechada' && q._closed_with_other).length;

    const filteredQuotations = quotations.filter((q) => {
        const unifiedStatus = getUnifiedPedidoStatus(q);
        if (statusFilter === 'received') return unifiedStatus === 'received';
        if (statusFilter === 'responded') return unifiedStatus === 'responded';
        if (statusFilter === 'won') return unifiedStatus === 'won';
        if (statusFilter === 'lost') return unifiedStatus === 'lost';
        return true;
    });

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando cotações...</div>;
    }

    if (isInactive) {
        return (
            <div className="p-8 text-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
                    <h3 className="text-lg font-medium text-red-800 mb-2">Conta Inativa</h3>
                    <p className="text-red-600">
                        Sua conta está inativa porque seus produtos não foram atualizados recentemente ou por decisão administrativa.
                        <br />
                        Por favor, atualize seu cadastro de materiais para voltar a receber cotações.
                    </p>
                </div>
            </div>
        );
    }

    if (selectedQuotation) {
        const selectedUnifiedStatus = getUnifiedPedidoStatus(selectedQuotation);
        const selectedPedido = selectedQuotation._pedido;
        const selectedPedidoSummary = selectedQuotation._pedido_summary || selectedPedido?.endereco_entrega?.summary || {};
        const selectedPropostaResumo = selectedQuotation._proposta_resumo || null;

        const detailItems = (selectedPedido?.pedido_itens?.length > 0
            ? selectedPedido.pedido_itens.map((item: any) => ({
                id: item.id,
                descricao: item.nome,
                quantidade: item.quantidade,
                unidade: item.unidade,
                unitPrice: parseFloat(item.preco_unitario) || 0,
                total: parseFloat(item.subtotal) || 0,
            }))
            : (selectedQuotation.items || []).map((item: any) => {
                const proposalItem = selectedPropostaResumo?.items
                    ? selectedPropostaResumo.items[item.id]
                    : null;
                return {
                    id: item.id,
                    descricao: item.descricao,
                    quantidade: item.quantidade,
                    unidade: item.unidade,
                    unitPrice: proposalItem?.unitPrice || 0,
                    total: proposalItem?.total || 0,
                };
            })) as Array<{
                id: string;
                descricao: string;
                quantidade: number;
                unidade: string;
                unitPrice: number;
                total: number;
            }>;

        const subtotalFromItems = detailItems.reduce((sum, item) => sum + (item.total || 0), 0);
        const subtotalValue = parseFloat(selectedPedidoSummary?.subtotal) || subtotalFromItems;
        const freightValue = parseFloat(selectedPedidoSummary?.freight) || selectedPropostaResumo?.freightValue || 0;
        const taxesValue = parseFloat(selectedPedidoSummary?.taxes) || selectedPropostaResumo?.taxValue || 0;
        const deliveryDays = Number.isFinite(Number(selectedPedidoSummary?.deliveryDays))
            ? Number(selectedPedidoSummary.deliveryDays)
            : selectedPropostaResumo?.deliveryDays;
        const paymentTerms = selectedPedidoSummary?.paymentMethod || selectedPropostaResumo?.paymentTerms || null;
        const totalValue = (selectedPedido?.valor_total ? parseFloat(selectedPedido.valor_total) : 0) || (subtotalValue + freightValue + taxesValue);

        if (selectedUnifiedStatus !== 'received') {
            if (selectedQuotation?._editProposal) {
                return (
                    <SupplierQuotationResponseSection
                        quotation={selectedQuotation}
                        onBack={() => setSelectedQuotation({ ...selectedQuotation, _editProposal: false })}
                        mode="update"
                    />
                );
            }

            const wonWorkflow = mapOrderWorkflowStatus(selectedQuotation._pedido_status);
            const wonAction = getOrderActionByStep(wonWorkflow);
            const wonInvoice = selectedQuotation?._pedido_summary?.invoiceAttachment;

            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-medium text-gray-900">Detalhes do Pedido</h3>
                            <p className="mt-1 text-sm text-gray-600">Acompanhe status e próximos passos</p>
                        </div>
                        <button
                            onClick={() => setSelectedQuotation(null)}
                            className="text-sm text-gray-500 hover:text-gray-700"
                        >
                            Voltar
                        </button>
                    </div>

                    <div className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <span className="font-medium text-gray-700">Cliente:</span>
                                <div className="text-gray-900">{selectedQuotation.clientCode}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Localização:</span>
                                <div className="text-gray-900">{selectedQuotation.location}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Status:</span>
                                <div className="text-gray-900">{selectedUnifiedStatus === 'won' ? 'Ganhou' : selectedUnifiedStatus === 'lost' ? 'Perdeu' : 'Respondido'}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Total de Itens:</span>
                                <div className="text-gray-900">{selectedQuotation.itemsCount} materiais</div>
                            </div>
                        </div>
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                            <div>
                                <span className="font-medium text-gray-700">Subtotal Materiais:</span>
                                <div className="text-gray-900">R$ {subtotalValue.toFixed(2)}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Frete:</span>
                                <div className="text-gray-900">R$ {freightValue.toFixed(2)}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Impostos:</span>
                                <div className="text-gray-900">R$ {taxesValue.toFixed(2)}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Prazo de Entrega:</span>
                                <div className="text-gray-900">
                                    {deliveryDays === null || deliveryDays === undefined
                                        ? 'N/A'
                                        : deliveryDays === 0
                                            ? 'Imediata'
                                            : `${deliveryDays} dias`}
                                </div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Pagamento:</span>
                                <div className="text-gray-900">{paymentTerms || 'N/A'}</div>
                            </div>
                            <div>
                                <span className="font-medium text-gray-700">Total Geral:</span>
                                <div className="text-gray-900 font-semibold">R$ {totalValue.toFixed(2)}</div>
                            </div>
                        </div>
                        {canNegotiate(selectedQuotation) && (
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => openChat({
                                        recipientName: selectedQuotation.clientCode,
                                        recipientId: selectedQuotation.user_id,
                                        roomId: fornecedorId ? `${selectedQuotation.id}::${fornecedorId}` : selectedQuotation.id
                                    })}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                >
                                    Negociar no chat
                                </button>
                                {selectedUnifiedStatus !== 'lost' && (
                                    <button
                                        onClick={() => setSelectedQuotation({ ...selectedQuotation, _editProposal: true })}
                                        className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                                    >
                                        Atualizar proposta
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {selectedUnifiedStatus === 'won' && (
                        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
                            <div>
                                <p className="text-sm font-semibold text-gray-900 mb-2">Fluxo do pedido</p>
                                <div className="flex flex-wrap gap-2">
                                    {(['aprovado', 'emissao_nota', 'em_separacao', 'a_caminho', 'entregue'] as const).map((step) => {
                                        const isActive = step === wonWorkflow;
                                        return (
                                            <span
                                                key={`selected-${step}`}
                                                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${isActive ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-gray-100 text-gray-600'}`}
                                            >
                                                {getOrderWorkflowLabel(step)}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>

                            {wonInvoice && (
                                <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
                                    Nota anexada: <span className="font-medium text-gray-800">{wonInvoice.fileName}</span>
                                    {wonInvoice.publicUrl && (
                                        <a
                                            href={wonInvoice.publicUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="ml-2 text-blue-600 hover:underline"
                                        >
                                            Abrir arquivo
                                        </a>
                                    )}
                                </div>
                            )}

                            {wonAction && (
                                <div className="flex flex-wrap items-center gap-3">
                                    {wonWorkflow === 'emissao_nota' && (
                                        <div className="flex flex-col gap-1">
                                            <input
                                                type="file"
                                                accept="application/pdf,image/*"
                                                onChange={(e) => {
                                                    const selectedFile = e.target.files?.[0] || null;
                                                    if (!selectedFile) {
                                                        setInvoiceFiles(prev => ({ ...prev, [selectedQuotation.id]: null }));
                                                        return;
                                                    }

                                                    if (!ALLOWED_INVOICE_TYPES.has(selectedFile.type)) {
                                                        alert('Formato inválido. Envie PDF, JPG ou PNG.');
                                                        e.currentTarget.value = '';
                                                        return;
                                                    }

                                                    if (selectedFile.size > MAX_INVOICE_SIZE_BYTES) {
                                                        alert('Arquivo excede o limite de 10MB.');
                                                        e.currentTarget.value = '';
                                                        return;
                                                    }

                                                    setInvoiceFiles(prev => ({ ...prev, [selectedQuotation.id]: selectedFile }));
                                                }}
                                                className="text-xs"
                                            />
                                            <span className="text-[11px] text-gray-500">Formatos: PDF/JPG/PNG • Máx 10MB</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => handleAdvanceWonOrder(selectedQuotation)}
                                        disabled={actionLoadingId === selectedQuotation.id}
                                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-60"
                                    >
                                        {actionLoadingId === selectedQuotation.id ? 'Atualizando...' : wonAction.label}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-gray-900">Itens do Pedido</h4>
                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{selectedQuotation.items?.length || 0} itens</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qtd</th>
                                        <th className="px-3 py-2.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Unid.</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor Unit.</th>
                                        <th className="px-3 py-2.5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {detailItems.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-3 text-sm text-gray-900">{item.descricao}</td>
                                            <td className="px-3 py-3 text-center text-sm text-gray-700">{item.quantidade}</td>
                                            <td className="px-3 py-3 text-center text-sm text-gray-500">{item.unidade}</td>
                                            <td className="px-3 py-3 text-right text-sm text-gray-700">R$ {(item.unitPrice || 0).toFixed(2)}</td>
                                            <td className="px-3 py-3 text-right text-sm font-medium text-gray-900">R$ {(item.total || 0).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                    <tr>
                                        <td colSpan={4} className="px-3 py-3 text-right text-sm font-semibold text-gray-800">Total Itens</td>
                                        <td className="px-3 py-3 text-right text-sm font-bold text-gray-900">R$ {subtotalValue.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <SupplierQuotationResponseSection
                quotation={selectedQuotation}
                onBack={() => setSelectedQuotation(null)}
                mode="create"
            />
        );
    }

    return (
        <div className="space-y-6">


            {/* Filtros e estatísticas */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                {filters.regions.length > 0 && (
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                        <strong>Filtro Ativo:</strong> Exibindo apenas cotações para as regiões: {filters.regions.join(", ")}.
                        <br />
                        <span className="text-xs text-yellow-600">Você pode alterar isso na aba "Cadastro & Perfil".</span>
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{activeQuotationsCount}</div>
                        <div className="text-sm text-gray-500">Recebidos</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{respondedOpenCount}</div>
                        <div className="text-sm text-gray-500">Respondidos</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{wonClosedCount}</div>
                        <div className="text-sm text-gray-500">Ganhou</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{lostClosedCount}</div>
                        <div className="text-sm text-gray-500">Perdeu</div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1 text-xs font-medium rounded-full ${statusFilter === 'all' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setStatusFilter('received')}
                        className={`px-3 py-1 text-xs font-medium rounded-full ${statusFilter === 'received' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                        Recebido ({receivedOpenCount})
                    </button>
                    <button
                        onClick={() => setStatusFilter('responded')}
                        className={`px-3 py-1 text-xs font-medium rounded-full ${statusFilter === 'responded' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                        Respondido ({respondedOpenCount})
                    </button>
                    <button
                        onClick={() => setStatusFilter('won')}
                        className={`px-3 py-1 text-xs font-medium rounded-full ${statusFilter === 'won' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                        Ganhou ({wonClosedCount})
                    </button>
                    <button
                        onClick={() => setStatusFilter('lost')}
                        className={`px-3 py-1 text-xs font-medium rounded-full ${statusFilter === 'lost' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                        Perdeu ({lostClosedCount})
                    </button>
                </div>
            </div>

            {/* Lista de consultas */}
            <div className="space-y-4">
                {loading ? (
                    <p className="text-center text-gray-500">Carregando cotações...</p>
                ) : filteredQuotations.length === 0 ? (
                    <p className="text-center text-gray-500">Nenhuma cotação disponível no momento.</p>
                ) : (
                    filteredQuotations.map((quotation) => (
                        <div key={quotation.id} className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center space-x-3 mb-2">
                                        <h4 className="text-base font-medium text-gray-900">{quotation.clientCode}</h4>
                                        {(() => {
                                            const unifiedStatus = getUnifiedPedidoStatus(quotation);
                                            const statusBadgeMap: Record<string, { label: string; className: string }> = {
                                                received: { label: 'Recebido', className: 'bg-blue-100 text-blue-800' },
                                                responded: { label: 'Respondido', className: 'bg-indigo-100 text-indigo-800' },
                                                won: { label: 'Ganhou', className: 'bg-green-100 text-green-800' },
                                                lost: { label: 'Perdeu', className: 'bg-red-100 text-red-800' }
                                            };
                                            const proposalBadge = statusBadgeMap[unifiedStatus] || getProposalStatusBadge(quotation._proposta_status, quotation.status);
                                            return (
                                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${proposalBadge.className}`}>
                                                    {proposalBadge.label}
                                                </span>
                                            );
                                        })()}
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getUrgencyColor(quotation.urgency)}`}>
                                            {quotation.urgency}
                                        </span>
                                    </div>
                                    {quotation.status === 'fechada' && quotation._closed_with_me && (
                                        <div className="mb-3">
                                            <p className="text-xs font-semibold text-gray-700 mb-2">Status do pedido</p>
                                            {(() => {
                                                const workflowStatus = mapOrderWorkflowStatus(quotation._pedido_status);
                                                const workflow = ['aprovado', 'emissao_nota', 'em_separacao', 'a_caminho', 'entregue'] as const;
                                                return (
                                                    <div className="flex flex-wrap gap-2">
                                                        {workflow.map((step) => {
                                                            const isActive = step === workflowStatus;
                                                            return (
                                                                <span
                                                                    key={`${quotation.id}-${step}`}
                                                                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${isActive ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-gray-100 text-gray-600'}`}
                                                                >
                                                                    {getOrderWorkflowLabel(step)}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                    {quotation.status === 'fechada' && quotation._closed_with_me && (() => {
                                        const workflowStatus = mapOrderWorkflowStatus(quotation._pedido_status);
                                        const action = getOrderActionByStep(workflowStatus);
                                        const isLoading = actionLoadingId === quotation.id;
                                        const selectedFile = invoiceFiles[quotation.id];
                                        const invoiceAttached = quotation?._pedido_summary?.invoiceAttachment;

                                        return (
                                            <div className="mb-3 flex flex-wrap items-center gap-2">
                                                {workflowStatus === 'emissao_nota' && (
                                                    <>
                                                        <div className="flex flex-col gap-1">
                                                            <input
                                                                type="file"
                                                                accept="application/pdf,image/*"
                                                                onChange={(e) => {
                                                                    const file = e.target.files?.[0] || null;
                                                                    if (!file) {
                                                                        setInvoiceFiles(prev => ({ ...prev, [quotation.id]: null }));
                                                                        return;
                                                                    }

                                                                    if (!ALLOWED_INVOICE_TYPES.has(file.type)) {
                                                                        alert('Formato inválido. Envie PDF, JPG ou PNG.');
                                                                        e.currentTarget.value = '';
                                                                        return;
                                                                    }

                                                                    if (file.size > MAX_INVOICE_SIZE_BYTES) {
                                                                        alert('Arquivo excede o limite de 10MB.');
                                                                        e.currentTarget.value = '';
                                                                        return;
                                                                    }

                                                                    setInvoiceFiles(prev => ({ ...prev, [quotation.id]: file }));
                                                                }}
                                                                className="text-xs"
                                                            />
                                                            <span className="text-[11px] text-gray-500">Formatos: PDF/JPG/PNG • Máx 10MB</span>
                                                        </div>
                                                        {invoiceAttached && (
                                                            <span className="text-xs text-gray-500">
                                                                Nota anexada: {invoiceAttached.fileName}
                                                                {invoiceAttached.publicUrl && (
                                                                    <a
                                                                        href={invoiceAttached.publicUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="ml-1 text-blue-600 hover:underline"
                                                                    >
                                                                        Ver
                                                                    </a>
                                                                )}
                                                            </span>
                                                        )}
                                                        {selectedFile && (
                                                            <span className="text-xs text-green-700">Arquivo selecionado: {selectedFile.name}</span>
                                                        )}
                                                    </>
                                                )}
                                                {action && (
                                                    <button
                                                        onClick={() => handleAdvanceWonOrder(quotation)}
                                                        disabled={isLoading}
                                                        className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-60"
                                                    >
                                                        {isLoading ? 'Atualizando...' : action.label}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                        <div>
                                            <span className="font-medium">Localização:</span>
                                            <br />
                                            {quotation.location}
                                        </div>
                                        <div>
                                            <span className="font-medium">Recebido em:</span>
                                            <br />
                                            {quotation.receivedAt}
                                        </div>
                                        <div>
                                            <span className="font-medium">Prazo:</span>
                                            <br />
                                            {quotation.deadline}
                                        </div>
                                        <div>
                                            <span className="font-medium">Itens:</span>
                                            <br />
                                            {quotation.itemsCount} materiais
                                        </div>
                                    </div>
                                </div>
                                <div className="flex space-x-2 ml-4">
                                    {canNegotiate(quotation) && (
                                        <button
                                            onClick={() => openChat({
                                                recipientName: quotation.clientCode,
                                                recipientId: quotation.user_id,
                                                roomId: fornecedorId ? `${quotation.id}::${fornecedorId}` : quotation.id
                                            })}
                                            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                                        >
                                            Chat
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedQuotation(quotation)}
                                        className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100"
                                    >
                                        Visualizar
                                    </button>
                                    {getUnifiedPedidoStatus(quotation) === 'received' && (
                                        <button
                                            onClick={() => setSelectedQuotation(quotation)}
                                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
                                        >
                                            Responder
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {openChats.map((chat, index) => (
                <ChatInterface
                    key={chat.roomId}
                    isOpen={true}
                    onClose={() => closeChat(chat.roomId)}
                    recipientName={chat.recipientName}
                    recipientId={chat.recipientId}
                    orderId={chat.roomId}
                    orderTitle="Negociação de Pedido"
                    offsetIndex={index}
                />
            ))}
        </div>
    );
}
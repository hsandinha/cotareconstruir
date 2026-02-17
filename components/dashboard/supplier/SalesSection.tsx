"use client";

import { useState, useEffect, useCallback } from "react";
import { ChatInterface } from "../../ChatInterface";
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    ChatBubbleLeftRightIcon,
    CheckCircleIcon,
    ClockIcon,
    TruckIcon,
    CurrencyDollarIcon,
    DocumentTextIcon
} from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "../../../lib/useAuth";
import { getAuthHeaders } from "@/lib/authHeaders";

const MAX_INVOICE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_INVOICE_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
]);

type SaleStatus = "pending" | "responded" | "negotiating" | "approved" | "completed" | "cancelled";

type DaySchedule = {
    enabled: boolean;
    startTime: string;
    endTime: string;
};

interface SaleOrder {
    id: string;
    numero: string;
    quotationId: string;
    clientId: string;
    clientCode: string;
    clientName?: string;
    workName?: string;
    location: {
        neighborhood: string;
        city: string;
        state: string;
        fullAddress?: string;
    };
    deliverySchedule?: {
        monday?: DaySchedule;
        tuesday?: DaySchedule;
        wednesday?: DaySchedule;
        thursday?: DaySchedule;
        friday?: DaySchedule;
        saturday?: DaySchedule;
        sunday?: DaySchedule;
    };
    items: {
        id: number;
        name: string;
        quantity: number;
        unit: string;
        observation?: string;
        unitPrice?: number;
        total?: number;
    }[];
    clientDetails?: {
        name: string;
        document: string;
        email: string;
        phone: string;
        address: string;
    };
    status: SaleStatus;
    rawStatus: string;
    createdAt: string;
    deadline?: string;
    totalValue?: number;
    proposal?: {
        freight: number;
        availability: string;
        validity: string;
        paymentTerms?: string;
        items?: Record<number, {
            quantity: number;
            unit: string;
            price: number;
        }>;
        negotiation?: {
            bestPrice: number;
            currentPrice: number;
            bestFreight: number;
        };
    };
}

export function SupplierSalesSection() {
    const { user, session, initialized } = useAuth();
    const [activeTab, setActiveTab] = useState<"all" | WorkflowStep>("all");
    const [selectedOrder, setSelectedOrder] = useState<SaleOrder | null>(null);
    const [openChats, setOpenChats] = useState<Array<{ recipientName: string; recipientId: string; initialRoomId: string; initialRoomTitle?: string }>>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [orders, setOrders] = useState<SaleOrder[]>([]);
    const [loading, setLoading] = useState(true);

    const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
    const [invoiceFiles, setInvoiceFiles] = useState<Record<string, File | null>>({});
    const [deliveryProofFiles, setDeliveryProofFiles] = useState<Record<string, File | null>>({});

    const [negotiationModal, setNegotiationModal] = useState<{
        isOpen: boolean;
        order: SaleOrder | null;
        bestPrice: number;
        currentPrice: number;
        bestFreight: number;
        discountPercent: number;
    } | null>(null);

    // Function to fetch orders via API route (bypasses RLS)
    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const headers = await getAuthHeaders(session?.access_token);
            const res = await fetch('/api/pedidos', { headers, credentials: 'include' });

            if (!res.ok) {
                console.error('Erro ao carregar vendas:', res.status);
                setOrders([]);
                setLoading(false);
                return;
            }

            const json = await res.json();
            const data = json.data || [];

            // Map API data to SaleOrder format
            const mappedOrders: SaleOrder[] = data.map((pedido: any) => {
                const obra = pedido._obra;
                const cliente = pedido._cliente;
                const extraData = pedido.endereco_entrega || {};
                return {
                    id: pedido.id,
                    numero: pedido.numero || pedido.id.slice(0, 8),
                    quotationId: pedido.cotacao_id || '',
                    clientId: pedido.user_id || '',
                    clientCode: cliente?.nome || cliente?.email || pedido.user_id || '',
                    clientName: cliente?.nome || extraData.clientDetails?.name || '',
                    workName: obra?.nome || extraData.workName || 'Obra sem nome',
                    location: {
                        neighborhood: obra?.bairro || '',
                        city: obra?.cidade || '',
                        state: obra?.estado || '',
                        fullAddress: [
                            [obra?.logradouro, obra?.numero].filter(Boolean).join(', '),
                            obra?.complemento,
                            obra?.bairro,
                            [obra?.cidade, obra?.estado].filter(Boolean).join('/'),
                            obra?.cep ? `CEP: ${obra.cep}` : ''
                        ].filter(Boolean).join(' - ')
                    },
                    deliverySchedule: obra?.horario_entrega || extraData.deliverySchedule,
                    items: (pedido.pedido_itens || []).map((item: any) => ({
                        id: item.id,
                        name: item.nome,
                        quantity: item.quantidade,
                        unit: item.unidade,
                        unitPrice: item.preco_unitario,
                        total: item.subtotal
                    })),
                    clientDetails: extraData.clientDetails || (cliente ? {
                        name: cliente.nome || '',
                        document: '',
                        email: cliente.email || '',
                        phone: '',
                        address: obra ? [
                            [obra.logradouro, obra.numero].filter(Boolean).join(', '),
                            obra.complemento,
                            obra.bairro,
                            [obra.cidade, obra.estado].filter(Boolean).join('/'),
                            obra.cep ? `CEP: ${obra.cep}` : ''
                        ].filter(Boolean).join(' - ') : ''
                    } : undefined),
                    status: mapSupabaseStatus(pedido.status),
                    rawStatus: pedido.status || 'pendente',
                    createdAt: pedido.created_at,
                    deadline: pedido.data_previsao_entrega,
                    totalValue: pedido.valor_total,
                    proposal: extraData.proposal,
                    _pedido_summary: extraData.summary || {},
                    _data_confirmacao: pedido.data_confirmacao || null,
                    _data_entrega: pedido.data_entrega || null,
                };
            });
            setOrders(mappedOrders);
        } catch (err) {
            console.error('Erro ao carregar vendas:', err);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [session]);

    // Map Supabase status to component status
    const mapSupabaseStatus = (status: string): SaleStatus => {
        const statusMap: Record<string, SaleStatus> = {
            'pendente': 'pending',
            'confirmado': 'approved',
            'em_preparacao': 'negotiating',
            'enviado': 'negotiating',
            'entregue': 'completed',
            'cancelado': 'cancelled'
        };
        return statusMap[status] || 'pending';
    };

    // Map component status to Supabase status
    const mapToSupabaseStatus = (status: SaleStatus): string => {
        const statusMap: Record<SaleStatus, string> = {
            'pending': 'pendente',
            'responded': 'pendente',
            'negotiating': 'em_preparacao',
            'approved': 'confirmado',
            'completed': 'entregue',
            'cancelled': 'cancelado'
        };
        return statusMap[status] || 'pendente';
    };

    // === Order Workflow ===
    type WorkflowStep = 'pendente' | 'aprovado' | 'emissao_nota' | 'em_separacao' | 'em_transporte' | 'entregue';

    const WORKFLOW_STEPS: WorkflowStep[] = ['pendente', 'aprovado', 'emissao_nota', 'em_separacao', 'em_transporte', 'entregue'];

    const mapOrderWorkflowStatus = (rawStatus: string): WorkflowStep => {
        if (rawStatus === 'entregue') return 'entregue';
        if (rawStatus === 'enviado') return 'em_transporte';
        if (rawStatus === 'em_preparacao') return 'em_separacao';
        if (rawStatus === 'confirmado') return 'emissao_nota';
        return 'pendente';
    };

    const getOrderWorkflowLabel = (step: WorkflowStep) => {
        const labels: Record<WorkflowStep, string> = {
            pendente: 'Pendente',
            aprovado: 'Aprovado',
            emissao_nota: 'Emissão de nota',
            em_separacao: 'Em separação',
            em_transporte: 'Em transporte',
            entregue: 'Entregue'
        };
        return labels[step];
    };

    const getOrderActionByStep = (step: WorkflowStep) => {
        const actionMap: Record<WorkflowStep, { label: string; nextStatus: string } | null> = {
            pendente: { label: 'Aprovar pedido', nextStatus: 'confirmado' },
            aprovado: null,
            emissao_nota: { label: 'Anexar nota e avançar', nextStatus: 'em_preparacao' },
            em_separacao: { label: 'Marcar em transporte', nextStatus: 'enviado' },
            em_transporte: { label: 'Marcar entregue', nextStatus: 'entregue' },
            entregue: null
        };
        return actionMap[step];
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

    const handleAdvanceOrder = async (order: SaleOrder) => {
        const workflowStatus = mapOrderWorkflowStatus(order.rawStatus);
        const action = getOrderActionByStep(workflowStatus);
        if (!action) return;

        const summaryUpdate: Record<string, any> = {};
        const nowIso = new Date().toISOString();

        if (workflowStatus === 'pendente') summaryUpdate.billingStartedAt = nowIso;
        if (workflowStatus === 'emissao_nota') {
            summaryUpdate.billingCompletedAt = nowIso;
            summaryUpdate.pickingStartedAt = nowIso;
        }
        if (workflowStatus === 'em_separacao') {
            summaryUpdate.pickingCompletedAt = nowIso;
            summaryUpdate.deliveryStartedAt = nowIso;
        }
        if (workflowStatus === 'em_transporte') summaryUpdate.deliveryCompletedAt = nowIso;

        // Record step-level timestamps
        // Each timestamp marks when the action at that step was taken
        const existingTimestamps = (order as any)._pedido_summary?.stepTimestamps || {};
        const stepTs: Record<string, string> = { ...existingTimestamps };
        if (workflowStatus === 'pendente') stepTs['aprovado'] = nowIso;
        if (workflowStatus === 'emissao_nota') stepTs['emissao_nota'] = nowIso;
        if (workflowStatus === 'em_separacao') stepTs['em_separacao'] = nowIso;
        if (workflowStatus === 'em_transporte') stepTs['em_transporte'] = nowIso;
        summaryUpdate.stepTimestamps = stepTs;

        if (workflowStatus === 'emissao_nota') {
            const selectedFile = invoiceFiles[order.id];
            if (!selectedFile) {
                alert('Selecione a nota fiscal para avançar para Em separação.');
                return;
            }
        }

        if (workflowStatus === 'em_transporte') {
            const selectedProof = deliveryProofFiles[order.id];
            if (!selectedProof) {
                alert('Anexe a foto do canhoto assinado para marcar como entregue.');
                return;
            }
        }

        setActionLoadingId(order.id);
        try {
            const headers = await getAuthHeaders(session?.access_token);
            let invoiceFilePayload: any = undefined;

            if (workflowStatus === 'emissao_nota') {
                const selectedFile = invoiceFiles[order.id];
                if (!selectedFile) throw new Error('Selecione a nota fiscal para avançar.');

                const fileBase64 = await fileToBase64(selectedFile);
                invoiceFilePayload = {
                    fileName: selectedFile.name,
                    fileType: selectedFile.type || 'application/octet-stream',
                    fileSize: selectedFile.size,
                    fileBase64,
                };
            }

            let deliveryProofPayload: any = undefined;

            if (workflowStatus === 'em_transporte') {
                const selectedProof = deliveryProofFiles[order.id];
                if (!selectedProof) throw new Error('Anexe a foto do canhoto assinado.');

                const proofBase64 = await fileToBase64(selectedProof);
                deliveryProofPayload = {
                    fileName: selectedProof.name,
                    fileType: selectedProof.type || 'application/octet-stream',
                    fileSize: selectedProof.size,
                    fileBase64: proofBase64,
                };
            }

            const res = await fetch('/api/pedidos', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    action: 'update_status',
                    pedido_id: order.id,
                    status: action.nextStatus,
                    summary_update: Object.keys(summaryUpdate).length > 0 ? summaryUpdate : undefined,
                    invoice_file: invoiceFilePayload,
                    delivery_proof_file: deliveryProofPayload,
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao avançar pedido');
            }

            if (workflowStatus === 'emissao_nota') {
                setInvoiceFiles(prev => ({ ...prev, [order.id]: null }));
            }
            if (workflowStatus === 'em_transporte') {
                setDeliveryProofFiles(prev => ({ ...prev, [order.id]: null }));
            }

            await fetchOrders();
        } catch (error: any) {
            console.error('Erro ao avançar pedido:', error);
            alert(error?.message || 'Erro ao avançar pedido.');
        } finally {
            setActionLoadingId(null);
        }
    };

    useEffect(() => {
        if (!initialized) return;

        if (!user) {
            setOrders([]);
            setLoading(false);
            return;
        }

        // Initial fetch via API route (handles fornecedor_id lookup server-side)
        fetchOrders();

        // Set up realtime subscription for pedidos changes
        const channel = supabase
            .channel('orders-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'pedidos',
            }, () => {
                fetchOrders();
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [user, initialized, fetchOrders]);

    const filteredOrders = orders.filter(order => {
        if (activeTab !== 'all') {
            const orderStep = mapOrderWorkflowStatus(order.rawStatus);
            if (activeTab !== orderStep) return false;
        }
        const matchesSearch =
            order.clientCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.workName && order.workName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            order.location.city.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    const handleStatusUpdate = async (orderId: string, newStatus: SaleStatus) => {
        try {
            const supabaseStatus = mapToSupabaseStatus(newStatus);
            const headers = await getAuthHeaders(session?.access_token);
            const res = await fetch('/api/pedidos', {
                method: 'POST',
                headers,
                credentials: 'include',
                body: JSON.stringify({
                    action: 'update_status',
                    pedido_id: orderId,
                    status: supabaseStatus
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao atualizar');
            }

            // Refresh orders
            fetchOrders();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Erro ao atualizar status.');
        }
    };

    const openChatForOrder = (order: SaleOrder) => {
        const recipientId = order.clientId;
        const recipientName = 'Cliente';

        setOpenChats((prev) => {
            // If chat for this recipient is already open, update its initial room
            const existing = prev.find((chat) => chat.recipientId === recipientId);
            if (existing) {
                return prev.map(c => c.recipientId === recipientId
                    ? { ...c, initialRoomId: order.id, initialRoomTitle: order.workName }
                    : c
                );
            }
            return [...prev, { recipientName, recipientId, initialRoomId: order.id, initialRoomTitle: order.workName }];
        });
        window.dispatchEvent(new CustomEvent('chat-room-opened', { detail: { recipientId } }));
    };

    const closeChat = (recipientId: string) => {
        setOpenChats((prev) => prev.filter((chat) => chat.recipientId !== recipientId));
        window.dispatchEvent(new CustomEvent('chat-room-closed', { detail: { recipientId } }));
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando pedidos...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Top - Filters */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-4">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-bold text-gray-900">Meus Pedidos</h2>
                    <div className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            placeholder="Buscar por cliente, obra..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {[
                        { key: 'all' as const, label: 'Todos', active: 'bg-gray-900 text-white' },
                        { key: 'pendente' as const, label: 'Pendente', active: 'bg-yellow-100 text-yellow-800' },
                        { key: 'aprovado' as const, label: 'Aprovado', active: 'bg-orange-100 text-orange-800' },
                        { key: 'em_separacao' as const, label: 'Em separação', active: 'bg-blue-100 text-blue-800' },
                        { key: 'em_transporte' as const, label: 'Em transporte', active: 'bg-indigo-100 text-indigo-800' },
                        { key: 'entregue' as const, label: 'Entregue', active: 'bg-green-100 text-green-800' },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${activeTab === tab.key ? tab.active : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Orders Table */}
            {filteredOrders.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm">
                    Nenhum pedido encontrado.
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pedido</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Obra</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {filteredOrders.map((order) => {
                                const wfStep = mapOrderWorkflowStatus(order.rawStatus);
                                return (
                                    <tr
                                        key={order.id}
                                        onClick={() => setSelectedOrder(order)}
                                        className={`cursor-pointer transition-colors hover:bg-gray-50 ${selectedOrder?.id === order.id ? "bg-blue-50" : ""}`}
                                    >
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="text-sm font-bold text-blue-600">#{order.numero}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-gray-900">{order.workName || "Obra sem nome"}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-sm text-gray-600">{order.clientCode}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                ${wfStep === 'entregue' ? 'bg-green-100 text-green-800' :
                                                    wfStep === 'em_transporte' ? 'bg-indigo-100 text-indigo-800' :
                                                        wfStep === 'em_separacao' ? 'bg-blue-100 text-blue-800' :
                                                            wfStep === 'aprovado' ? 'bg-orange-100 text-orange-800' :
                                                                'bg-yellow-100 text-yellow-800'}`}>
                                                {getOrderWorkflowLabel(wfStep)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">{order.totalValue ? `R$ ${order.totalValue.toFixed(2)}` : "A definir"}</span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Order Detail Modal */}
            {selectedOrder && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedOrder(null)}>
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Detail Header */}
                        <div className="p-6 border-b border-gray-200 bg-gray-50">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <h2 className="text-xl font-bold text-gray-900">{selectedOrder.workName}</h2>
                                        <span className="text-sm font-bold text-blue-600">#{selectedOrder.numero}</span>
                                    </div>
                                    <p className="text-sm text-gray-600 flex items-center gap-2">
                                        <TruckIcon className="h-4 w-4" />
                                        {selectedOrder.location.fullAddress}, {selectedOrder.location.neighborhood} - {selectedOrder.location.city}/{selectedOrder.location.state}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openChatForOrder(selectedOrder)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        <ChatBubbleLeftRightIcon className="h-5 w-5" />
                                        Chat
                                    </button>
                                    <button
                                        onClick={() => setSelectedOrder(null)}
                                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            </div>

                            {/* Workflow Stepper */}
                            {(() => {
                                const wfStep = mapOrderWorkflowStatus(selectedOrder.rawStatus);
                                const wfAction = getOrderActionByStep(wfStep);
                                const summary = (selectedOrder as any)._pedido_summary || {};
                                const invoiceAttachment = summary.invoiceAttachment;
                                const stepTimestamps = summary.stepTimestamps || {};
                                const currentIdx = WORKFLOW_STEPS.indexOf(wfStep);

                                const fmtDate = (iso: string) => {
                                    try {
                                        const d = new Date(iso);
                                        return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
                                            d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                    } catch { return ''; }
                                };

                                const getStepDate = (step: WorkflowStep): string | null => {
                                    if (step === 'pendente') return selectedOrder.createdAt || null;
                                    if (step === 'aprovado') return stepTimestamps['aprovado'] || (selectedOrder as any)._data_confirmacao || null;
                                    if (step === 'entregue') return stepTimestamps['entregue'] || (selectedOrder as any)._data_entrega || null;
                                    return stepTimestamps[step] || null;
                                };

                                return (
                                    <div className="space-y-3">
                                        <p className="text-sm font-semibold text-gray-900">Fluxo do pedido</p>
                                        <div className="flex flex-wrap gap-2">
                                            {WORKFLOW_STEPS.map((step, idx) => {
                                                const isDone = idx < currentIdx;
                                                const isActive = idx === currentIdx;
                                                const ts = getStepDate(step);
                                                return (
                                                    <div key={step} className="flex flex-col items-center gap-0.5">
                                                        <span
                                                            className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${isDone ? 'bg-green-200 text-green-900' :
                                                                isActive ? 'bg-yellow-100 text-yellow-800 border border-yellow-300' :
                                                                    'bg-gray-100 text-gray-500'
                                                                }`}
                                                        >
                                                            {isDone && '✓ '}{getOrderWorkflowLabel(step)}
                                                        </span>
                                                        {ts && (isDone || isActive) && (
                                                            <span className="text-[10px] text-gray-400 leading-tight">
                                                                {fmtDate(ts)}
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {invoiceAttachment && (
                                            <div className="text-xs text-gray-600 bg-blue-50 border border-blue-100 rounded-md px-3 py-2">
                                                Nota anexada: <span className="font-medium text-gray-800">{invoiceAttachment.fileName}</span>
                                                {invoiceAttachment.publicUrl && (
                                                    <a href={invoiceAttachment.publicUrl} target="_blank" rel="noreferrer" className="ml-2 text-blue-600 hover:underline">
                                                        Abrir arquivo
                                                    </a>
                                                )}
                                            </div>
                                        )}

                                        {summary.deliveryProofAttachment && (
                                            <div className="text-xs text-gray-600 bg-green-50 border border-green-100 rounded-md px-3 py-2">
                                                Canhoto: <span className="font-medium text-gray-800">{summary.deliveryProofAttachment.fileName}</span>
                                                {summary.deliveryProofAttachment.publicUrl && (
                                                    <a href={summary.deliveryProofAttachment.publicUrl} target="_blank" rel="noreferrer" className="ml-2 text-green-600 hover:underline">
                                                        Abrir foto
                                                    </a>
                                                )}
                                            </div>
                                        )}

                                        {wfAction && (
                                            <div className="flex flex-wrap items-center gap-3">
                                                {wfStep === 'emissao_nota' && (
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[11px] font-medium text-gray-700">Nota fiscal:</label>
                                                        <input
                                                            type="file"
                                                            accept="application/pdf,image/*"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0] || null;
                                                                if (!file) {
                                                                    setInvoiceFiles(prev => ({ ...prev, [selectedOrder.id]: null }));
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
                                                                setInvoiceFiles(prev => ({ ...prev, [selectedOrder.id]: file }));
                                                            }}
                                                            className="text-xs"
                                                        />
                                                        <span className="text-[11px] text-gray-500">Formatos: PDF/JPG/PNG • Máx 10MB</span>
                                                        {invoiceFiles[selectedOrder.id] && (
                                                            <span className="text-xs text-green-700">Arquivo: {invoiceFiles[selectedOrder.id]!.name}</span>
                                                        )}
                                                    </div>
                                                )}
                                                {wfStep === 'em_transporte' && (
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[11px] font-medium text-gray-700">Foto do canhoto assinado:</label>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0] || null;
                                                                if (!file) {
                                                                    setDeliveryProofFiles(prev => ({ ...prev, [selectedOrder.id]: null }));
                                                                    return;
                                                                }
                                                                if (!file.type.startsWith('image/')) {
                                                                    alert('Envie apenas imagens (JPG, PNG).');
                                                                    e.currentTarget.value = '';
                                                                    return;
                                                                }
                                                                if (file.size > MAX_INVOICE_SIZE_BYTES) {
                                                                    alert('Arquivo excede o limite de 10MB.');
                                                                    e.currentTarget.value = '';
                                                                    return;
                                                                }
                                                                setDeliveryProofFiles(prev => ({ ...prev, [selectedOrder.id]: file }));
                                                            }}
                                                            className="text-xs"
                                                        />
                                                        <span className="text-[11px] text-gray-500">Formatos: JPG/PNG • Máx 10MB</span>
                                                        {deliveryProofFiles[selectedOrder.id] && (
                                                            <span className="text-xs text-green-700">Foto: {deliveryProofFiles[selectedOrder.id]!.name}</span>
                                                        )}
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => handleAdvanceOrder(selectedOrder)}
                                                    disabled={actionLoadingId === selectedOrder.id}
                                                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
                                                >
                                                    {actionLoadingId === selectedOrder.id ? 'Atualizando...' : wfAction.label}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Detail Content */}
                        <div className="flex-1 overflow-y-auto p-6">

                            {/* Delivery Schedule */}
                            {selectedOrder.deliverySchedule && Object.keys(selectedOrder.deliverySchedule).length > 0 && (
                                <div className="mb-6 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                                    <p className="text-xs font-semibold text-indigo-900 mb-1.5 flex items-center gap-1">
                                        <ClockIcon className="h-3.5 w-3.5 text-indigo-600" />
                                        Horários de Recebimento
                                    </p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {(() => {
                                            const dayLabels: Record<string, string> = {
                                                segunda: 'Seg', monday: 'Seg',
                                                terca: 'Ter', tuesday: 'Ter',
                                                quarta: 'Qua', wednesday: 'Qua',
                                                quinta: 'Qui', thursday: 'Qui',
                                                sexta: 'Sex', friday: 'Sex',
                                                sabado: 'Sáb', saturday: 'Sáb',
                                                domingo: 'Dom', sunday: 'Dom',
                                            };
                                            const dayOrder = ['segunda', 'monday', 'terca', 'tuesday', 'quarta', 'wednesday', 'quinta', 'thursday', 'sexta', 'friday', 'sabado', 'saturday', 'domingo', 'sunday'];
                                            const entries = Object.entries(selectedOrder.deliverySchedule!)
                                                .sort(([a], [b]) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
                                            return entries.map(([day, schedule]) => (
                                                <span key={day} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${schedule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'}`}>
                                                    <span className="font-semibold">{dayLabels[day] || day}</span>
                                                    {schedule.enabled ? `${schedule.startTime}–${schedule.endTime}` : 'Fechado'}
                                                </span>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Client Details for Invoicing */}
                            {selectedOrder.clientDetails && (
                                <div className="mb-8 bg-blue-50 border border-blue-100 rounded-lg p-4">
                                    <h3 className="text-base font-semibold text-blue-900 mb-2">Dados do Cliente (Contato)</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-blue-800"><span className="font-medium">Nome:</span> {selectedOrder.clientDetails.name}</p>
                                            <p className="text-blue-800"><span className="font-medium">CPF/CNPJ:</span> {selectedOrder.clientDetails.document}</p>
                                        </div>
                                        <div>
                                            <p className="text-blue-800"><span className="font-medium">Email:</span> {selectedOrder.clientDetails.email}</p>
                                            <p className="text-blue-800"><span className="font-medium">Telefone:</span> {selectedOrder.clientDetails.phone}</p>
                                        </div>
                                        <div className="col-span-1 sm:col-span-2">
                                            <p className="text-blue-800"><span className="font-medium">Endereço:</span> {selectedOrder.location?.fullAddress || selectedOrder.clientDetails.address}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Items Table */}
                            <div className="mb-8">
                                <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <DocumentTextIcon className="h-5 w-5 text-gray-500" />
                                    Itens do Pedido
                                </h3>
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qtd</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Preço Unit.</th>
                                                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {selectedOrder.items.map((item) => {
                                                const price = item.unitPrice || selectedOrder.proposal?.items?.[item.id]?.price || 0;
                                                const total = item.total || (price * item.quantity);
                                                return (
                                                    <tr key={item.id}>
                                                        <td className="px-4 py-3 text-sm text-gray-900">{item.name}</td>
                                                        <td className="px-4 py-3 text-center text-sm text-gray-600">{item.quantity} {item.unit}</td>
                                                        <td className="px-4 py-3 text-right text-sm text-gray-600">R$ {price.toFixed(2)}</td>
                                                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">R$ {total.toFixed(2)}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot className="bg-gray-50">
                                            <tr>
                                                <td colSpan={3} className="px-4 py-3 text-right text-sm font-medium text-gray-900">Total Geral</td>
                                                <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                                                    R$ {selectedOrder.totalValue?.toFixed(2) || "0.00"}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Interface */}
            {openChats.map((chat, index) => (
                <ChatInterface
                    key={chat.recipientId}
                    isOpen={true}
                    onClose={() => closeChat(chat.recipientId)}
                    recipientName={chat.recipientName}
                    recipientId={chat.recipientId}
                    initialRoomId={chat.initialRoomId}
                    initialRoomTitle={chat.initialRoomTitle}
                    offsetIndex={index}
                />
            ))}
        </div>
    );
}
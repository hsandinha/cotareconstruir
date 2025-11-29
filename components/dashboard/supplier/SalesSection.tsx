"use client";

import { useState } from "react";
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

type SaleStatus = "pending" | "responded" | "negotiating" | "approved" | "completed" | "cancelled";

type DaySchedule = {
    enabled: boolean;
    startTime: string;
    endTime: string;
};

interface SaleOrder {
    id: string;
    clientCode: string;
    clientName?: string; // Revealed only when approved
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
    }[];
    status: SaleStatus;
    createdAt: string;
    deadline?: string;
    totalValue?: number;
    proposal?: {
        freight: number;
        availability: string; // e.g., "Imediata", "5 dias"
        validity: string;
        paymentTerms?: string;
    };
}

export function SupplierSalesSection() {
    const [activeTab, setActiveTab] = useState<"all" | "pending" | "negotiating" | "approved">("all");
    const [selectedOrder, setSelectedOrder] = useState<SaleOrder | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    // Mock Data
    const [orders, setOrders] = useState<SaleOrder[]>([
        {
            id: "REQ-2025-001",
            clientCode: "Cliente X-001",
            workName: "Cond. Ed. A. Nogueira",
            location: {
                neighborhood: "Vila Madalena",
                city: "São Paulo",
                state: "SP",
                fullAddress: "Rua Harmonia, 123"
            },
            deliverySchedule: {
                monday: { enabled: true, startTime: "08:00", endTime: "17:00" },
                tuesday: { enabled: true, startTime: "08:00", endTime: "17:00" },
                wednesday: { enabled: true, startTime: "08:00", endTime: "17:00" },
                thursday: { enabled: true, startTime: "08:00", endTime: "17:00" },
                friday: { enabled: true, startTime: "08:00", endTime: "17:00" },
                saturday: { enabled: false, startTime: "08:00", endTime: "12:00" },
                sunday: { enabled: false, startTime: "08:00", endTime: "12:00" },
            },
            status: "pending",
            createdAt: "2025-11-29 14:30",
            deadline: "2025-12-01 18:00",
            items: [
                { id: 1, name: "Cimento CP-II", quantity: 50, unit: "saco" },
                { id: 2, name: "Areia Média", quantity: 5, unit: "m³" }
            ]
        },
        {
            id: "REQ-2025-002",
            clientCode: "Cliente Y-002",
            clientName: "Construtora ABC",
            workName: "Edifício Residencial Santos Dumont",
            location: {
                neighborhood: "Pinheiros",
                city: "São Paulo",
                state: "SP",
                fullAddress: "Av. Pedroso de Morais, 456"
            },
            deliverySchedule: {
                monday: { enabled: true, startTime: "07:00", endTime: "16:00" },
                tuesday: { enabled: true, startTime: "07:00", endTime: "16:00" },
                wednesday: { enabled: true, startTime: "07:00", endTime: "16:00" },
                thursday: { enabled: true, startTime: "07:00", endTime: "16:00" },
                friday: { enabled: true, startTime: "07:00", endTime: "16:00" },
                saturday: { enabled: true, startTime: "08:00", endTime: "12:00" },
                sunday: { enabled: false, startTime: "08:00", endTime: "12:00" },
            },
            status: "approved",
            createdAt: "2025-11-28 09:00",
            totalValue: 15420.50,
            items: [
                { id: 1, name: "Tijolo Baiano", quantity: 2000, unit: "un" }
            ],
            proposal: {
                freight: 150.00,
                availability: "Imediata",
                validity: "2025-12-05"
            }
        },
        {
            id: "REQ-2025-003",
            clientCode: "Cliente Z-003",
            workName: "Reforma Comercial - Loja Shopping",
            location: {
                neighborhood: "Itaim Bibi",
                city: "São Paulo",
                state: "SP",
                fullAddress: "Rua João Cachoeira, 789"
            },
            deliverySchedule: {
                monday: { enabled: false, startTime: "08:00", endTime: "17:00" },
                tuesday: { enabled: true, startTime: "09:00", endTime: "18:00" },
                wednesday: { enabled: true, startTime: "09:00", endTime: "18:00" },
                thursday: { enabled: true, startTime: "09:00", endTime: "18:00" },
                friday: { enabled: false, startTime: "09:00", endTime: "18:00" },
                saturday: { enabled: false, startTime: "08:00", endTime: "12:00" },
                sunday: { enabled: false, startTime: "08:00", endTime: "12:00" },
            },
            status: "negotiating",
            createdAt: "2025-11-27 16:45",
            items: [
                { id: 1, name: "Porcelanato 60x60", quantity: 100, unit: "m²" }
            ],
            proposal: {
                freight: 200.00,
                availability: "10 dias",
                validity: "2025-12-10"
            }
        }
    ]);

    // Proposal Form State
    const [proposalForm, setProposalForm] = useState({
        freight: "",
        availability: "Imediata",
        validity: "",
        paymentTerms: "",
        items: {} as Record<number, number> // itemId -> price
    });

    const filteredOrders = orders.filter(order => {
        if (activeTab !== "all" && order.status !== activeTab) {
            if (activeTab === "pending" && order.status !== "pending") return false;
            if (activeTab === "negotiating" && (order.status !== "negotiating" && order.status !== "responded")) return false;
            if (activeTab === "approved" && (order.status !== "approved" && order.status !== "completed")) return false;
        }
        if (searchTerm) {
            return order.clientCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.id.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return true;
    });

    const handleOpenOrder = (order: SaleOrder) => {
        setSelectedOrder(order);
        // Reset form if needed
        setProposalForm({
            freight: order.proposal?.freight.toString() || "",
            availability: order.proposal?.availability || "Imediata",
            validity: order.proposal?.validity || "",
            paymentTerms: order.proposal?.paymentTerms || "",
            items: {}
        });
    };

    const handleSendProposal = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOrder) return;

        // Update order status to responded/negotiating
        const updatedOrders = orders.map(o =>
            o.id === selectedOrder.id
                ? {
                    ...o, status: "responded" as SaleStatus, proposal: {
                        freight: Number(proposalForm.freight),
                        availability: proposalForm.availability,
                        validity: proposalForm.validity,
                        paymentTerms: proposalForm.paymentTerms
                    }
                }
                : o
        );
        setOrders(updatedOrders);
        setSelectedOrder({ ...selectedOrder, status: "responded" });
        alert("Proposta enviada com sucesso!");
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">Minhas Vendas</h3>
                    <p className="text-sm text-gray-600">
                        Gerencie pedidos, responda cotações e acompanhe suas vendas.
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar pedido..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64"
                        />
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    {[
                        { id: "all", label: "Todos" },
                        { id: "pending", label: "Novas Cotações" },
                        { id: "negotiating", label: "Em Negociação" },
                        { id: "approved", label: "Vendas Fechadas" },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`
                                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                                ${activeTab === tab.id
                                    ? "border-blue-500 text-blue-600"
                                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                                }
                            `}
                        >
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Orders List */}
                <div className="lg:col-span-1 space-y-4">
                    {filteredOrders.map((order) => (
                        <div
                            key={order.id}
                            onClick={() => handleOpenOrder(order)}
                            className={`
                                cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md
                                ${selectedOrder?.id === order.id
                                    ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                                    : "border-gray-200 bg-white"
                                }
                            `}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-semibold text-gray-500">{order.id}</span>
                                <span className={`
                                    inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                    ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                                    ${order.status === 'approved' ? 'bg-green-100 text-green-800' : ''}
                                    ${order.status === 'negotiating' ? 'bg-blue-100 text-blue-800' : ''}
                                    ${order.status === 'responded' ? 'bg-purple-100 text-purple-800' : ''}
                                `}>
                                    {order.status === 'pending' && 'Nova Cotação'}
                                    {order.status === 'approved' && 'Aprovado'}
                                    {order.status === 'negotiating' && 'Negociando'}
                                    {order.status === 'responded' && 'Enviada'}
                                </span>
                            </div>
                            <h4 className="text-sm font-bold text-gray-900 mb-1">
                                {order.status === 'approved' ? order.clientName : order.clientCode}
                            </h4>
                            <div className="flex items-center text-xs text-gray-600 mb-2">
                                <TruckIcon className="h-3 w-3 mr-1" />
                                {order.location.neighborhood}, {order.location.city}
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-100 pt-2">
                                <span>{order.items.length} itens</span>
                                <span className="flex items-center">
                                    <ClockIcon className="h-3 w-3 mr-1" />
                                    {new Date(order.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                        </div>
                    ))}
                    {filteredOrders.length === 0 && (
                        <div className="text-center py-8 text-gray-500 text-sm">
                            Nenhum pedido encontrado.
                        </div>
                    )}
                </div>

                {/* Detail View */}
                <div className="lg:col-span-2">
                    {selectedOrder ? (
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                            {/* Detail Header */}
                            <div className="border-b border-gray-200 p-6 bg-gray-50">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">
                                            {selectedOrder.status === 'approved' ? selectedOrder.clientName : selectedOrder.clientCode}
                                        </h2>
                                        <p className="text-sm text-gray-600 mt-1">
                                            Pedido #{selectedOrder.id}
                                        </p>
                                    </div>
                                    {(selectedOrder.status === 'pending' || selectedOrder.status === 'negotiating' || selectedOrder.status === 'approved' || selectedOrder.status === 'responded') && (
                                        <button
                                            onClick={() => setIsChatOpen(true)}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            <ChatBubbleLeftRightIcon className="h-5 w-5" />
                                            Chat com Cliente
                                        </button>
                                    )}
                                </div>

                                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Obra</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                            {selectedOrder.workName || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Local de Entrega</p>
                                        <p className="text-sm font-medium text-gray-900 mt-1">
                                            {selectedOrder.location.neighborhood}
                                        </p>
                                        <p className="text-xs text-gray-600">{selectedOrder.location.city} - {selectedOrder.location.state}</p>
                                        {selectedOrder.location.fullAddress && (
                                            <p className="text-xs text-gray-600 mt-1">{selectedOrder.location.fullAddress}</p>
                                        )}
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border border-gray-200">
                                        <p className="text-xs text-gray-500 uppercase font-semibold">Prazo Cotação</p>
                                        <p className="text-sm font-medium text-red-600 mt-1">
                                            {selectedOrder.deadline ? new Date(selectedOrder.deadline).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                {/* Delivery Schedule */}
                                {selectedOrder.deliverySchedule && (
                                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                            <ClockIcon className="h-5 w-5 text-blue-600" />
                                            Dias e Horários de Entrega na Obra
                                        </h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {Object.entries({
                                                monday: "Seg",
                                                tuesday: "Ter",
                                                wednesday: "Qua",
                                                thursday: "Qui",
                                                friday: "Sex",
                                                saturday: "Sáb",
                                                sunday: "Dom"
                                            }).map(([dayKey, dayLabel]) => {
                                                const schedule = selectedOrder.deliverySchedule?.[dayKey as keyof typeof selectedOrder.deliverySchedule];
                                                if (!schedule?.enabled) return null;
                                                return (
                                                    <div key={dayKey} className="bg-white rounded-md p-2 border border-blue-200">
                                                        <p className="text-xs font-semibold text-gray-900">{dayLabel}</p>
                                                        <p className="text-xs text-gray-600 mt-0.5">
                                                            {schedule.startTime} - {schedule.endTime}
                                                        </p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Items List */}
                            <div className="p-6">
                                <h3 className="text-sm font-bold text-gray-900 uppercase mb-4">Itens Solicitados</h3>
                                <div className="space-y-4">
                                    {selectedOrder.items.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                            <div>
                                                <p className="font-medium text-gray-900">{item.name}</p>
                                                {item.observation && (
                                                    <p className="text-xs text-gray-500 mt-1">Obs: {item.observation}</p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-gray-900">{item.quantity} {item.unit}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Proposal Form / Details */}
                            <div className="border-t border-gray-200 p-6 bg-gray-50">
                                <h3 className="text-sm font-bold text-gray-900 uppercase mb-4">
                                    {selectedOrder.status === 'pending' ? 'Enviar Proposta' : 'Detalhes da Proposta'}
                                </h3>

                                {selectedOrder.status === 'pending' ? (
                                    <form onSubmit={handleSendProposal} className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Frete (R$)</label>
                                                <input
                                                    type="number"
                                                    required
                                                    value={proposalForm.freight}
                                                    onChange={(e) => setProposalForm({ ...proposalForm, freight: e.target.value })}
                                                    className="w-full rounded-lg border-gray-300 text-sm text-gray-900"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Prazo de Entrega</label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={proposalForm.availability}
                                                    onChange={(e) => setProposalForm({ ...proposalForm, availability: e.target.value })}
                                                    className="w-full rounded-lg border-gray-300 text-sm text-gray-900"
                                                    placeholder="Ex: Imediata, 24h, 3-5 dias"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Validade da Proposta</label>
                                                <input
                                                    type="date"
                                                    required
                                                    value={proposalForm.validity}
                                                    onChange={(e) => setProposalForm({ ...proposalForm, validity: e.target.value })}
                                                    className="w-full rounded-lg border-gray-300 text-sm text-gray-900"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Condições de Pagamento</label>
                                                <select
                                                    value={proposalForm.paymentTerms || ""}
                                                    onChange={(e) => setProposalForm({ ...proposalForm, paymentTerms: e.target.value })}
                                                    className="w-full rounded-lg border-gray-300 text-sm text-gray-900"
                                                    required
                                                >
                                                    <option value="">Selecione...</option>
                                                    <option value="PIX">PIX</option>
                                                    <option value="Cartão">Cartão de Crédito</option>
                                                    <option value="PIX / Cartão">PIX / Cartão</option>
                                                    <option value="A Faturar 30d">A Faturar 30 dias</option>
                                                    <option value="A Faturar 45d">A Faturar 45 dias</option>
                                                    <option value="A Faturar 60d">A Faturar 60 dias</option>
                                                    <option value="PIX / A Faturar 30d">PIX / A Faturar 30d</option>
                                                    <option value="Cartão / A Faturar 30d">Cartão / A Faturar 30d</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="pt-4 flex justify-end">
                                            <button
                                                type="submit"
                                                className="px-6 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                                            >
                                                Enviar Proposta
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div className="p-3 bg-white rounded border border-gray-200">
                                            <span className="text-gray-500 block text-xs">Frete</span>
                                            <span className="font-medium">R$ {selectedOrder.proposal?.freight.toFixed(2)}</span>
                                        </div>
                                        <div className="p-3 bg-white rounded border border-gray-200">
                                            <span className="text-gray-500 block text-xs">Disponibilidade</span>
                                            <span className="font-medium">{selectedOrder.proposal?.availability}</span>
                                        </div>
                                        <div className="p-3 bg-white rounded border border-gray-200">
                                            <span className="text-gray-500 block text-xs">Validade</span>
                                            <span className="font-medium">{selectedOrder.proposal?.validity}</span>
                                        </div>
                                        <div className="p-3 bg-white rounded border border-gray-200">
                                            <span className="text-gray-500 block text-xs">Condições de Pagamento</span>
                                            <span className="font-medium">{selectedOrder.proposal?.paymentTerms || 'N/A'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl p-12">
                            <DocumentTextIcon className="h-16 w-16 mb-4 text-gray-300" />
                            <p className="text-lg font-medium text-gray-500">Selecione um pedido para ver os detalhes</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Modal */}
            {isChatOpen && selectedOrder && (
                <ChatInterface
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                    recipientName={selectedOrder.status === 'approved' ? selectedOrder.clientName || "Cliente" : selectedOrder.clientCode}
                    initialMessage={`Olá! Recebemos sua proposta para o pedido #${selectedOrder.id}. Podemos negociar alguns detalhes?`}
                />
            )}
        </div>
    );
}
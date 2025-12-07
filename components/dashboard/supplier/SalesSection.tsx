"use client";

import { useState, useEffect } from "react";
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
import { auth, db } from "../../../lib/firebase";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

type SaleStatus = "pending" | "responded" | "negotiating" | "approved" | "completed" | "cancelled";

type DaySchedule = {
    enabled: boolean;
    startTime: string;
    endTime: string;
};

interface SaleOrder {
    id: string;
    quotationId: string;
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
    const [activeTab, setActiveTab] = useState<"all" | "pending" | "negotiating" | "approved">("all");
    const [selectedOrder, setSelectedOrder] = useState<SaleOrder | null>(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [orders, setOrders] = useState<SaleOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [userUid, setUserUid] = useState<string | null>(null);

    const [negotiationModal, setNegotiationModal] = useState<{
        isOpen: boolean;
        order: SaleOrder | null;
        bestPrice: number;
        currentPrice: number;
        bestFreight: number;
        discountPercent: number;
    } | null>(null);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                setUserUid(user.uid);
                // Query orders where supplierId is the current user
                const q = query(collection(db, "orders"), where("supplierId", "==", user.uid));
                const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
                    const items: SaleOrder[] = [];
                    snapshot.forEach((doc) => {
                        items.push({ id: doc.id, ...doc.data() } as SaleOrder);
                    });
                    setOrders(items);
                    setLoading(false);
                });
                return () => unsubscribeSnapshot();
            } else {
                setOrders([]);
                setLoading(false);
            }
        });

        return () => unsubscribeAuth();
    }, []);

    const filteredOrders = orders.filter(order => {
        const matchesTab = activeTab === "all" || order.status === activeTab;
        const matchesSearch =
            order.clientCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (order.workName && order.workName.toLowerCase().includes(searchTerm.toLowerCase())) ||
            order.location.city.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesTab && matchesSearch;
    });

    const handleStatusUpdate = async (orderId: string, newStatus: SaleStatus) => {
        try {
            await updateDoc(doc(db, "orders", orderId), {
                status: newStatus
            });
        } catch (error) {
            console.error("Error updating status:", error);
            alert("Erro ao atualizar status.");
        }
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando vendas...</div>;
    }

    return (
        <div className="flex h-[calc(100vh-100px)] gap-6">
            {/* Left Column - List */}
            <div className="w-1/3 flex flex-col bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                {/* Header & Filters */}
                <div className="p-4 border-b border-gray-200 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900">Minhas Vendas</h2>
                        <div className="flex gap-2">
                            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
                                <FunnelIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar por cliente, obra..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 absolute left-3 top-2.5" />
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        <button
                            onClick={() => setActiveTab("all")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${activeTab === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                            Todas
                        </button>
                        <button
                            onClick={() => setActiveTab("pending")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${activeTab === "pending" ? "bg-yellow-100 text-yellow-800" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                            Pendentes
                        </button>
                        <button
                            onClick={() => setActiveTab("negotiating")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${activeTab === "negotiating" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                            Em Negociação
                        </button>
                        <button
                            onClick={() => setActiveTab("approved")}
                            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${activeTab === "approved" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                        >
                            Aprovadas
                        </button>
                    </div>
                </div>

                {/* Orders List */}
                <div className="flex-1 overflow-y-auto">
                    {filteredOrders.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            Nenhuma venda encontrada.
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredOrders.map((order) => (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className={`p-4 cursor-pointer transition-colors hover:bg-gray-50 ${selectedOrder?.id === order.id ? "bg-blue-50 border-l-4 border-blue-500" : "border-l-4 border-transparent"}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-medium text-gray-500">{order.id}</span>
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                                            ${order.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                order.status === 'negotiating' ? 'bg-blue-100 text-blue-800' :
                                                    order.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                                                        'bg-yellow-100 text-yellow-800'}`}>
                                            {order.status === 'approved' ? 'Aprovado' :
                                                order.status === 'negotiating' ? 'Negociação' :
                                                    order.status === 'completed' ? 'Concluído' : 'Pendente'}
                                        </span>
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-900 mb-1">{order.workName || "Obra sem nome"}</h3>
                                    <p className="text-xs text-gray-600 mb-2">{order.clientCode}</p>
                                    <div className="flex items-center gap-4 text-xs text-gray-500">
                                        <span className="flex items-center gap-1">
                                            <ClockIcon className="h-3 w-3" />
                                            {new Date(order.createdAt).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <CurrencyDollarIcon className="h-3 w-3" />
                                            {order.totalValue ? `R$ ${order.totalValue.toFixed(2)}` : "A definir"}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Column - Details */}
            <div className="flex-1 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                {selectedOrder ? (
                    <>
                        {/* Detail Header */}
                        <div className="p-6 border-b border-gray-200 flex justify-between items-start bg-gray-50">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <h2 className="text-xl font-bold text-gray-900">{selectedOrder.workName}</h2>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium
                                        ${selectedOrder.status === 'approved' ? 'bg-green-100 text-green-800' :
                                            selectedOrder.status === 'negotiating' ? 'bg-blue-100 text-blue-800' :
                                                'bg-yellow-100 text-yellow-800'}`}>
                                        {selectedOrder.status.toUpperCase()}
                                    </span>
                                </div>
                                <p className="text-sm text-gray-600 flex items-center gap-2">
                                    <TruckIcon className="h-4 w-4" />
                                    {selectedOrder.location.fullAddress}, {selectedOrder.location.neighborhood} - {selectedOrder.location.city}/{selectedOrder.location.state}
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsChatOpen(true)}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <ChatBubbleLeftRightIcon className="h-5 w-5" />
                                    Chat
                                </button>
                                {selectedOrder.status === 'negotiating' && (
                                    <button
                                        onClick={() => handleStatusUpdate(selectedOrder.id, 'approved')}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                                    >
                                        <CheckCircleIcon className="h-5 w-5" />
                                        Aprovar Venda
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Detail Content */}
                        <div className="flex-1 overflow-y-auto p-6">
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
                                            <p className="text-blue-800"><span className="font-medium">Endereço:</span> {selectedOrder.clientDetails.address}</p>
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

                            {/* Delivery Schedule */}
                            {selectedOrder.deliverySchedule && (
                                <div className="mb-8">
                                    <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                        <ClockIcon className="h-5 w-5 text-gray-500" />
                                        Horários de Recebimento
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {Object.entries(selectedOrder.deliverySchedule).map(([day, schedule]) => (
                                            <div key={day} className={`p-3 rounded-lg border ${schedule.enabled ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                                                <p className="text-xs font-medium uppercase mb-1 text-gray-500">
                                                    {day === 'monday' ? 'Segunda' :
                                                        day === 'tuesday' ? 'Terça' :
                                                            day === 'wednesday' ? 'Quarta' :
                                                                day === 'thursday' ? 'Quinta' :
                                                                    day === 'friday' ? 'Sexta' :
                                                                        day === 'saturday' ? 'Sábado' : 'Domingo'}
                                                </p>
                                                <p className="text-sm font-semibold text-gray-900">
                                                    {schedule.enabled ? `${schedule.startTime} - ${schedule.endTime}` : 'Fechado'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <DocumentTextIcon className="h-16 w-16 mb-4 text-gray-300" />
                        <p className="text-lg font-medium">Selecione uma venda para ver os detalhes</p>
                    </div>
                )}
            </div>

            {/* Chat Interface */}
            {isChatOpen && selectedOrder && (
                <ChatInterface
                    isOpen={isChatOpen}
                    onClose={() => setIsChatOpen(false)}
                    recipientName={selectedOrder.clientName || selectedOrder.clientCode}
                    recipientId={selectedOrder.clientCode} // Should be actual client ID
                    orderId={selectedOrder.id}
                    orderTitle={selectedOrder.workName}
                />
            )}
        </div>
    );
}
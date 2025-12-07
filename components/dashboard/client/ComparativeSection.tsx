"use client";

import { useState, useEffect } from "react";
import { ArrowDownOnSquareIcon, ChatBubbleLeftRightIcon, StarIcon } from "@heroicons/react/24/outline";
import { ChatInterface } from "../../ChatInterface";
import { ReviewModal } from "../../ReviewModal";
import { auth, db } from "../../../lib/firebase";
import { doc, collection, onSnapshot, query, orderBy, writeBatch, serverTimestamp, where, getDocs, getDoc } from "firebase/firestore";

interface ClientComparativeSectionProps {
    orderId?: string;
    status?: string;
}

import { sendEmail } from "../../../app/actions/email";

export function ClientComparativeSection({ orderId, status }: ClientComparativeSectionProps) {
    const [quotation, setQuotation] = useState<any>(null);
    const [proposals, setProposals] = useState<any[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // State for selection logic
    const [selectedSuppliers, setSelectedSuppliers] = useState<{ [itemId: string]: string }>({}); // itemId -> supplierId
    const [rejectedSuppliers, setRejectedSuppliers] = useState<string[]>([]);
    const [view, setView] = useState<"map" | "oc">("map");
    const [chatRecipient, setChatRecipient] = useState<string | null>(null);
    const [negotiationModal, setNegotiationModal] = useState<{
        isOpen: boolean;
        supplier: any;
        step: 'initial' | 'discount' | 'freight' | 'closed';
        discountPercent: number;
    } | null>(null);
    const [reviewModal, setReviewModal] = useState<{
        isOpen: boolean;
        supplierId: string;
        supplierName: string;
    } | null>(null);

    useEffect(() => {
        if (!orderId) return;

        setLoading(true);

        // 1. Listen to Quotation
        const unsubQuotation = onSnapshot(doc(db, "quotations", orderId), (doc) => {
            if (doc.exists()) {
                setQuotation({ id: doc.id, ...doc.data() });
            }
        });

        // 2. Listen to Proposals
        const qProposals = query(collection(db, "quotations", orderId, "proposals"), orderBy("totalValue", "asc"));
        const unsubProposals = onSnapshot(qProposals, (snapshot) => {
            const props = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setProposals(props);
            setLoading(false);
        });

        // 3. Listen to Orders (if finished)
        let unsubOrders = () => { };
        if (status === "finished") {
            const qOrders = query(collection(db, "orders"), where("quotationId", "==", orderId));
            unsubOrders = onSnapshot(qOrders, (snapshot) => {
                setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            });
        }

        return () => {
            unsubQuotation();
            unsubProposals();
            unsubOrders();
        };
    }, [orderId, status]);

    useEffect(() => {
        if (quotation?.status === 'finished' && orderId) {
            const fetchOrders = async () => {
                const q = query(collection(db, "orders"), where("quotationId", "==", orderId));
                const snapshot = await getDocs(q);
                setOrders(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            };
            fetchOrders();
        }
    }, [quotation?.status, orderId]);

    if (loading) {
        return <div className="p-12 text-center">Carregando mapa comparativo...</div>;
    }

    if (quotation?.status === 'finished') {
        return (
            <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                        <ArrowDownOnSquareIcon className="w-8 h-8 text-green-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-green-800 mb-2">Pedido Finalizado!</h2>
                    <p className="text-green-700 max-w-2xl mx-auto">
                        Seus pedidos foram gerados e enviados aos fornecedores com sucesso.
                        Abaixo você pode visualizar os detalhes de cada pedido gerado.
                    </p>
                </div>

                <div className="grid gap-6">
                    {orders.map((order) => (
                        <div key={order.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">{order.supplierName}</h3>
                                    <p className="text-sm text-gray-500">Pedido #{order.id.slice(0, 8)}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                                        ${order.status === 'approved' ? 'bg-green-100 text-green-800' :
                                            order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                'bg-gray-100 text-gray-800'}`}>
                                        {order.status === 'pending' ? 'Aguardando Confirmação' :
                                            order.status === 'approved' ? 'Confirmado pelo Fornecedor' :
                                                order.status}
                                    </span>
                                </div>
                            </div>
                            <div className="p-6">
                                <table className="min-w-full text-sm mb-4">
                                    <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Item</th>
                                            <th className="px-4 py-2 text-center">Qtde</th>
                                            <th className="px-4 py-2 text-right">Unitário</th>
                                            <th className="px-4 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {order.items.map((item: any) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-2 font-medium text-gray-900">{item.descricao || item.name}</td>
                                                <td className="px-4 py-2 text-center">{item.quantidade || item.quantity}</td>
                                                <td className="px-4 py-2 text-right">R$ {item.unitPrice?.toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right">R$ {item.total?.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-right font-semibold text-gray-700">Frete</td>
                                            <td className="px-4 py-2 text-right font-semibold text-gray-700">R$ {order.freight?.toFixed(2)}</td>
                                        </tr>
                                        <tr>
                                            <td colSpan={3} className="px-4 py-2 text-right font-bold text-gray-900">Total</td>
                                            <td className="px-4 py-2 text-right font-bold text-gray-900">R$ {order.total?.toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!proposals.length) {
        return (
            <div className="p-12 text-center bg-white rounded-lg border border-gray-200 mt-6">
                <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                    <ChatBubbleLeftRightIcon className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Aguardando Propostas</h3>
                <p className="text-gray-500 mt-2 max-w-md mx-auto">
                    Os fornecedores estão analisando seu pedido. O mapa comparativo será gerado automaticamente assim que recebermos as primeiras propostas.
                </p>
            </div>
        );
    }

    // Helper to find price of an item in a proposal
    const getItemPrice = (proposal: any, itemId: string | number) => {
        const item = proposal.items.find((i: any) => i.itemId === itemId);
        return item ? parseFloat(item.price) : 0;
    };

    const getItemTotal = (proposal: any, itemId: string | number) => {
        const item = proposal.items.find((i: any) => i.itemId === itemId);
        return item ? parseFloat(item.price) * item.quantity : 0;
    };

    function bestSupplier(itemId: string | number): string | null {
        let bestId: string | null = null;
        let bestPrice: number | null = null;

        proposals.forEach((p) => {
            const price = getItemPrice(p, itemId);
            if (price > 0) {
                if (bestPrice === null || price < bestPrice) {
                    bestPrice = price;
                    bestId = p.supplierId; // Using supplierId to identify column
                }
            }
        });

        return bestId;
    }

    function columnTotal(supplierId: string) {
        const proposal = proposals.find(p => p.supplierId === supplierId);
        return proposal ? proposal.totalValue : 0;
    }

    function handleSelectSupplier(itemId: string | number, supplierId: string) {
        setSelectedSuppliers((prev) => ({
            ...prev,
            [itemId]: supplierId,
        }));
    }

    function handleSelectBestPerItem() {
        const newSelections: { [itemId: string]: string } = {};
        quotation.items.forEach((item: any) => {
            const best = bestSupplier(item.id);
            if (best) {
                newSelections[item.id] = best;
            }
        });
        setSelectedSuppliers(newSelections);
    }


    function handleSelectBestWithFreight() {
        // Simplified logic: Find supplier with lowest total for ALL items
        // In a real scenario, we would check if they quoted all items and add freight

        let bestSupplierId: string | null = null;
        let bestTotal: number = Infinity;

        proposals.forEach((proposal) => {
            // Check if proposal covers all items (optional check, for now assuming partials are allowed but we want best total)
            if (proposal.totalValue < bestTotal) {
                bestTotal = proposal.totalValue;
                bestSupplierId = proposal.supplierId;
            }
        });

        if (bestSupplierId) {
            const newSelections: { [itemId: string]: string } = {};
            quotation.items.forEach((item: any) => {
                // Only select if this supplier actually quoted the item
                if (getItemPrice(proposals.find(p => p.supplierId === bestSupplierId), item.id) > 0) {
                    newSelections[item.id] = bestSupplierId!;
                }
            });
            setSelectedSuppliers(newSelections);
        }
    }

    function handleGenerateOC() {
        if (Object.keys(selectedSuppliers).length === 0) {
            alert("Selecione pelo menos um fornecedor para os itens.");
            return;
        }
        setView("oc");
    }

    async function handleFinalizeOrder() {
        if (!quotation || !orderId) return;

        try {
            const batch = writeBatch(db);

            // Group items by supplier
            const itemsBySupplier: { [key: string]: any[] } = {};

            quotation.items.forEach((item: any) => {
                const selectedId = selectedSuppliers[item.id];
                if (selectedId) {
                    if (!itemsBySupplier[selectedId]) {
                        itemsBySupplier[selectedId] = [];
                    }

                    const proposal = proposals.find(p => p.supplierId === selectedId);
                    const price = getItemPrice(proposal, item.id);
                    const total = price * item.quantidade;

                    itemsBySupplier[selectedId].push({
                        id: item.id,
                        name: item.descricao,
                        quantity: item.quantidade,
                        unit: item.unidade,
                        unitPrice: price,
                        total: total,
                        observation: item.observacao || ""
                    });
                }
            });

            // Fetch client details
            const clientDoc = await getDoc(doc(db, "users", auth.currentUser!.uid));
            const clientData = clientDoc.data();
            const clientDetails = {
                name: clientData?.name || clientData?.companyName || "Cliente",
                document: clientData?.cnpj || clientData?.cpf || "",
                email: clientData?.email || "",
                phone: clientData?.phone || "",
                address: clientData?.address || ""
            };

            // Create orders and update proposals
            await Promise.all(Object.entries(itemsBySupplier).map(async ([supplierId, items]) => {
                const proposal = proposals.find(p => p.supplierId === supplierId);

                // Fetch supplier details
                const supplierDoc = await getDoc(doc(db, "users", supplierId));
                const supplierData = supplierDoc.data();
                const supplierDetails = {
                    name: supplierData?.companyName || supplierData?.name || "Fornecedor",
                    document: supplierData?.cnpj || "",
                    email: supplierData?.email || "",
                    phone: supplierData?.phone || supplierData?.whatsapp || "",
                    address: supplierData?.address || ""
                };

                const supplierTotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
                const freight = proposal?.freightPrice || 0;
                const finalTotal = supplierTotal + freight;

                const orderRef = doc(collection(db, "orders"));
                batch.set(orderRef, {
                    quotationId: orderId,
                    clientId: auth.currentUser?.uid,
                    clientCode: quotation.clientCode || "Cliente",
                    clientDetails: clientDetails,
                    supplierDetails: supplierDetails,
                    location: quotation.location || {},
                    supplierId: supplierId,
                    supplierName: proposal?.supplierName || "Fornecedor",
                    items: items,
                    subtotal: supplierTotal,
                    freight: freight,
                    total: finalTotal,
                    status: "pending",
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });

                if (proposal?.id) {
                    const proposalRef = doc(db, "quotations", orderId, "proposals", proposal.id);
                    batch.update(proposalRef, { status: "accepted" });

                    const rootProposalRef = doc(db, "proposals", proposal.id);
                    batch.update(rootProposalRef, { status: "accepted" });
                }

                // Create notification for the supplier
                const notificationRef = doc(collection(db, "notifications"));
                batch.set(notificationRef, {
                    userId: supplierId,
                    title: "Novo Pedido Recebido!",
                    message: `Você recebeu um novo pedido de compra.`,
                    type: "success",
                    read: false,
                    createdAt: serverTimestamp(),
                    relatedId: orderRef.id,
                    relatedType: "order"
                });

                // Send email notification
                if (supplierDetails.email) {
                    // Fire and forget or await - awaiting to ensure it's sent
                    await sendEmail({
                        to: supplierDetails.email,
                        subject: "Sua proposta foi aceita! - Cota Reconstruir",
                        html: `
                            <h1>Parabéns! Sua proposta foi aceita.</h1>
                            <p>Você recebeu um novo pedido de compra do cliente <strong>${clientDetails.name}</strong>.</p>
                            <p>Acesse a plataforma para ver os detalhes do pedido e entrar em contato com o cliente.</p>
                            <p>Valor total: R$ ${finalTotal.toFixed(2)}</p>
                        `
                    });
                }
            }));

            const quotationRef = doc(db, "quotations", orderId);
            batch.update(quotationRef, { status: "finished" });

            await batch.commit();
            alert("Pedidos gerados com sucesso!");
            window.location.reload();

        } catch (error) {
            console.error("Error finalizing order:", error);
            alert("Erro ao finalizar pedido. Tente novamente.");
        }
    }

    if (view === "oc") {
        // If finished, use the orders data which contains full details
        if (status === "finished" && orders.length > 0) {
            return (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-slate-900">Pedidos Confirmados</h2>
                        <button onClick={() => setView("map")} className="text-sm text-blue-600 hover:underline">Voltar ao Mapa</button>
                    </div>
                    {orders.map(order => (
                        <div key={order.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{order.supplierDetails?.name || order.supplierName}</h3>
                                    <div className="text-sm text-slate-600 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                                        <p><span className="font-medium">CNPJ:</span> {order.supplierDetails?.document || "N/A"}</p>
                                        <p><span className="font-medium">Email:</span> {order.supplierDetails?.email || "N/A"}</p>
                                        <p><span className="font-medium">Telefone:</span> {order.supplierDetails?.phone || "N/A"}</p>
                                        <p><span className="font-medium">Endereço:</span> {order.supplierDetails?.address || "N/A"}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-500">Total Pedido</p>
                                    <p className="text-lg font-bold text-slate-900">R$ {order.total.toFixed(2)}</p>
                                    <button
                                        onClick={() => setReviewModal({ isOpen: true, supplierId: order.supplierId, supplierName: order.supplierName })}
                                        className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center justify-end gap-1 ml-auto"
                                    >
                                        <StarIcon className="h-4 w-4" /> Avaliar Fornecedor
                                    </button>
                                </div>
                            </div>

                            <table className="min-w-full text-sm mb-4">
                                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Item</th>
                                        <th className="px-4 py-2 text-center">Qtde</th>
                                        <th className="px-4 py-2 text-right">Unitário</th>
                                        <th className="px-4 py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {order.items.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-2 font-medium text-slate-900">{item.name || item.descricao}</td>
                                            <td className="px-4 py-2 text-center">{item.quantity || item.quantidade}</td>
                                            <td className="px-4 py-2 text-right">R$ {item.unitPrice.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right">R$ {item.total.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={3} className="px-4 py-2 text-right font-semibold text-slate-700">Frete</td>
                                        <td className="px-4 py-2 text-right font-semibold text-slate-700">R$ {order.freight.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="flex justify-end">
                                <button className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                                    <ArrowDownOnSquareIcon className="h-4 w-4" />
                                    Exportar PDF
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        // Group items by selected supplier
        const itemsBySupplier: { [key: string]: any[] } = {};
        let totalGlobal = 0;

        quotation.items.forEach((item: any) => {
            const selectedId = selectedSuppliers[item.id];
            if (selectedId) {
                if (!itemsBySupplier[selectedId]) {
                    itemsBySupplier[selectedId] = [];
                }

                const proposal = proposals.find(p => p.supplierId === selectedId);
                const price = getItemPrice(proposal, item.id);
                const total = price * item.quantidade;

                itemsBySupplier[selectedId].push({
                    ...item,
                    unitPrice: price,
                    total: total
                });
                totalGlobal += total;
            }
        });

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-slate-900">Ordem de Compra Gerada</h2>
                    <button
                        onClick={() => setView("map")}
                        className="text-sm text-blue-600 hover:underline"
                    >
                        Voltar ao Mapa
                    </button>
                </div>

                {Object.entries(itemsBySupplier).map(([supplierId, items]) => {
                    const proposal = proposals.find(p => p.supplierId === supplierId);
                    const supplierLabel = proposal?.supplierName || "Fornecedor";
                    const supplierTotal = items.reduce((sum: number, item: any) => sum + item.total, 0);
                    const freight = proposal?.freightPrice || 0;

                    return (
                        <div key={supplierId} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{supplierLabel}</h3>
                                    <p className="text-sm text-slate-500">Fornecedor Selecionado</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-slate-500">Total Pedido</p>
                                    <p className="text-lg font-bold text-slate-900">R$ {(supplierTotal + freight).toFixed(2)}</p>
                                    {status === "finished" && (
                                        <button
                                            onClick={() => setReviewModal({ isOpen: true, supplierId, supplierName: supplierLabel })}
                                            className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center justify-end gap-1"
                                        >
                                            <StarIcon className="h-4 w-4" /> Avaliar Fornecedor
                                        </button>
                                    )}
                                </div>
                            </div>

                            <table className="min-w-full text-sm mb-4">
                                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2 text-left">Item</th>
                                        <th className="px-4 py-2 text-center">Qtde</th>
                                        <th className="px-4 py-2 text-right">Unitário</th>
                                        <th className="px-4 py-2 text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item: any) => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-2 font-medium text-slate-900">{item.descricao}</td>
                                            <td className="px-4 py-2 text-center">{item.quantidade}</td>
                                            <td className="px-4 py-2 text-right">R$ {item.unitPrice.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right">R$ {item.total.toFixed(2)}</td>
                                        </tr>
                                    ))}
                                    <tr>
                                        <td colSpan={3} className="px-4 py-2 text-right font-semibold text-slate-700">Frete</td>
                                        <td className="px-4 py-2 text-right font-semibold text-slate-700">R$ {freight.toFixed(2)}</td>
                                    </tr>
                                </tbody>
                            </table>

                            <div className="flex justify-end">
                                <button className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                                    <ArrowDownOnSquareIcon className="h-4 w-4" />
                                    Exportar PDF
                                </button>
                            </div>
                        </div>
                    );
                })}

                <div className="flex justify-end pt-6 border-t border-slate-200">
                    <div className="text-right">
                        <p className="text-sm text-slate-500 mb-1">Total Geral dos Pedidos</p>
                        <p className="text-2xl font-bold text-slate-900 mb-4">R$ {totalGlobal.toFixed(2)}</p>
                        <button
                            onClick={handleFinalizeOrder}
                            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-lg hover:bg-green-700 transition-all"
                        >
                            Confirmar e Finalizar Pedidos
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-[32px] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        Mapa comparativo
                    </p>
                    <h2 className="text-xl font-semibold text-slate-900">
                        Selecione os melhores fornecedores
                    </h2>
                    <p className="text-sm text-slate-500">
                        Compare preços, fretes e selecione o fornecedor para cada item ou grupo.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleSelectBestWithFreight}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-blue-700 transition-colors"
                    >
                        Melhor Preço Total
                    </button>
                    <button
                        onClick={handleSelectBestPerItem}
                        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors"
                    >
                        Melhor Preço por Item
                    </button>
                </div>
            </div>

            {/* Delta Comparison Card */}
            {(() => {
                // Calcular soma dos melhores preços por item (SEM frete)
                let bestPerItemTotal = 0;

                quotation.items.forEach((item: any) => {
                    const best = bestSupplier(item.id);
                    if (best) {
                        const proposal = proposals.find(p => p.supplierId === best);
                        if (proposal) {
                            bestPerItemTotal += getItemTotal(proposal, item.id);
                        }
                    }
                });

                // Calcular melhor preço com frete (fornecedor único com todos os itens)
                let bestWithFreightMerchandise = Infinity;
                let bestWithFreightSupplier: string | null = null;
                let bestWithFreightCost = 0;

                proposals.forEach((proposal) => {
                    // Check if supplier covers all items
                    const coversAllItems = quotation.items.every((item: any) => getItemPrice(proposal, item.id) > 0);
                    if (!coversAllItems) return;

                    const merchandiseTotal = proposal.totalValue;
                    const freight = proposal.freightPrice || 0;
                    const totalWithFreight = merchandiseTotal + freight;

                    if (totalWithFreight < bestWithFreightMerchandise + bestWithFreightCost) {
                        bestWithFreightMerchandise = merchandiseTotal;
                        bestWithFreightSupplier = proposal.supplierId;
                        bestWithFreightCost = freight;
                    }
                });

                if (!bestWithFreightSupplier) return null;

                const bestWithFreightTotal = bestWithFreightMerchandise + bestWithFreightCost;
                const delta = bestPerItemTotal - bestWithFreightMerchandise;
                const percentSavings = bestPerItemTotal > 0 ? (delta / bestPerItemTotal) * 100 : 0;
                const isBetterDeal = bestWithFreightMerchandise < bestPerItemTotal;

                const bestSupplierName = proposals.find(p => p.supplierId === bestWithFreightSupplier)?.supplierName || "Fornecedor";

                return (
                    <div className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-900 uppercase mb-4">Análise de Economia</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Melhores Preços por Item</p>
                                <p className="text-2xl font-bold text-gray-900">R$ {bestPerItemTotal.toFixed(2)}</p>
                                <p className="text-xs text-gray-500 mt-1">Múltiplos fornecedores (sem frete)</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Fornecedor Único</p>
                                <p className="text-2xl font-bold text-blue-600">R$ {bestWithFreightMerchandise.toFixed(2)}</p>
                                <p className="text-xs text-gray-500 mt-1">{bestSupplierName} (sem frete)</p>
                            </div>
                            <div className="bg-white rounded-xl p-4 border border-gray-200">
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Frete</p>
                                <p className="text-2xl font-bold text-gray-900">R$ {bestWithFreightCost.toFixed(2)}</p>
                                <p className="text-xs text-gray-500 mt-1">Total com frete: R$ {bestWithFreightTotal.toFixed(2)}</p>
                            </div>
                            <div className={`bg-white rounded-xl p-4 border-2 ${isBetterDeal ? 'border-green-400' : 'border-red-400'}`}>
                                <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Economia na Mercadoria</p>
                                <p className={`text-2xl font-bold ${isBetterDeal ? 'text-green-600' : 'text-red-600'}`}>
                                    {isBetterDeal ? '-' : '+'} R$ {Math.abs(delta).toFixed(2)}
                                </p>
                                <p className={`text-xs font-semibold mt-1 ${isBetterDeal ? 'text-green-600' : 'text-red-600'}`}>
                                    {isBetterDeal ? '↓' : '↑'} {Math.abs(percentSavings).toFixed(1)}%
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-100">
                <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                            <th className="border-b border-slate-100 px-4 py-3 text-black text-left">Item</th>
                            <th className="border-b border-slate-100 px-4 py-3 text-black text-center">Qtde</th>
                            <th className="border-b border-slate-100 px-4 py-3 text-black text-center">Unidade</th>
                            {proposals.map((proposal) => (
                                <th key={proposal.id} className="border-b border-slate-100 px-4 py-3 text-black text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <span>{proposal.supplierName}</span>
                                        <button
                                            onClick={() => setChatRecipient(proposal.supplierName)}
                                            className="text-xs font-normal text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full"
                                        >
                                            <ChatBubbleLeftRightIcon className="h-3 w-3" />
                                            Chat
                                        </button>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {quotation.items.map((item: any) => {
                            const highlight = bestSupplier(item.id);
                            return (
                                <tr key={item.id} className="odd:bg-white even:bg-slate-50/60">
                                    <td className="border-b border-slate-100 px-4 py-3">
                                        <p className="font-semibold text-slate-900">{item.descricao}</p>
                                    </td>
                                    <td className="border-b border-slate-100 px-4 py-3 text-center text-slate-900 font-medium">
                                        {item.quantidade}
                                    </td>
                                    <td className="border-b border-slate-100 px-4 py-3 text-center text-slate-700">
                                        {item.unidade}
                                    </td>
                                    {proposals.map((proposal) => {
                                        const price = getItemPrice(proposal, item.id);
                                        const total = getItemTotal(proposal, item.id);
                                        const isBest = highlight === proposal.supplierId && price > 0;
                                        const isSelected = selectedSuppliers[item.id] === proposal.supplierId;

                                        return (
                                            <td
                                                key={`${item.id}-${proposal.id}`}
                                                onClick={() => price > 0 && handleSelectSupplier(item.id, proposal.supplierId)}
                                                className={`border-b border-slate-100 px-4 py-3 text-center cursor-pointer transition-colors
                                                    ${isSelected ? "bg-blue-100 ring-2 ring-inset ring-blue-500" : isBest ? "bg-emerald-50/80 hover:bg-emerald-100" : "hover:bg-slate-100"}
                                                `}
                                            >
                                                {price > 0 ? (
                                                    <>
                                                        <div className={`text-sm font-semibold ${isSelected ? "text-blue-900" : "text-slate-900"}`}>
                                                            R$ {price.toFixed(2)}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            Total R$ {total.toFixed(2)}
                                                        </div>
                                                        {isSelected && (
                                                            <div className="mt-1 text-[10px] font-bold text-blue-600 uppercase">
                                                                Selecionado
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="text-xs text-slate-400">Sem oferta</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        <tr className="bg-slate-50 text-sm">
                            <td className="border-t border-slate-100 px-4 py-3 text-black font-semibold">Frete (Estimado)</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-black text-center">-</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-black text-center">-</td>
                            {proposals.map((proposal) => (
                                <td
                                    key={`frete-${proposal.id}`}
                                    className="border-t border-slate-100 px-4 py-3 text-center text-slate-700 font-medium"
                                >
                                    R$ {(proposal.freightPrice || 0).toFixed(2)}
                                </td>
                            ))}
                        </tr>
                        <tr className="bg-white text-sm">
                            <td className="border-t border-slate-100 px-4 py-3 text-black font-semibold">Validade</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-black text-center">-</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-black text-center">-</td>
                            {proposals.map((proposal) => (
                                <td
                                    key={`validade-${proposal.id}`}
                                    className="border-t border-slate-100 px-4 py-3 text-center text-slate-700 font-medium"
                                >
                                    {proposal.validity || "-"}
                                </td>
                            ))}
                        </tr>
                        <tr className="bg-slate-50 text-sm">
                            <td className="border-t border-slate-100 px-4 py-3 text-black font-semibold">Condições de Pagamento</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-black text-center">-</td>
                            <td className="border-t border-slate-100 px-4 py-3 text-black text-center">-</td>
                            {proposals.map((proposal) => (
                                <td
                                    key={`payment-${proposal.id}`}
                                    className="border-t border-slate-100 px-4 py-3 text-center text-slate-700 text-xs"
                                >
                                    {proposal.paymentMethod || "-"}
                                </td>
                            ))}
                        </tr>
                        <tr className="bg-slate-900/90 text-white">
                            <td className="px-4 py-3 text-sm font-semibold">Total Mercadoria</td>
                            <td className="px-4 py-3 text-center">-</td>
                            <td className="px-4 py-3 text-center">R$</td>
                            {proposals.map((proposal) => (
                                <td key={`total-${proposal.id}`} className="px-4 py-3 text-center text-sm font-semibold">
                                    R$ {proposal.totalValue.toFixed(2)}
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mt-6 flex justify-end">
                <button
                    onClick={handleGenerateOC}
                    className="rounded-full bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                >
                    Gerar Ordem de Compra
                </button>
            </div>

            {chatRecipient && (
                <ChatInterface
                    recipientName={chatRecipient}
                    isOpen={!!chatRecipient}
                    onClose={() => setChatRecipient(null)}
                />
            )}

            {reviewModal && (
                <ReviewModal
                    isOpen={reviewModal.isOpen}
                    onClose={() => setReviewModal(null)}
                    supplierId={reviewModal.supplierId}
                    supplierName={reviewModal.supplierName}
                    orderId={orderId}
                />
            )}
        </div>
    );
}

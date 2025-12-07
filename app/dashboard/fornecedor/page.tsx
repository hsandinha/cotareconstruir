"use client";

import { useEffect, useRef, useState } from "react";
import { SupplierProfileSection } from "../../../components/dashboard/supplier/ProfileSection";
import { SupplierMaterialsSection } from "../../../components/dashboard/supplier/MaterialsSection";
import { SupplierManufacturersSection } from "../../../components/dashboard/supplier/ManufacturersSection";
import { SupplierSalesSection } from "../../../components/dashboard/supplier/SalesSection";
import { SupplierOffersSection } from "../../../components/dashboard/supplier/OffersSection";
import { SupplierQuotationInboxSection } from "../../../components/dashboard/supplier/QuotationInboxSection";
import { SupplierVerificationSection } from "../../../components/dashboard/supplier/VerificationSection";
import { NotificationBell } from "../../../components/NotificationBell";
import { auth, db } from "../../../lib/firebase";
import { collection, query, where, getCountFromServer, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export type SupplierTabId =
    | "perfil"
    | "materiais"
    | "fabricantes"
    | "vendas"
    | "ofertas"
    | "cotacoes"
    | "verificacao";

const tabs: { id: SupplierTabId; label: string }[] = [
    { id: "perfil", label: "Cadastro & Perfil" },
    { id: "verificacao", label: "Verificação" },
    { id: "materiais", label: "Cadastro de Materiais" },
    { id: "fabricantes", label: "Fabricantes" },
    { id: "vendas", label: "Minhas Vendas" },
    { id: "ofertas", label: "Minhas Ofertas" },
    { id: "cotacoes", label: "Cotações Recebidas" },
];


export default function FornecedorDashboard() {
    const router = useRouter();
    const [tab, setTab] = useState<SupplierTabId>("perfil");
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement | null>(null);
    const [userName, setUserName] = useState("Fornecedor");
    const [userInitial, setUserInitial] = useState("F");
    const [stats, setStats] = useState({
        activeConsultations: 0,
        sentProposals: 0,
        registeredMaterials: 0,
        approvals: 0,
    });

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setIsUserMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Fetch User Profile
                    const userDocRef = doc(db, "users", user.uid);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        const name = userData.name || userData.nome || "Fornecedor";
                        setUserName(name);
                        setUserInitial(name.charAt(0).toUpperCase());
                    }

                    // Active Consultations (All pending quotations in the system)
                    // In a real scenario, this might be filtered by region or category
                    const consultationsQuery = query(
                        collection(db, "quotations"),
                        where("status", "==", "pending")
                    );
                    const consultationsSnapshot = await getCountFromServer(consultationsQuery);

                    // Sent Proposals
                    const proposalsQuery = query(
                        collection(db, "proposals"),
                        where("supplierId", "==", user.uid)
                    );
                    // Note: proposals collection might not exist yet, so this might fail or return 0. 
                    // We'll wrap in try/catch or assume it returns 0 if collection doesn't exist (Firestore behavior is usually fine with empty collections)
                    const proposalsSnapshot = await getCountFromServer(proposalsQuery);

                    // Registered Materials
                    const materialsQuery = query(
                        collection(db, "materials"),
                        where("supplierId", "==", user.uid)
                    );
                    const materialsSnapshot = await getCountFromServer(materialsQuery);

                    // Approvals (Accepted proposals)
                    const approvalsQuery = query(
                        collection(db, "proposals"),
                        where("supplierId", "==", user.uid),
                        where("status", "==", "accepted")
                    );
                    const approvalsSnapshot = await getCountFromServer(approvalsQuery);

                    setStats({
                        activeConsultations: consultationsSnapshot.data().count,
                        sentProposals: proposalsSnapshot.data().count,
                        registeredMaterials: materialsSnapshot.data().count,
                        approvals: approvalsSnapshot.data().count,
                    });
                } catch (error) {
                    console.error("Error fetching stats:", error);
                }
            }
        });

        return () => unsubscribe();
    }, []);

    const handleMenuSelection = (action: "perfil" | "cadastros" | "fabricantes" | "vendas" | "ofertas" | "sair") => {
        switch (action) {
            case "perfil":
                setTab("perfil");
                break;
            case "cadastros":
                setTab("materiais");
                break;
            case "fabricantes":
                setTab("fabricantes");
                break;
            case "vendas":
                setTab("vendas");
                break;
            case "ofertas":
                setTab("ofertas");
                break;
            case "sair":
                signOut(auth).then(() => {
                    router.push("/login");
                });
                break;
        }
        setIsUserMenuOpen(false);
    };

    function renderTabContent() {
        switch (tab) {
            case "perfil":
                return <SupplierProfileSection />;
            case "verificacao":
                return <SupplierVerificationSection />;
            case "materiais":
                return <SupplierMaterialsSection />;
            case "fabricantes":
                return <SupplierManufacturersSection />;
            case "vendas":
                return <SupplierSalesSection />;
            case "ofertas":
                return <SupplierOffersSection />;
            case "cotacoes":
                return <SupplierQuotationInboxSection />;
            default:
                return <SupplierProfileSection />;
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900">
            {/* Main Header */}
            <div className="bg-white/90 backdrop-blur border-b border-slate-200/80 shadow-sm">
                <div className="section-shell">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center">
                            <span className="text-lg font-semibold text-gray-900">Cotar</span>
                            <span className="text-lg font-light text-gray-600 ml-1">& Construir</span>
                        </div>
                        <div className="flex items-center space-x-4">
                            <NotificationBell />
                            <div className="relative" ref={userMenuRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsUserMenuOpen((prev) => !prev)}
                                    className="flex items-center gap-2 rounded-full border border-transparent px-2 py-1 hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500"
                                >
                                    <div className="w-9 h-9 bg-green-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                                        {userInitial}
                                    </div>
                                    <div className="hidden sm:block text-left">
                                        <p className="text-xs text-slate-500">Bem vindo</p>
                                        <p className="text-sm font-semibold text-slate-900 flex items-center">
                                            {userName}
                                            <svg className="ml-1 h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </p>
                                    </div>
                                </button>
                                {isUserMenuOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-100 py-2 z-20">
                                        <button
                                            onClick={() => handleMenuSelection("perfil")}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                        >
                                            Perfil
                                        </button>
                                        <button
                                            onClick={() => handleMenuSelection("cadastros")}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                        >
                                            Cadastros
                                        </button>
                                        <button
                                            onClick={() => handleMenuSelection("fabricantes")}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                        >
                                            Fabricantes
                                        </button>
                                        <button
                                            onClick={() => handleMenuSelection("vendas")}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                        >
                                            Minhas Vendas
                                        </button>
                                        <button
                                            onClick={() => handleMenuSelection("ofertas")}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                        >
                                            Minhas Ofertas
                                        </button>
                                        <button
                                            onClick={() => handleMenuSelection("sair")}
                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-50"
                                        >
                                            Sair
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs Header */}
            <div className="bg-white border-b border-slate-200/80">
                <div className="section-shell">
                    <nav className="flex space-x-6 overflow-x-auto">
                        {tabs.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setTab(item.id)}
                                className={`tab-button ${tab === item.id
                                    ? 'border-green-600 text-green-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200'
                                    }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>
                </div>
            </div>

            {/* Main Content */}
            <div className="section-shell py-10">

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Consultas Ativas</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.activeConsultations}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Propostas Enviadas</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.sentProposals}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Materiais Cadastrados</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.registeredMaterials}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Aprovações</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.approvals}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="card-elevated">
                    <div className="p-6">
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        </div>
    );
}

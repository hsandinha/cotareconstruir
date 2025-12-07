"use client";

import { useEffect, useRef, useState } from "react";
import { ClientProfileSection } from "../../../components/dashboard/client/ProfileSection";
import { ClientWorksSection } from "../../../components/dashboard/client/WorksSection";
import { ClientOrderSection } from "../../../components/dashboard/client/OrderSection";
import { ClientExploreSection } from "../../../components/dashboard/client/ExploreSection";
import { ClientOpportunitiesSection } from "../../../components/dashboard/client/OpportunitiesSection";
import { NotificationBell } from "../../../components/NotificationBell";
import { auth, db } from "../../../lib/firebase";
import { collection, query, where, getCountFromServer, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useRouter } from "next/navigation";

export type TabId =
    | "perfil"
    | "obras"
    | "cotacao"
    | "pedidos"
    | "oportunidades";

const tabs: { id: TabId; label: string }[] = [
    { id: "perfil", label: "Cadastro & Perfil" },
    { id: "obras", label: "Obras & Endereços" },
    { id: "cotacao", label: "Nova Cotação" },
    { id: "pedidos", label: "Meus Pedidos" },
    { id: "oportunidades", label: "Oportunidades" },
];

export default function ClienteDashboard() {
    const router = useRouter();
    const [tab, setTab] = useState<TabId>("perfil");
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const userMenuRef = useRef<HTMLDivElement | null>(null);
    const [userName, setUserName] = useState("Cliente");
    const [userInitial, setUserInitial] = useState("C");
    const [stats, setStats] = useState({
        works: 0,
        quotations: 0,
        orders: 0,
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
                        const name = userData.companyName
                            || userData.name
                            || userData.nome
                            || user.displayName
                            || user.email
                            || "Cliente";
                        setUserName(name);
                        setUserInitial(name.charAt(0).toUpperCase());
                    }

                    // Works Count
                    const worksQuery = query(collection(db, "works"), where("userId", "==", user.uid));
                    const worksSnapshot = await getCountFromServer(worksQuery);

                    // Active Quotations Count (pending or received)
                    const quotationsQuery = query(
                        collection(db, "quotations"),
                        where("userId", "==", user.uid),
                        where("status", "in", ["pending", "received"])
                    );
                    const quotationsSnapshot = await getCountFromServer(quotationsQuery);

                    // Finished Orders Count (finished)
                    const ordersQuery = query(
                        collection(db, "quotations"),
                        where("userId", "==", user.uid),
                        where("status", "==", "finished")
                    );
                    const ordersSnapshot = await getCountFromServer(ordersQuery);

                    setStats({
                        works: worksSnapshot.data().count,
                        quotations: quotationsSnapshot.data().count,
                        orders: ordersSnapshot.data().count,
                    });
                } catch (error) {
                    console.error("Error fetching stats:", error);
                }
            } else {
                setUserName("Cliente");
                setUserInitial("C");
                router.push("/login");
            }
        });

        return () => unsubscribe();
    }, []);

    const handleMenuSelection = (action: "perfil" | "cadastros" | "sair") => {
        switch (action) {
            case "perfil":
                setTab("perfil");
                break;
            case "cadastros":
                setTab("obras");
                break;
            case "sair":
                signOut(auth).then(() => router.push("/login"));
                break;
        }
        setIsUserMenuOpen(false);
    };

    function renderTabContent() {
        switch (tab) {
            case "perfil":
                return <ClientProfileSection />;
            case "obras":
                return <ClientWorksSection />;
            case "cotacao":
                return <ClientExploreSection />;
            case "pedidos":
                return <ClientOrderSection />;
            case "oportunidades":
                return <ClientOpportunitiesSection />;
            default:
                return null;
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
                                    className="flex items-center gap-2 rounded-full border border-transparent px-2 py-1 hover:border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
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
                                    ? 'border-blue-600 text-blue-700'
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
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Perfis Ativos</p>
                                <p className="text-2xl font-semibold text-gray-900">1</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-green-100 rounded-lg">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0H3" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Obras</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.works}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-purple-100 rounded-lg">
                                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Cotações</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.quotations}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-6">
                        <div className="flex items-center">
                            <div className="p-2 bg-orange-100 rounded-lg">
                                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <div className="ml-4">
                                <p className="text-sm font-medium text-gray-500">Ordens Ativas</p>
                                <p className="text-2xl font-semibold text-gray-900">{stats.orders}</p>
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

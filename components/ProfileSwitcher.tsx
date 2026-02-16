"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ChevronDown, User, Briefcase, ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseAuth";

interface ProfileSwitcherProps {
    currentRole: string;
    availableRoles: string[];
    userName: string;
    userInitial: string;
}

export function ProfileSwitcher({ currentRole, availableRoles, userName, userInitial }: ProfileSwitcherProps) {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleToggle = () => {
        if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 8,
                left: rect.right + window.scrollX - 200 // Align right
            });
        }
        setIsOpen(!isOpen);
    };

    const handleSwitchRole = (role: string) => {
        if (role === currentRole) {
            setIsOpen(false);
            return;
        }

        // Update local storage and cookie
        localStorage.setItem("role", role);
        document.cookie = `role=${role}; path=/; max-age=86400; SameSite=Strict`;

        // Redirect
        if (role === "admin") {
            router.push("/dashboard/admin");
        } else if (role === "fornecedor") {
            router.push("/dashboard/fornecedor");
        } else {
            router.push("/dashboard/cliente");
        }

        // Force refresh to ensure state updates
        router.refresh();

        setIsOpen(false);
    };

    const handleLogout = async () => {
        try {
            // Sign out from Supabase
            await supabase.auth.signOut();

            // Clear local storage
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            localStorage.removeItem('uid');

            // Clear cookies
            document.cookie = 'token=; path=/; max-age=0';
            document.cookie = 'role=; path=/; max-age=0';

            // Force a hard redirect to login
            window.location.href = '/login';
        } catch (error) {
            console.error("Error signing out:", error);
            // Even if there's an error, redirect to login
            window.location.href = '/login';
        }
    };

    useEffect(() => {
        if (isOpen) {
            const handleScroll = () => setIsOpen(false);
            window.addEventListener('scroll', handleScroll, true);
            window.addEventListener('resize', handleScroll);
            return () => {
                window.removeEventListener('scroll', handleScroll, true);
                window.removeEventListener('resize', handleScroll);
            };
        }
    }, [isOpen]);

    const getRoleLabel = (role: string) => {
        switch (role) {
            case "admin": return "Administrador";
            case "fornecedor": return "Fornecedor";
            case "cliente": return "Cliente";
            default: return role;
        }
    };

    const getRoleIcon = (role: string) => {
        switch (role) {
            case "admin": return <ShieldCheck className="w-4 h-4" />;
            case "fornecedor": return <Briefcase className="w-4 h-4" />;
            case "cliente": return <User className="w-4 h-4" />;
            default: return <User className="w-4 h-4" />;
        }
    };

    // If user has only one role, we still show the dropdown for Logout, 
    // but we can simplify the display if needed. For now, let's keep it consistent.

    return (
        <>
            <button
                ref={buttonRef}
                onClick={handleToggle}
                className="flex items-center gap-2 rounded-full border border-transparent hover:bg-slate-50 px-2 py-1 transition-colors group"
            >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white shadow-sm group-hover:shadow-md transition-all">
                    {userInitial}
                </div>
                <div className="hidden sm:block text-left">
                    <div className="flex items-center gap-1">
                        <p className="text-xs text-slate-500">Bem vindo</p>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{userName}</p>
                </div>
            </button>

            {isOpen && typeof document !== 'undefined' && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setIsOpen(false)} />
                    <div
                        className="absolute w-56 bg-white rounded-xl shadow-xl border border-slate-100 z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: coords.top, left: coords.left }}
                    >
                        {availableRoles.length > 1 && (
                            <>
                                <div className="p-3 border-b border-slate-50 bg-slate-50/50">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alternar Perfil</p>
                                </div>
                                <div className="p-2 space-y-1">
                                    {availableRoles.map(role => (
                                        <button
                                            key={role}
                                            onClick={() => handleSwitchRole(role)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${currentRole === role
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'hover:bg-slate-50 text-slate-700'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${currentRole === role ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                {getRoleIcon(role)}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-medium">{getRoleLabel(role)}</p>
                                                {currentRole === role && <p className="text-[10px] text-blue-500 font-medium">Atual</p>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                                <div className="h-px bg-slate-100 my-1" />
                            </>
                        )}

                        <div className="p-2">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left hover:bg-red-50 text-red-600"
                            >
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100 text-red-500">
                                    <LogOut className="w-4 h-4" />
                                </div>
                                <p className="text-sm font-medium">Sair</p>
                            </button>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </>
    );
}

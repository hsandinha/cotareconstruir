"use client";

import Image from "next/image";
import { ReactNode } from "react";
import { NotificationBell } from "./NotificationBell";
import { ProfileSwitcher } from "./ProfileSwitcher";
import { ReportModal } from "./ReportModal";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";

/**
 * DashboardHeader — Shared header across all dashboard pages.
 * Renders logo, notification bell, and profile switcher.
 * Optional `children` slot renders between logo and right actions (e.g. company switcher).
 */

interface DashboardHeaderProps {
    currentRole: string;
    availableRoles: string[];
    userName: string;
    userInitial: string;
    /** Extra content between the logo and the right-side controls */
    children?: ReactNode;
}

export function DashboardHeader({ currentRole, availableRoles, userName, userInitial, children }: DashboardHeaderProps) {
    const [reportOpen, setReportOpen] = useState(false);

    return (
        <>
        {/* paddingTop da área segura: com `viewport-fit=cover` e a barra de
            status translúcida no iPhone, o conteúdo sobe até o topo da tela
            e o cabeçalho ficava embaixo do relógio e da ilha dinâmica. */}
        <div
            className="relative z-[60] bg-white/90 backdrop-blur border-b border-slate-200/80 shadow-sm"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
            <div className="section-shell">
                <div className="flex h-16 items-center justify-between">
                    <div className="flex items-center">
                        {/* A logo é a marca: o texto ao lado não cabia no
                            celular e quebrava em duas linhas. */}
                        <Image
                            src="/logo.png"
                            alt="Comprar &amp; Construir"
                            width={160}
                            height={90}
                            priority
                            className="h-9 w-auto object-contain"
                        />

                    </div>
                    <div className="flex items-center gap-4">
                        {children}
                        <button
                            onClick={() => setReportOpen(true)}
                            title="Reportar Problema"
                            className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-full transition-colors flex items-center justify-center shrink-0"
                        >
                            <ShieldAlert className="w-5 h-5" />
                        </button>
                        <NotificationBell />
                        <ProfileSwitcher
                            currentRole={currentRole}
                            availableRoles={availableRoles}
                            userName={userName}
                            userInitial={userInitial}
                        />
                    </div>
                </div>
            </div>
        </div>
        <ReportModal
            isOpen={reportOpen}
            onClose={() => setReportOpen(false)}
            targetType="plataforma"
            contextName="Plataforma Comprar & Construir"
        />
        </>
    );
}

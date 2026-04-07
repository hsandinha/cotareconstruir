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
        <div className="relative z-[60] bg-white/90 backdrop-blur border-b border-slate-200/80 shadow-sm">
            <div className="section-shell">
                <div className="flex h-16 items-center justify-between">
                    <div className="flex items-center">
                        <div className="mr-2 flex items-center justify-center rounded-lg bg-white">
                            <Image src="/logo.png" alt="Comprar & Construir" width={60} height={60} priority />
                        </div>
                        <span className="text-lg font-semibold text-gray-900">Comprar</span>
                        <span className="ml-1 text-lg font-light text-gray-600">&amp; Construir</span>
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

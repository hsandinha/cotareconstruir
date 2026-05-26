"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

// Tempo de inatividade antes de exibir o aviso (5 minutos)
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
// Tempo de contagem regressiva no modal antes do logout automático (60 segundos)
const COUNTDOWN_SECONDS = 60;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
    "mousemove",
    "mousedown",
    "keydown",
    "touchstart",
    "scroll",
    "wheel",
    "click",
];

export default function IdleSessionModal() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [showWarning, setShowWarning] = useState(false);
    const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);

    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const showWarningRef = useRef(false);

    const clearIdleTimer = () => {
        if (idleTimerRef.current) {
            clearTimeout(idleTimerRef.current);
            idleTimerRef.current = null;
        }
    };

    const clearCountdown = () => {
        if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
        }
    };

    const handleLogout = useCallback(async () => {
        clearIdleTimer();
        clearCountdown();
        showWarningRef.current = false;
        setShowWarning(false);
        try {
            await logout();
        } catch {
            // ignore
        }
        router.push("/login?reason=idle");
    }, [logout, router]);

    const startIdleTimer = useCallback(() => {
        clearIdleTimer();
        idleTimerRef.current = setTimeout(() => {
            showWarningRef.current = true;
            setRemaining(COUNTDOWN_SECONDS);
            setShowWarning(true);
        }, IDLE_TIMEOUT_MS);
    }, []);

    const handleStayConnected = useCallback(() => {
        clearCountdown();
        showWarningRef.current = false;
        setShowWarning(false);
        startIdleTimer();
    }, [startIdleTimer]);

    // Listener de atividade do usuário
    useEffect(() => {
        if (!user) return;

        const onActivity = () => {
            // Ignora atividade se já estiver no modal de aviso
            if (showWarningRef.current) return;
            startIdleTimer();
        };

        ACTIVITY_EVENTS.forEach((evt) => {
            window.addEventListener(evt, onActivity, { passive: true });
        });

        startIdleTimer();

        return () => {
            ACTIVITY_EVENTS.forEach((evt) => {
                window.removeEventListener(evt, onActivity);
            });
            clearIdleTimer();
            clearCountdown();
        };
    }, [user, startIdleTimer]);

    // Contagem regressiva quando o modal abre
    useEffect(() => {
        if (!showWarning) return;

        clearCountdown();
        countdownRef.current = setInterval(() => {
            setRemaining((prev) => {
                if (prev <= 1) {
                    clearCountdown();
                    void handleLogout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            clearCountdown();
        };
    }, [showWarning, handleLogout]);

    if (!user || !showWarning) return null;

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const timeLabel = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="idle-modal-title"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
        >
            <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
                <div className="flex items-start gap-3 border-b border-gray-200 p-5">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
                        <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
                        </svg>
                    </div>
                    <div>
                        <h2 id="idle-modal-title" className="text-lg font-semibold text-gray-900">
                            Sua sessão está sendo finalizada
                        </h2>
                        <p className="mt-1 text-sm text-gray-600">
                            Detectamos 5 minutos de inatividade. Por segurança, você será desconectado em:
                        </p>
                    </div>
                </div>
                <div className="px-5 py-6 text-center">
                    <div className="font-mono text-4xl font-bold text-gray-900">{timeLabel}</div>
                    <p className="mt-2 text-xs text-gray-500">Clique em &quot;Continuar conectado&quot; para manter a sessão ativa.</p>
                </div>
                <div className="flex flex-col-reverse gap-2 border-t border-gray-200 p-4 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Sair agora
                    </button>
                    <button
                        type="button"
                        onClick={handleStayConnected}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        Continuar conectado
                    </button>
                </div>
            </div>
        </div>
    );
}

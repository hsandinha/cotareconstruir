"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NotificationItem {
    id: string;
    title: string;
    message: string;
    read: boolean;
    link?: string | null;
    createdAt: string;
}

export default function NotificationsPage() {
    const router = useRouter();
    const { user, profile, initialized } = useAuth();
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    const getDefaultDashboardLink = useCallback(() => {
        const roles = profile?.roles || [];
        if (roles.includes("admin") || profile?.role === "admin") return "/dashboard/admin";
        if (roles.includes("fornecedor") || profile?.role === "fornecedor") return "/dashboard/fornecedor";
        return "/dashboard/cliente";
    }, [profile]);

    const resolveNotificationLink = useCallback((notification: NotificationItem) => {
        if (!notification.link || notification.link === "/dashboard") {
            return getDefaultDashboardLink();
        }
        return notification.link;
    }, [getDefaultDashboardLink]);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from("notificacoes")
                .select("id, titulo, mensagem, lida, link, created_at")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (error) throw error;

            const mapped: NotificationItem[] = (data || []).map((item: any) => ({
                id: item.id,
                title: item.titulo,
                message: item.mensagem,
                read: item.lida || false,
                link: item.link || null,
                createdAt: item.created_at,
            }));

            setNotifications(mapped);
        } catch (error) {
            console.error("Erro ao carregar notificações:", error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (!initialized) return;
        if (!user) {
            router.push("/login");
            return;
        }

        fetchNotifications();

        const channel = supabase
            .channel(`notificacoes_page_${user.id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "notificacoes",
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    fetchNotifications();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [initialized, user, router, fetchNotifications]);

    const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

    const markAsRead = async (notificationId: string) => {
        try {
            await supabase
                .from("notificacoes")
                .update({ lida: true, data_leitura: new Date().toISOString() })
                .eq("id", notificationId);

            setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
        } catch (error) {
            console.error("Erro ao marcar notificação como lida:", error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await supabase
                .from("notificacoes")
                .update({ lida: true, data_leitura: new Date().toISOString() })
                .eq("user_id", user?.id)
                .eq("lida", false);

            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch (error) {
            console.error("Erro ao marcar todas notificações como lidas:", error);
        }
    };

    const handleNotificationClick = async (notification: NotificationItem) => {
        await markAsRead(notification.id);
        const target = resolveNotificationLink(notification);
        if (target) {
            router.push(target);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-8 px-4 md:px-8">
            <div className="max-w-4xl mx-auto space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Todas as notificações</h1>
                        <p className="text-sm text-slate-500 mt-1">{notifications.length} notificações • {unreadCount} não lidas</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.back()}
                            className="px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                            Voltar
                        </button>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                            >
                                Marcar todas como lidas
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="p-6 text-sm text-slate-500">Carregando notificações...</div>
                    ) : notifications.length === 0 ? (
                        <div className="p-6 text-sm text-slate-500">Nenhuma notificação encontrada.</div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {notifications.map((notification) => (
                                <button
                                    key={notification.id}
                                    type="button"
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`w-full text-left p-4 hover:bg-slate-50 transition-colors ${!notification.read ? "bg-blue-50/40" : "bg-white"}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className={`text-sm font-semibold ${!notification.read ? "text-slate-900" : "text-slate-700"}`}>
                                                {notification.title}
                                            </p>
                                            <p className="text-sm text-slate-500 mt-1">{notification.message}</p>
                                        </div>
                                        <span className="text-xs text-slate-400 whitespace-nowrap">
                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: ptBR })}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

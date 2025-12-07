"use client";

import { useState, useRef, useEffect } from "react";
import { BellIcon } from "@heroicons/react/24/outline";
import { auth, db } from "../lib/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface Notification {
    id: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
    type: "info" | "success" | "warning";
    timestamp: any;
    createdAt?: any;
}

interface NotificationBellProps {
    initialNotifications?: Notification[];
}

export function NotificationBell({ initialNotifications }: NotificationBellProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                const q = query(
                    collection(db, "notifications"),
                    where("userId", "==", user.uid),
                    orderBy("createdAt", "desc")
                );

                const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
                    const newNotifications: Notification[] = snapshot.docs.map(doc => {
                        const data = doc.data();
                        const timestamp = data.createdAt?.toDate() || new Date();
                        return {
                            id: doc.id,
                            title: data.title,
                            message: data.message,
                            time: formatDistanceToNow(timestamp, { addSuffix: true, locale: ptBR }),
                            read: data.read || false,
                            type: data.type || "info",
                            timestamp: timestamp.getTime(),
                            createdAt: data.createdAt
                        };
                    });
                    setNotifications(newNotifications);
                });
                return () => unsubscribeSnapshot();
            } else {
                setNotifications([]);
            }
        });
        return () => unsubscribeAuth();
    }, []);

    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const markAsRead = async (id: string) => {
        try {
            const notifRef = doc(db, "notifications", id);
            await updateDoc(notifRef, { read: true });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const markAllAsRead = async () => {
        const unread = notifications.filter(n => !n.read);
        unread.forEach(n => markAsRead(n.id));
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-400 hover:text-gray-500 focus:outline-none"
            >
                <span className="sr-only">Ver notificações</span>
                <BellIcon className="h-6 w-6" aria-hidden="true" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50 overflow-hidden">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                        <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllAsRead}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                                Marcar todas como lidas
                            </button>
                        )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-4 text-center text-gray-500 text-sm">
                                Nenhuma notificação nova.
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification.id}
                                        className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50/50' : ''}`}
                                        onClick={() => markAsRead(notification.id)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <p className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-600'}`}>
                                                {notification.title}
                                            </p>
                                            <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                                                {notification.time}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                            {notification.message}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="p-3 border-t border-gray-100 bg-gray-50 text-center">
                        <button className="text-xs font-medium text-gray-600 hover:text-gray-900">
                            Ver histórico completo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

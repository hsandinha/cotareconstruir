"use client";

import { useState, useEffect, useRef } from "react";
import { XMarkIcon, PaperAirplaneIcon, ExclamationTriangleIcon, MinusIcon, PlusIcon } from "@heroicons/react/24/outline";
import { supabase } from "../lib/supabaseAuth";
import { useAuth } from "../lib/useAuth";
import { createReport } from "../lib/services";
import { analyzeChatMessage } from "../lib/chatModeration";

interface Message {
    id: string;
    senderId: string;
    text: string;
    createdAt: string;
}

interface ChatInterfaceProps {
    recipientName: string;
    recipientId?: string;
    onClose: () => void;
    isOpen: boolean;
    initialMessage?: string;
    orderId?: string; // Used as chat room ID
    orderTitle?: string;
    offsetIndex?: number;
}

export function ChatInterface({ recipientName, recipientId, onClose, isOpen, initialMessage, orderId, orderTitle, offsetIndex = 0 }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [blockedWarning, setBlockedWarning] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const { user: currentUser } = useAuth();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) {
            setIsMinimized(false);
        }
    }, [isOpen]);

    const getAuthHeaders = async (): Promise<Record<string, string>> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
        }
        return headers;
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchMessages = async (roomId: string) => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/chat/messages?roomId=${encodeURIComponent(roomId)}`, { headers });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Erro ao carregar mensagens');
            }

            const json = await res.json();
            const data = json.data || [];
            const msgs: Message[] = data.map((msg: any) => ({
                id: msg.id,
                senderId: msg.sender_id,
                text: msg.conteudo,
                createdAt: msg.created_at
            }));
            setMessages(msgs);
            scrollToBottom();
        } catch (error) {
            console.error('Erro ao carregar mensagens:', error);
        }
    };

    const handleReport = async () => {
        if (!currentUser || !recipientId) return;
        const reason = prompt("Por favor, descreva o motivo da denúncia:");
        if (reason) {
            try {
                await createReport(currentUser.id, recipientId, "chat", "Comportamento no Chat", reason);
                alert("Denúncia enviada. Nossa equipe irá analisar.");
            } catch (error) {
                alert("Erro ao enviar denúncia.");
            }
        }
    };

    useEffect(() => {
        if (!isOpen || !orderId) return;

        fetchMessages(orderId);

        // Subscribe to realtime updates for new messages
        const channel = supabase
            .channel(`chat-${orderId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'mensagens',
                filter: `chat_id=eq.${orderId}`
            }, (payload) => {
                const newMsg = payload.new as any;
                const msg: Message = {
                    id: newMsg.id,
                    senderId: newMsg.sender_id,
                    text: newMsg.conteudo,
                    createdAt: newMsg.created_at
                };
                setMessages(prev => prev.some(existing => existing.id === msg.id) ? prev : [...prev, msg]);
                scrollToBottom();
            })
            .subscribe();

        const canPollNow = () => document.visibilityState === 'visible' && document.hasFocus();

        const handleWakeUpRefresh = () => {
            if (canPollNow()) {
                fetchMessages(orderId);
            }
        };

        document.addEventListener('visibilitychange', handleWakeUpRefresh);
        window.addEventListener('focus', handleWakeUpRefresh);

        // Fallback polling in case realtime event is delayed/blocked
        const poller = setInterval(() => {
            if (!canPollNow()) return;
            fetchMessages(orderId);
        }, 5000);

        return () => {
            document.removeEventListener('visibilitychange', handleWakeUpRefresh);
            window.removeEventListener('focus', handleWakeUpRefresh);
            clearInterval(poller);
            channel.unsubscribe();
        };
    }, [isOpen, orderId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !currentUser || !orderId) return;

        const moderation = analyzeChatMessage(newMessage);
        if (moderation.blocked) {
            const reasons = moderation.reasons.join(', ');
            setBlockedWarning(`Mensagem bloqueada (${reasons}). Não compartilhe contato direto ou links externos.`);
            return;
        }

        setBlockedWarning(null);
        setSending(true);

        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/chat/messages', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    roomId: orderId,
                    text: newMessage,
                    recipientId,
                })
            });

            if (!res.ok) {
                const err = await res.json();
                if (res.status === 422) {
                    const reasons = Array.isArray(err.reasons) ? err.reasons.join(', ') : 'conteúdo não permitido';
                    setBlockedWarning(`Mensagem bloqueada (${reasons}). Não compartilhe contato direto ou links externos.`);
                    return;
                }
                throw new Error(err.error || 'Erro ao enviar mensagem');
            }

            const json = await res.json();
            const inserted = json?.data;
            if (inserted?.id) {
                const optimisticMessage: Message = {
                    id: inserted.id,
                    senderId: inserted.sender_id,
                    text: inserted.conteudo,
                    createdAt: inserted.created_at,
                };

                setMessages((prev) => prev.some((existing) => existing.id === optimisticMessage.id) ? prev : [...prev, optimisticMessage]);
            } else if (orderId) {
                await fetchMessages(orderId);
            }

            setNewMessage("");
        } catch (error) {
            console.error("Error sending message:", error);
        } finally {
            setSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    if (!isOpen) return null;

    const horizontalOffset = 16 + (offsetIndex * 392);

    return (
        <div
            className={`fixed bottom-4 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden ${isMinimized ? 'h-auto' : 'h-[500px]'}`}
            style={{ right: `${horizontalOffset}px` }}
        >
            {/* Header */}
            <div className="bg-slate-900 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {recipientName.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                        <h3 className="text-white font-medium text-sm truncate max-w-[200px]">{recipientName}</h3>
                        {orderTitle && <p className="text-slate-400 text-xs truncate max-w-[200px]">{orderTitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsMinimized((prev) => !prev)}
                        className="text-slate-400 hover:text-white"
                        title={isMinimized ? "Expandir" : "Minimizar"}
                    >
                        {isMinimized ? <PlusIcon className="h-5 w-5" /> : <MinusIcon className="h-5 w-5" />}
                    </button>
                    <button
                        onClick={handleReport}
                        className="text-slate-400 hover:text-red-400"
                        title="Denunciar"
                    >
                        <ExclamationTriangleIcon className="h-5 w-5" />
                    </button>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {!isMinimized && (
                <>
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                        <div className="text-center text-xs text-slate-400 my-2">
                            Chat seguro e anônimo. Seus dados estão protegidos.
                        </div>

                        {blockedWarning && (
                            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                {blockedWarning}
                            </div>
                        )}

                        {messages.length === 0 && initialMessage && (
                            <div className="flex justify-start">
                                <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-bl-none">
                                    {initialMessage}
                                </div>
                            </div>
                        )}

                        {messages.map((msg) => {
                            const isMe = msg.senderId === currentUser?.id;
                            return (
                                <div
                                    key={msg.id}
                                    className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isMe
                                            ? "bg-blue-600 text-white rounded-br-none"
                                            : "bg-white border border-slate-200 text-slate-700 rounded-bl-none"
                                            }`}
                                    >
                                        <p>{msg.text}</p>
                                        <p className={`text-[10px] mt-1 ${isMe ? "text-blue-100" : "text-slate-400"}`}>
                                            {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => {
                                    setNewMessage(e.target.value);
                                    if (blockedWarning) setBlockedWarning(null);
                                }}
                                onKeyDown={handleKeyPress}
                                placeholder="Digite sua mensagem..."
                                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!newMessage.trim() || sending}
                                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <PaperAirplaneIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
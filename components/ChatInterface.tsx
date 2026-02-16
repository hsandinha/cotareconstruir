"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { XMarkIcon, PaperAirplaneIcon, ExclamationTriangleIcon, MinusIcon, PlusIcon, ArrowLeftIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
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

interface ChatRoom {
    roomId: string;
    title: string;
    lastMessage: string;
    lastMessageAt: string;
}

interface ChatInterfaceProps {
    recipientName: string;
    recipientId: string;
    onClose: () => void;
    isOpen: boolean;
    initialMessage?: string;
    initialRoomId?: string;       // Pre-select this room on open
    initialRoomTitle?: string;    // Title hint for the initial room
    offsetIndex?: number;
}

export function ChatInterface({ recipientName, recipientId, onClose, isOpen, initialMessage, initialRoomId, initialRoomTitle, offsetIndex = 0 }: ChatInterfaceProps) {
    const [rooms, setRooms] = useState<ChatRoom[]>([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(initialRoomId || null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [blockedWarning, setBlockedWarning] = useState<string | null>(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const { user: currentUser } = useAuth();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const prevInitialRoomRef = useRef(initialRoomId);

    // When parent changes initialRoomId (e.g., user clicks Chat on another order for same recipient), navigate to it
    useEffect(() => {
        if (initialRoomId && initialRoomId !== prevInitialRoomRef.current) {
            prevInitialRoomRef.current = initialRoomId;
            setSelectedRoomId(initialRoomId);
            // Add room to list if not already there
            if (initialRoomTitle) {
                setRooms(prev => {
                    if (prev.some(r => r.roomId === initialRoomId)) return prev;
                    return [...prev, { roomId: initialRoomId, title: initialRoomTitle, lastMessage: '', lastMessageAt: '' }];
                });
            }
        }
    }, [initialRoomId, initialRoomTitle]);

    useEffect(() => {
        if (!isOpen) {
            setIsMinimized(false);
        }
    }, [isOpen]);

    const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            headers.Authorization = `Bearer ${session.access_token}`;
        }
        return headers;
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // ─── Fetch rooms for this user pair ───────────────────────────────
    const fetchRooms = useCallback(async () => {
        if (!recipientId) return;
        setLoadingRooms(true);
        try {
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/chat/rooms?recipientId=${encodeURIComponent(recipientId)}`, { headers });
            if (!res.ok) throw new Error('Erro ao carregar salas');
            const json = await res.json();
            const fetched: ChatRoom[] = json.rooms || [];

            // Merge with initial room if provided but not in the list
            if (initialRoomId) {
                const exists = fetched.some(r => r.roomId === initialRoomId);
                if (!exists) {
                    fetched.push({ roomId: initialRoomId, title: initialRoomTitle || 'Nova conversa', lastMessage: '', lastMessageAt: '' });
                }
            }

            setRooms(fetched);

            // Auto-select: if initialRoomId given, use it; if only one room, go straight in
            if (initialRoomId) {
                setSelectedRoomId(initialRoomId);
            } else if (fetched.length === 1) {
                setSelectedRoomId(fetched[0].roomId);
            }
        } catch (error) {
            console.error('Erro ao carregar salas de chat:', error);
            // If we have an initial room, use it anyway
            if (initialRoomId) {
                setRooms([{ roomId: initialRoomId, title: initialRoomTitle || 'Conversa', lastMessage: '', lastMessageAt: '' }]);
                setSelectedRoomId(initialRoomId);
            }
        } finally {
            setLoadingRooms(false);
        }
    }, [recipientId, initialRoomId, initialRoomTitle, getAuthHeaders]);

    useEffect(() => {
        if (isOpen && recipientId) {
            fetchRooms();
        }
    }, [isOpen, recipientId, fetchRooms]);

    // ─── Fetch messages for selected room ─────────────────────────────
    const fetchMessages = useCallback(async (roomId: string) => {
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
    }, [getAuthHeaders]);

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

    // ─── Subscribe to messages for selected room ──────────────────────
    useEffect(() => {
        if (!isOpen || !selectedRoomId) return;

        fetchMessages(selectedRoomId);

        const channel = supabase
            .channel(`chat-${selectedRoomId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'mensagens',
                filter: `chat_id=eq.${selectedRoomId}`
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
            if (canPollNow() && selectedRoomId) {
                fetchMessages(selectedRoomId);
            }
        };

        document.addEventListener('visibilitychange', handleWakeUpRefresh);
        window.addEventListener('focus', handleWakeUpRefresh);

        const poller = setInterval(() => {
            if (!canPollNow() || !selectedRoomId) return;
            fetchMessages(selectedRoomId);
        }, 5000);

        return () => {
            document.removeEventListener('visibilitychange', handleWakeUpRefresh);
            window.removeEventListener('focus', handleWakeUpRefresh);
            clearInterval(poller);
            channel.unsubscribe();
        };
    }, [isOpen, selectedRoomId, fetchMessages]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // ─── Send message ─────────────────────────────────────────────────
    const handleSendMessage = async () => {
        if (!newMessage.trim() || !currentUser || !selectedRoomId) return;

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
                    roomId: selectedRoomId,
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
            } else {
                await fetchMessages(selectedRoomId);
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

    const goBackToRoomList = () => {
        setSelectedRoomId(null);
        setMessages([]);
        setBlockedWarning(null);
        // Refresh room list to get updated last messages
        fetchRooms();
    };

    if (!isOpen) return null;

    const horizontalOffset = 16 + (offsetIndex * 392);
    const selectedRoom = rooms.find(r => r.roomId === selectedRoomId);
    const showRoomList = !selectedRoomId && rooms.length > 1;

    return (
        <div
            className={`fixed bottom-4 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden ${isMinimized ? 'h-auto' : 'h-[500px]'}`}
            style={{ right: `${horizontalOffset}px` }}
        >
            {/* Header */}
            <div className="bg-slate-900 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    {/* Back button if viewing messages and there are multiple rooms */}
                    {selectedRoomId && rooms.length > 1 && (
                        <button
                            onClick={goBackToRoomList}
                            className="text-slate-400 hover:text-white shrink-0"
                            title="Voltar para conversas"
                        >
                            <ArrowLeftIcon className="h-5 w-5" />
                        </button>
                    )}
                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {recipientName.charAt(0)}
                    </div>
                    <div className="overflow-hidden min-w-0">
                        <h3 className="text-white font-medium text-sm truncate">{recipientName}</h3>
                        {selectedRoom && <p className="text-slate-400 text-xs truncate">{selectedRoom.title}</p>}
                        {!selectedRoomId && <p className="text-slate-400 text-xs">{rooms.length} conversa{rooms.length !== 1 ? 's' : ''}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
                    {/* ─── Room List View ──────────────────────────────── */}
                    {showRoomList && (
                        <div className="flex-1 overflow-y-auto bg-slate-50">
                            <div className="p-3">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Conversas</p>
                            </div>
                            {loadingRooms ? (
                                <div className="p-4 text-center text-slate-400 text-sm">Carregando...</div>
                            ) : rooms.length === 0 ? (
                                <div className="p-4 text-center text-slate-400 text-sm">Nenhuma conversa encontrada</div>
                            ) : (
                                <div className="space-y-0.5">
                                    {rooms.map((room) => (
                                        <button
                                            key={room.roomId}
                                            onClick={() => setSelectedRoomId(room.roomId)}
                                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0"
                                        >
                                            <div className="flex items-center gap-3">
                                                <ChatBubbleLeftRightIcon className="h-5 w-5 text-blue-500 shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-medium text-slate-800 truncate">{room.title}</p>
                                                    {room.lastMessage && (
                                                        <p className="text-xs text-slate-500 truncate mt-0.5">{room.lastMessage}</p>
                                                    )}
                                                </div>
                                                {room.lastMessageAt && (
                                                    <span className="text-[10px] text-slate-400 shrink-0">
                                                        {new Date(room.lastMessageAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ─── Messages View ───────────────────────────────── */}
                    {(selectedRoomId || rooms.length <= 1) && (
                        <>
                            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                                <div className="text-center text-xs text-slate-400 my-2">
                                    Chat seguro e anônimo. Seus dados estão protegidos.
                                </div>

                                {blockedWarning && (
                                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                        {blockedWarning}
                                    </div>
                                )}

                                {messages.length === 0 && !loadingRooms && (
                                    <div className="text-center text-xs text-slate-400 mt-8">
                                        {initialMessage || 'Nenhuma mensagem ainda. Envie a primeira!'}
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
                                        disabled={!newMessage.trim() || sending || !selectedRoomId}
                                        className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <PaperAirplaneIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
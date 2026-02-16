"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import { ChatInterface } from "./ChatInterface";

interface IncomingChat {
    recipientId: string;
    recipientName: string;
    initialRoomId: string;
    initialRoomTitle?: string;
}

/**
 * Global listener that auto-opens a ChatInterface popup
 * whenever a new message arrives for the current user.
 * Groups chats by recipientId (one popup per user, not per room).
 */
export function ChatNotificationListener() {
    const { user } = useAuth();
    const [openChats, setOpenChats] = useState<IncomingChat[]>([]);
    const resolvedRecipients = useRef<Set<string>>(new Set());
    // Track recipients that are already open in specific sections (to avoid duplicates)
    const suppressedRecipients = useRef<Set<string>>(new Set());

    const closeChat = useCallback((recipientId: string) => {
        setOpenChats(prev => prev.filter(c => c.recipientId !== recipientId));
        resolvedRecipients.current.delete(recipientId);
    }, []);

    // Allow child components to suppress recipients they already handle
    useEffect(() => {
        const handleOpened = (e: CustomEvent<{ recipientId?: string; roomId?: string }>) => {
            const recipientId = e.detail.recipientId;
            if (recipientId) {
                suppressedRecipients.current.add(recipientId);
                setOpenChats(prev => prev.filter(c => c.recipientId !== recipientId));
            }
        };
        window.addEventListener('chat-room-opened' as any, handleOpened);

        const handleClosed = (e: CustomEvent<{ recipientId?: string; roomId?: string }>) => {
            const recipientId = e.detail.recipientId;
            if (recipientId) {
                suppressedRecipients.current.delete(recipientId);
            }
        };
        window.addEventListener('chat-room-closed' as any, handleClosed);

        return () => {
            window.removeEventListener('chat-room-opened' as any, handleOpened);
            window.removeEventListener('chat-room-closed' as any, handleClosed);
        };
    }, []);

    // On mount: check for unread chat notifications and auto-open those chats
    const checkedUnread = useRef(false);
    useEffect(() => {
        if (!user || checkedUnread.current) return;
        checkedUnread.current = true;

        (async () => {
            try {
                const { data: unreadNotifs } = await supabase
                    .from('notificacoes')
                    .select('id, link, created_at')
                    .eq('user_id', user.id)
                    .eq('lida', false)
                    .eq('titulo', 'Nova mensagem no chat')
                    .order('created_at', { ascending: false })
                    .limit(10);

                if (!unreadNotifs || unreadNotifs.length === 0) return;

                // Group by sender (recipientId) — one popup per user
                const recipientsSeen = new Set<string>();
                for (const notif of unreadNotifs) {
                    if (!notif.link) continue;
                    try {
                        const url = new URL(notif.link, 'https://placeholder.com');
                        const roomId = url.searchParams.get('chatRoom');
                        if (!roomId) continue;

                        // Find the latest message sender in this room
                        const { data: lastMsg } = await supabase
                            .from('mensagens')
                            .select('sender_id')
                            .eq('chat_id', roomId)
                            .neq('sender_id', user.id)
                            .order('created_at', { ascending: false })
                            .limit(1)
                            .single();

                        if (!lastMsg?.sender_id) continue;
                        const senderId = lastMsg.sender_id;

                        // Skip if already seen or suppressed
                        if (recipientsSeen.has(senderId)) continue;
                        if (suppressedRecipients.current.has(senderId)) continue;
                        recipientsSeen.add(senderId);

                        let senderName = 'Usuário';
                        const { data: senderData } = await supabase
                            .from('users')
                            .select('nome, email')
                            .eq('id', senderId)
                            .single();
                        if (senderData) {
                            senderName = senderData.nome || senderData.email || 'Usuário';
                        }

                        const roomTitle = roomId.includes('::') ? 'Cotação' : 'Pedido';

                        setOpenChats(prev => {
                            if (prev.some(c => c.recipientId === senderId)) return prev;
                            return [...prev, { recipientId: senderId, recipientName: senderName, initialRoomId: roomId, initialRoomTitle: roomTitle }];
                        });
                        resolvedRecipients.current.add(senderId);
                    } catch { /* skip malformed */ }
                }
            } catch (err) {
                console.error('Erro ao verificar notificações de chat não lidas:', err);
            }
        })();
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('global-chat-notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'mensagens',
            }, async (payload) => {
                const msg = payload.new as any;
                if (!msg || msg.sender_id === user.id) return;

                const roomId = msg.chat_id;
                const senderId = msg.sender_id;
                if (!roomId || !senderId) return;

                // Don't open if recipient is already handled by a section or already open globally
                if (suppressedRecipients.current.has(senderId)) return;
                if (resolvedRecipients.current.has(senderId)) return;

                resolvedRecipients.current.add(senderId);

                // Resolve sender name
                let senderName = 'Usuário';
                try {
                    const { data: senderData } = await supabase
                        .from('users')
                        .select('nome, email')
                        .eq('id', senderId)
                        .single();
                    if (senderData) {
                        senderName = senderData.nome || senderData.email || 'Usuário';
                    }
                } catch { /* ignore */ }

                const roomTitle = roomId.includes('::') ? 'Cotação' : 'Pedido';

                setOpenChats(prev => {
                    if (prev.some(c => c.recipientId === senderId)) return prev;
                    return [...prev, {
                        recipientId: senderId,
                        recipientName: senderName,
                        initialRoomId: roomId,
                        initialRoomTitle: roomTitle,
                    }];
                });
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [user]);

    // Clean up resolved recipients when chats are closed
    useEffect(() => {
        const openRecipientIds = new Set(openChats.map(c => c.recipientId));
        resolvedRecipients.current.forEach(recipientId => {
            if (!openRecipientIds.has(recipientId)) {
                resolvedRecipients.current.delete(recipientId);
            }
        });
    }, [openChats]);

    if (openChats.length === 0) return null;

    return (
        <>
            {openChats.map((chat, index) => (
                <ChatInterface
                    key={chat.recipientId}
                    isOpen={true}
                    onClose={() => closeChat(chat.recipientId)}
                    recipientName={chat.recipientName}
                    recipientId={chat.recipientId}
                    initialRoomId={chat.initialRoomId}
                    initialRoomTitle={chat.initialRoomTitle}
                    offsetIndex={index}
                />
            ))}
        </>
    );
}

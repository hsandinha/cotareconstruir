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
 * Helper to extract chat info from a notification link URL.
 */
function extractChatInfoFromLink(link: string): { roomId: string; senderId: string; senderName: string } | null {
    try {
        const url = new URL(link, 'https://placeholder.com');
        const roomId = url.searchParams.get('chatRoom');
        const senderId = url.searchParams.get('senderId');
        const senderName = url.searchParams.get('senderName');
        if (!roomId) return null;
        return { roomId, senderId: senderId || '', senderName: senderName || '' };
    } catch {
        return null;
    }
}

/**
 * Global listener that auto-opens a ChatInterface popup
 * whenever a new chat notification arrives for the current user.
 * Subscribes to `notificacoes` (has proper RLS) instead of `mensagens` (blocked by RLS).
 * Groups chats by recipientId (one popup per user, not per room).
 */
export function ChatNotificationListener() {
    const { user } = useAuth();
    const [openChats, setOpenChats] = useState<IncomingChat[]>([]);
    const resolvedRecipients = useRef<Set<string>>(new Set());
    const suppressedRecipients = useRef<Set<string>>(new Set());

    const closeChat = useCallback((recipientId: string) => {
        setOpenChats(prev => prev.filter(c => c.recipientId !== recipientId));
        resolvedRecipients.current.delete(recipientId);
    }, []);

    // Allow child components to suppress recipients they already handle
    useEffect(() => {
        const handleOpened = (e: CustomEvent<{ recipientId?: string }>) => {
            const recipientId = e.detail.recipientId;
            if (recipientId) {
                suppressedRecipients.current.add(recipientId);
                setOpenChats(prev => prev.filter(c => c.recipientId !== recipientId));
            }
        };
        window.addEventListener('chat-room-opened' as any, handleOpened);

        const handleClosed = (e: CustomEvent<{ recipientId?: string }>) => {
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

    /**
     * Helper: resolve sender name from API if not available in notification
     */
    const resolveSenderName = useCallback(async (senderId: string): Promise<string> => {
        if (!senderId) return 'Usuário';
        try {
            const { data } = await supabase
                .from('users')
                .select('nome, email')
                .eq('id', senderId)
                .single();
            return data?.nome || data?.email || 'Usuário';
        } catch {
            return 'Usuário';
        }
    }, []);

    /**
     * Process a notification and potentially open a chat popup.
     */
    const processNotification = useCallback(async (notif: { link?: string | null }) => {
        if (!notif.link) return;
        const info = extractChatInfoFromLink(notif.link);
        if (!info || !info.roomId) return;

        // Try to get senderId from the link
        let senderId = info.senderId;
        let senderName = info.senderName ? decodeURIComponent(info.senderName) : '';

        // If senderId not in link (old notifications), try to resolve from the API
        if (!senderId) return; // Skip old notifications without sender info

        // Skip if already suppressed or resolved
        if (suppressedRecipients.current.has(senderId)) return;
        if (resolvedRecipients.current.has(senderId)) return;

        // Resolve sender name if not in the link
        if (!senderName) {
            senderName = await resolveSenderName(senderId);
        }

        const roomTitle = info.roomId.includes('::') ? 'Cotação' : 'Pedido';

        resolvedRecipients.current.add(senderId);
        setOpenChats(prev => {
            if (prev.some(c => c.recipientId === senderId)) return prev;
            return [...prev, {
                recipientId: senderId,
                recipientName: senderName || 'Usuário',
                initialRoomId: info.roomId,
                initialRoomTitle: roomTitle,
            }];
        });
    }, [resolveSenderName]);

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

                for (const notif of unreadNotifs) {
                    await processNotification(notif);
                }
            } catch (err) {
                console.error('Erro ao verificar notificações de chat não lidas:', err);
            }
        })();
    }, [user, processNotification]);

    // Realtime: subscribe to notificacoes INSERT (has proper RLS, unlike mensagens)
    useEffect(() => {
        if (!user) return;

        const channel = supabase
            .channel('global-chat-notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notificacoes',
                filter: `user_id=eq.${user.id}`
            }, async (payload) => {
                const notif = payload.new as any;
                if (!notif || notif.titulo !== 'Nova mensagem no chat') return;
                await processNotification(notif);
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [user, processNotification]);

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

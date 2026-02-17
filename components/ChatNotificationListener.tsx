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
    const { user, profile } = useAuth();
    const [openChats, setOpenChats] = useState<IncomingChat[]>([]);
    const resolvedRecipients = useRef<Set<string>>(new Set());
    const suppressedRecipients = useRef<Set<string>>(new Set());

    // Anonymous label: supplier sees "Cliente", client sees "Fornecedor"
    const getAnonymousLabel = useCallback(() => {
        const roles = profile?.roles || [];
        const primaryRole = profile?.role;
        if (roles.includes('fornecedor') || primaryRole === 'fornecedor') return 'Cliente';
        return 'Fornecedor';
    }, [profile]);

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
     * Process a notification and potentially open a chat popup.
     * Uses anonymous labels (Cliente/Fornecedor) instead of real names.
     */
    const processNotification = useCallback(async (notif: { link?: string | null }) => {
        if (!notif.link) return;
        const info = extractChatInfoFromLink(notif.link);
        if (!info || !info.roomId) return;

        // Try to get senderId from the link
        let senderId = info.senderId;

        // If senderId not in link (old notifications), resolve from mensagens table
        if (!senderId) {
            try {
                const { data: lastMsg } = await supabase
                    .from('mensagens')
                    .select('sender_id')
                    .eq('chat_id', info.roomId)
                    .neq('sender_id', user?.id || '')
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (lastMsg?.sender_id) {
                    senderId = lastMsg.sender_id;
                }
            } catch { /* ignore */ }
        }

        if (!senderId) return;

        // Skip if already suppressed or resolved
        if (suppressedRecipients.current.has(senderId)) return;
        if (resolvedRecipients.current.has(senderId)) return;

        // Use anonymous label instead of real name
        const anonymousName = getAnonymousLabel();
        const roomTitle = info.roomId.includes('::') ? 'Cotação' : 'Pedido';

        resolvedRecipients.current.add(senderId);
        setOpenChats(prev => {
            if (prev.some(c => c.recipientId === senderId)) return prev;
            return [...prev, {
                recipientId: senderId,
                recipientName: anonymousName,
                initialRoomId: info.roomId,
                initialRoomTitle: roomTitle,
            }];
        });
    }, [user?.id, getAnonymousLabel]);

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

    // Realtime: subscribe to notificacoes INSERT + polling fallback
    const lastNotifCheckRef = useRef<string | null>(null);
    useEffect(() => {
        if (!user) return;

        // Realtime subscription
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

        // Polling fallback every 5s in case realtime doesn't fire
        const poller = setInterval(async () => {
            if (document.visibilityState !== 'visible') return;
            try {
                let q = supabase
                    .from('notificacoes')
                    .select('id, link, created_at')
                    .eq('user_id', user.id)
                    .eq('lida', false)
                    .eq('titulo', 'Nova mensagem no chat')
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (lastNotifCheckRef.current) {
                    q = q.gt('created_at', lastNotifCheckRef.current);
                }

                const { data: newNotifs } = await q;
                if (newNotifs && newNotifs.length > 0) {
                    lastNotifCheckRef.current = newNotifs[0].created_at;
                    for (const notif of newNotifs) {
                        await processNotification(notif);
                    }
                }
            } catch { /* ignore polling errors */ }
        }, 5000);

        return () => {
            channel.unsubscribe();
            clearInterval(poller);
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

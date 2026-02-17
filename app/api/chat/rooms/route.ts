import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function getAuthUser(req: NextRequest) {
    if (!supabaseAdmin) return null;

    const authHeader = req.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
        const supabaseAuthCookie = req.cookies
            .getAll()
            .find((cookie) => cookie.name.endsWith('-auth-token'))?.value;
        if (supabaseAuthCookie) {
            try {
                const parsed = JSON.parse(supabaseAuthCookie);
                if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
                    token = parsed[0];
                }
            } catch { }
        }
    }

    if (!token) {
        token = req.cookies.get('authToken')?.value
            || req.cookies.get('token')?.value
            || req.cookies.get('sb-access-token')?.value;
    }

    if (!token) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

/**
 * GET /api/chat/rooms?recipientId=xxx
 * Returns all chat rooms between the authenticated user and the given recipient.
 * Each room has: roomId, title, lastMessage, lastMessageAt, unreadCount
 */
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);
        const recipientId = String(searchParams.get('recipientId') || '').trim();

        if (!recipientId) {
            return NextResponse.json({ error: 'recipientId é obrigatório' }, { status: 400 });
        }

        // Find all chat_ids where either user has sent messages
        const { data: myRooms } = await supabaseAdmin
            .from('mensagens')
            .select('chat_id')
            .eq('sender_id', user.id);

        const { data: theirRooms } = await supabaseAdmin
            .from('mensagens')
            .select('chat_id')
            .eq('sender_id', recipientId);

        const myRoomIds = new Set((myRooms || []).map(r => r.chat_id));
        const theirRoomIds = new Set((theirRooms || []).map(r => r.chat_id));

        // Rooms where both users participated
        const sharedRoomIds = [...myRoomIds].filter(id => theirRoomIds.has(id));

        // Also check rooms where only one user sent messages but the room belongs to both
        // For rooms where only I sent: check if the room links to the recipient
        const onlyMyRooms = [...myRoomIds].filter(id => !theirRoomIds.has(id));
        const onlyTheirRooms = [...theirRoomIds].filter(id => !myRoomIds.has(id));

        // Resolve room membership for single-participant rooms
        for (const roomId of [...onlyMyRooms, ...onlyTheirRooms]) {
            const isShared = await checkRoomBelongsToBothUsers(roomId, user.id, recipientId);
            if (isShared) {
                sharedRoomIds.push(roomId);
            }
        }

        if (sharedRoomIds.length === 0) {
            return NextResponse.json({ rooms: [] });
        }

        // Get last message for each room and build metadata
        const rooms: Array<{
            roomId: string;
            title: string;
            lastMessage: string;
            lastMessageAt: string;
            unreadCount: number;
        }> = [];

        for (const roomId of sharedRoomIds) {
            // Get last message
            const { data: lastMsgData } = await supabaseAdmin
                .from('mensagens')
                .select('conteudo, created_at, sender_id')
                .eq('chat_id', roomId)
                .order('created_at', { ascending: false })
                .limit(1);

            const lastMsg = lastMsgData?.[0];

            // Resolve title
            const title = await resolveRoomTitle(roomId);

            rooms.push({
                roomId,
                title,
                lastMessage: lastMsg?.conteudo || '',
                lastMessageAt: lastMsg?.created_at || '',
                unreadCount: 0,
            });
        }

        // Sort by last message date
        rooms.sort((a, b) => {
            if (!a.lastMessageAt) return 1;
            if (!b.lastMessageAt) return -1;
            return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
        });

        return NextResponse.json({ rooms });
    } catch (error: any) {
        console.error('Erro GET chat/rooms:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

async function checkRoomBelongsToBothUsers(roomId: string, userA: string, userB: string): Promise<boolean> {
    if (!supabaseAdmin) return false;

    if (roomId.includes('::')) {
        // Format: cotacao_id::fornecedor_id
        const [cotacaoId, fornecedorId] = roomId.split('::');

        // Check if cotação belongs to one user and fornecedor to the other
        const { data: cotacao } = await supabaseAdmin
            .from('cotacoes')
            .select('user_id')
            .eq('id', cotacaoId)
            .single();

        if (!cotacao) return false;

        const { data: fornecedor } = await supabaseAdmin
            .from('fornecedores')
            .select('user_id')
            .eq('id', fornecedorId)
            .single();

        if (!fornecedor) return false;

        const participants = [cotacao.user_id, fornecedor.user_id];
        return participants.includes(userA) && participants.includes(userB);
    } else {
        // Assume it's a pedido_id
        const { data: pedido } = await supabaseAdmin
            .from('pedidos')
            .select('user_id, fornecedor_id')
            .eq('id', roomId)
            .single();

        if (!pedido) return false;

        // Get fornecedor's user_id
        const { data: fornecedor } = await supabaseAdmin
            .from('fornecedores')
            .select('user_id')
            .eq('id', pedido.fornecedor_id)
            .single();

        if (!fornecedor) return false;

        const participants = [pedido.user_id, fornecedor.user_id];
        return participants.includes(userA) && participants.includes(userB);
    }
}

async function resolveRoomTitle(roomId: string): Promise<string> {
    if (!supabaseAdmin) return roomId;

    if (roomId.includes('::')) {
        const [cotacaoId] = roomId.split('::');
        const { data: cotacao } = await supabaseAdmin
            .from('cotacoes')
            .select('numero')
            .eq('id', cotacaoId)
            .single();
        return cotacao?.numero ? `Cotação #${cotacao.numero}` : 'Cotação';
    } else {
        const { data: pedido } = await supabaseAdmin
            .from('pedidos')
            .select('numero')
            .eq('id', roomId)
            .single();
        return pedido?.numero ? `Pedido #${pedido.numero}` : 'Pedido';
    }
}

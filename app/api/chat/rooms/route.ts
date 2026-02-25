import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSupplierAccessOwnerUserId, userHasSupplierAccess } from '@/lib/supplierAccessServer';

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
 * GET /api/chat/rooms?recipientId=xxx&fornecedor_id=yyy?
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
        const fornecedorIdFilter = String(searchParams.get('fornecedor_id') || '').trim() || null;

        if (!recipientId) {
            return NextResponse.json({ error: 'recipientId é obrigatório' }, { status: 400 });
        }

        if (fornecedorIdFilter) {
            const hasSupplierAccess = await userHasSupplierAccess(supabaseAdmin, user.id, fornecedorIdFilter);
            if (!hasSupplierAccess) {
                return NextResponse.json({ error: 'Acesso negado ao fornecedor informado' }, { status: 403 });
            }
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

        const candidateRoomIds = Array.from(new Set([...myRoomIds, ...theirRoomIds])).filter(Boolean);
        const sharedRoomIds: string[] = [];

        for (const roomId of candidateRoomIds) {
            const isShared = await checkRoomBelongsToBothUsers(roomId, user.id, recipientId, fornecedorIdFilter);
            if (isShared) {
                sharedRoomIds.push(String(roomId));
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

async function checkRoomBelongsToBothUsers(
    roomId: string,
    userA: string,
    userB: string,
    fornecedorIdFilter?: string | null
): Promise<boolean> {
    if (!supabaseAdmin) return false;
    const requestedSupplierId = String(fornecedorIdFilter || '').trim() || null;

    if (roomId.includes('::')) {
        // Format: cotacao_id::fornecedor_id
        const [cotacaoId, fornecedorId] = roomId.split('::');
        if (!cotacaoId || !fornecedorId) return false;
        if (requestedSupplierId && fornecedorId !== requestedSupplierId) return false;

        // Check if cotação belongs to one user and fornecedor to the other
        const { data: cotacao } = await supabaseAdmin
            .from('cotacoes')
            .select('user_id')
            .eq('id', cotacaoId)
            .single();

        if (!cotacao) return false;
        const supplierUserId = await getSupplierAccessOwnerUserId(supabaseAdmin, fornecedorId);
        if (!supplierUserId) return false;

        const participants = [cotacao.user_id, supplierUserId];
        return participants.includes(userA) && participants.includes(userB);
    }

    // Prefer pedido room resolution
    const { data: pedido } = await supabaseAdmin
        .from('pedidos')
        .select('user_id, fornecedor_id')
        .eq('id', roomId)
        .maybeSingle();

    if (pedido) {
        if (requestedSupplierId && pedido.fornecedor_id !== requestedSupplierId) return false;

        const supplierUserId = pedido.fornecedor_id
            ? await getSupplierAccessOwnerUserId(supabaseAdmin, pedido.fornecedor_id)
            : null;
        if (!supplierUserId) return false;

        const participants = [pedido.user_id, supplierUserId];
        return participants.includes(userA) && participants.includes(userB);
    }

    // Fallback: legacy room using cotacao_id only
    const { data: cotacao } = await supabaseAdmin
        .from('cotacoes')
        .select('user_id')
        .eq('id', roomId)
        .maybeSingle();

    if (!cotacao) return false;

    let propostasQuery = supabaseAdmin
        .from('propostas')
        .select('fornecedor_id')
        .eq('cotacao_id', roomId);

    if (requestedSupplierId) {
        propostasQuery = propostasQuery.eq('fornecedor_id', requestedSupplierId);
    }

    const { data: propostas } = await propostasQuery;
    if (!propostas || propostas.length === 0) return false;

    const participants = new Set<string>([cotacao.user_id]);
    for (const proposta of propostas) {
        const fornecedorId = (proposta as any)?.fornecedor_id;
        if (!fornecedorId) continue;
        const ownerUserId = await getSupplierAccessOwnerUserId(supabaseAdmin, fornecedorId);
        if (ownerUserId) {
            participants.add(ownerUserId);
        }
    }

    return participants.has(userA) && participants.has(userB);
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

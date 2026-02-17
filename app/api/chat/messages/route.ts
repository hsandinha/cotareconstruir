import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { analyzeChatMessage } from '@/lib/chatModeration';

async function getAuthUser(req: NextRequest) {
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

    if (!token || !supabaseAdmin) return null;

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

async function resolveChatAccess(roomId: string, userId: string) {
    if (!supabaseAdmin) return { allowed: false, recipientId: null as string | null, clienteId: null as string | null, fornecedorId: null as string | null, cotacaoId: null as string | null, pedidoId: null as string | null };

    if (roomId.includes('::')) {
        const [cotacaoIdRaw, fornecedorIdRaw] = roomId.split('::');
        const cotacaoId = String(cotacaoIdRaw || '').trim();
        const fornecedorId = String(fornecedorIdRaw || '').trim();

        if (!cotacaoId || !fornecedorId) {
            return { allowed: false, recipientId: null as string | null, clienteId: null as string | null, fornecedorId: null as string | null, cotacaoId: null as string | null, pedidoId: null as string | null };
        }

        const { data: cotacao } = await supabaseAdmin
            .from('cotacoes')
            .select('id, user_id')
            .eq('id', cotacaoId)
            .single();

        if (!cotacao) {
            return { allowed: false, recipientId: null as string | null, clienteId: null as string | null, fornecedorId: null as string | null, cotacaoId: null as string | null, pedidoId: null as string | null };
        }

        const { data: fornecedor } = await supabaseAdmin
            .from('fornecedores')
            .select('id, user_id')
            .eq('id', fornecedorId)
            .single();

        if (!fornecedor?.user_id) {
            return { allowed: false, recipientId: null as string | null, clienteId: null as string | null, fornecedorId: null as string | null, cotacaoId: null as string | null, pedidoId: null as string | null };
        }

        const { data: proposta } = await supabaseAdmin
            .from('propostas')
            .select('id')
            .eq('cotacao_id', cotacaoId)
            .eq('fornecedor_id', fornecedorId)
            .limit(1)
            .maybeSingle();

        if (!proposta) {
            return { allowed: false, recipientId: null as string | null, clienteId: null as string | null, fornecedorId: null as string | null, cotacaoId: null as string | null, pedidoId: null as string | null };
        }

        const isClient = userId === cotacao.user_id;
        const isSupplier = userId === fornecedor.user_id;

        if (!isClient && !isSupplier) {
            return { allowed: false, recipientId: null as string | null, clienteId: null as string | null, fornecedorId: null as string | null, cotacaoId: null as string | null, pedidoId: null as string | null };
        }

        return {
            allowed: true,
            recipientId: isClient ? fornecedor.user_id : cotacao.user_id,
            clienteId: cotacao.user_id,
            fornecedorId: fornecedor.id,
            cotacaoId: cotacao.id,
            pedidoId: null as string | null,
        };
    }

    const { data: pedido } = await supabaseAdmin
        .from('pedidos')
        .select('id, user_id, fornecedor_id, cotacao_id')
        .eq('id', roomId)
        .single();

    if (pedido) {
        const { data: fornecedor } = await supabaseAdmin
            .from('fornecedores')
            .select('id, user_id')
            .eq('id', pedido.fornecedor_id)
            .single();

        const clientId = pedido.user_id;
        const supplierUserId = fornecedor?.user_id || null;

        const isClient = userId === clientId;
        const isSupplier = !!supplierUserId && userId === supplierUserId;

        if (isClient || isSupplier) {
            return {
                allowed: true,
                recipientId: isClient ? supplierUserId : clientId,
                clienteId: clientId,
                fornecedorId: fornecedor?.id || null,
                cotacaoId: pedido.cotacao_id || null,
                pedidoId: pedido.id,
            };
        }

        return { allowed: false, recipientId: null as string | null, clienteId: null as string | null, fornecedorId: null as string | null, cotacaoId: null as string | null, pedidoId: null as string | null };
    }

    const { data: cotacao } = await supabaseAdmin
        .from('cotacoes')
        .select('id, user_id')
        .eq('id', roomId)
        .single();

    if (!cotacao) {
        return { allowed: false, recipientId: null as string | null, clienteId: null as string | null, fornecedorId: null as string | null, cotacaoId: null as string | null, pedidoId: null as string | null };
    }

    const isClient = cotacao.user_id === userId;

    const { data: fornecedorByUser } = await supabaseAdmin
        .from('fornecedores')
        .select('id, user_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();

    let isSupplierInQuotation = false;

    if (fornecedorByUser?.id) {
        const { data: proposta } = await supabaseAdmin
            .from('propostas')
            .select('id')
            .eq('cotacao_id', roomId)
            .eq('fornecedor_id', fornecedorByUser.id)
            .limit(1)
            .maybeSingle();

        isSupplierInQuotation = !!proposta;
    }

    if (!isClient && !isSupplierInQuotation) {
        return { allowed: false, recipientId: null as string | null, clienteId: null as string | null, fornecedorId: null as string | null, cotacaoId: null as string | null, pedidoId: null as string | null };
    }

    if (isClient) {
        const { data: supplierProposal } = await supabaseAdmin
            .from('propostas')
            .select('fornecedor_id')
            .eq('cotacao_id', roomId)
            .limit(1)
            .maybeSingle();

        if (supplierProposal?.fornecedor_id) {
            const { data: supplier } = await supabaseAdmin
                .from('fornecedores')
                .select('id, user_id')
                .eq('id', supplierProposal.fornecedor_id)
                .single();

            return { allowed: true, recipientId: supplier?.user_id || null, clienteId: cotacao.user_id, fornecedorId: supplier?.id || null, cotacaoId: cotacao.id, pedidoId: null as string | null };
        }

        return { allowed: true, recipientId: null as string | null, clienteId: cotacao.user_id, fornecedorId: null as string | null, cotacaoId: cotacao.id, pedidoId: null as string | null };
    }

    return { allowed: true, recipientId: cotacao.user_id, clienteId: cotacao.user_id, fornecedorId: fornecedorByUser?.id || null, cotacaoId: cotacao.id, pedidoId: null as string | null };
}

async function buildChatNotificationLink(recipientId: string, roomId: string, senderId?: string, senderName?: string) {
    if (!supabaseAdmin) return '/dashboard';

    const { data: recipientUser } = await supabaseAdmin
        .from('users')
        .select('role, roles')
        .eq('id', recipientId)
        .single();

    const roleList = Array.isArray(recipientUser?.roles) ? recipientUser.roles : [];
    const primaryRole = recipientUser?.role;
    const isSupplier = roleList.includes('fornecedor') || primaryRole === 'fornecedor';
    const isClient = roleList.includes('cliente') || primaryRole === 'cliente';

    const params = new URLSearchParams();
    params.set('chatRoom', roomId);
    if (senderId) params.set('senderId', senderId);
    if (senderName) params.set('senderName', senderName);

    if (roomId.includes('::')) {
        const [cotacaoId] = roomId.split('::');
        if (cotacaoId) {
            params.set('cotacaoId', cotacaoId);
        }
    } else if (roomId) {
        params.set('pedidoId', roomId);
    }

    if (isSupplier) {
        params.set('tab', 'vendas-cotacoes');
        return `/dashboard/fornecedor?${params.toString()}`;
    }

    if (isClient) {
        params.set('tab', 'pedidos');
        return `/dashboard/cliente?${params.toString()}`;
    }

    return '/dashboard';
}

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
        const roomId = String(searchParams.get('roomId') || '').trim();

        if (!roomId) {
            return NextResponse.json({ error: 'roomId é obrigatório' }, { status: 400 });
        }

        const access = await resolveChatAccess(roomId, user.id);
        if (!access.allowed) {
            return NextResponse.json({ error: 'Acesso negado ao chat' }, { status: 403 });
        }

        const { data, error } = await supabaseAdmin
            .from('mensagens')
            .select('id, sender_id, conteudo, created_at')
            .eq('chat_id', roomId)
            .order('created_at', { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: data || [] });
    } catch (error: any) {
        console.error('Erro GET chat/messages:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const body = await req.json();
        const roomId = String(body.roomId || '').trim();
        const text = String(body.text || '').trim();

        if (!roomId || !text) {
            return NextResponse.json({ error: 'roomId e text são obrigatórios' }, { status: 400 });
        }

        if (text.length > 2000) {
            return NextResponse.json({ error: 'Mensagem muito longa' }, { status: 400 });
        }

        const access = await resolveChatAccess(roomId, user.id);
        if (!access.allowed) {
            return NextResponse.json({ error: 'Acesso negado ao chat' }, { status: 403 });
        }

        const moderation = analyzeChatMessage(text);
        if (moderation.blocked) {
            const forwardedFor = req.headers.get('x-forwarded-for') || '';
            const ipAddress = forwardedFor.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
            const userAgent = req.headers.get('user-agent') || null;

            await supabaseAdmin
                .from('audit_logs')
                .insert({
                    user_id: user.id,
                    action: 'CHAT_MESSAGE_BLOCKED',
                    entity_type: 'chat_message',
                    entity_id: null,
                    details: {
                        roomId,
                        reasons: moderation.reasons,
                        contentPreview: text.slice(0, 160),
                    },
                    ip_address: ipAddress,
                    user_agent: userAgent,
                });

            return NextResponse.json({
                error: 'Mensagem bloqueada por política da plataforma',
                reasons: moderation.reasons,
            }, { status: 422 });
        }

        const { data: inserted, error } = await supabaseAdmin
            .from('mensagens')
            .insert({
                chat_id: roomId,
                sender_id: user.id,
                conteudo: text,
                tipo: 'texto',
                cliente_id: access.clienteId,
                fornecedor_id: access.fornecedorId,
                cotacao_id: access.cotacaoId,
                pedido_id: access.pedidoId,
            })
            .select('id, sender_id, conteudo, created_at')
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (access.recipientId) {
            // Resolve sender name for notification
            let senderName = '';
            const { data: senderData } = await supabaseAdmin
                .from('users')
                .select('nome, email')
                .eq('id', user.id)
                .single();
            senderName = senderData?.nome || senderData?.email || '';

            const link = await buildChatNotificationLink(access.recipientId, roomId, user.id, senderName);
            await supabaseAdmin
                .from('notificacoes')
                .insert({
                    user_id: access.recipientId,
                    titulo: 'Nova mensagem no chat',
                    mensagem: `Nova mensagem de ${senderName || 'um usuário'} em uma negociação.`,
                    tipo: 'info',
                    lida: false,
                    link
                });
        }

        return NextResponse.json({ success: true, data: inserted });
    } catch (error: any) {
        console.error('Erro POST chat/messages:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

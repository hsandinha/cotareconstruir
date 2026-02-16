import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const MAX_INVOICE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_INVOICE_TYPES = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
]);

function sanitizeFileName(name: string) {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
}

function computeExpectedDeliveryDate(pedido: any): Date | null {
    const explicitDate = pedido?.data_previsao_entrega ? new Date(pedido.data_previsao_entrega) : null;
    if (explicitDate && !Number.isNaN(explicitDate.getTime())) {
        return explicitDate;
    }

    const deliveryDays = Number(pedido?.endereco_entrega?.summary?.deliveryDays);
    const createdAt = pedido?.created_at ? new Date(pedido.created_at) : null;

    if (!createdAt || Number.isNaN(createdAt.getTime()) || !Number.isFinite(deliveryDays) || deliveryDays < 0) {
        return null;
    }

    const expected = new Date(createdAt);
    expected.setDate(expected.getDate() + deliveryDays);
    return expected;
}

function getClientStatusNotification(status: string, pedidoNumero: string) {
    if (status === 'confirmado') {
        return {
            titulo: 'Subpedido em faturamento',
            mensagem: `O subpedido #${pedidoNumero} entrou na etapa de faturamento.`,
            tipo: 'info'
        };
    }

    if (status === 'em_preparacao') {
        return {
            titulo: 'Subpedido em separação',
            mensagem: `O subpedido #${pedidoNumero} está em separação.`,
            tipo: 'info'
        };
    }

    if (status === 'enviado') {
        return {
            titulo: 'Subpedido em entrega',
            mensagem: `O subpedido #${pedidoNumero} saiu para entrega.`,
            tipo: 'info'
        };
    }

    if (status === 'entregue') {
        return {
            titulo: 'Subpedido entregue',
            mensagem: `O subpedido #${pedidoNumero} foi entregue.`,
            tipo: 'success'
        };
    }

    return null;
}

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '')
        || req.cookies.get('authToken')?.value
        || req.cookies.get('token')?.value
        || req.cookies.get('sb-access-token')?.value;
    if (!token || !supabaseAdmin) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

async function getFornecedorId(userId: string): Promise<string | null> {
    if (!supabaseAdmin) return null;

    // 1) Fonte principal: fornecedores.user_id
    const { data: fornecedorByUser } = await supabaseAdmin
        .from('fornecedores')
        .select('id')
        .eq('user_id', userId)
        .single();

    if (fornecedorByUser?.id) return fornecedorByUser.id;

    // 2) Fallback legado
    const { data: userData } = await supabaseAdmin
        .from('users')
        .select('fornecedor_id')
        .eq('id', userId)
        .single();

    return userData?.fornecedor_id || null;
}

// GET: Load pedidos for the authenticated fornecedor (bypasses RLS)
export async function GET(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const fornecedorId = await getFornecedorId(user.id);

        if (!fornecedorId) {
            return NextResponse.json({ data: [], fornecedor_id: null });
        }

        const { data, error } = await supabaseAdmin
            .from('pedidos')
            .select('*, pedido_itens(*)')
            .eq('fornecedor_id', fornecedorId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao carregar pedidos:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Enrich with obra and cotação data
        const pedidos = data || [];

        if (pedidos.length > 0) {
            // Get unique obra_ids and cotacao_ids
            const obraIds = [...new Set(pedidos.map(p => p.obra_id).filter(Boolean))];
            const cotacaoIds = [...new Set(pedidos.map(p => p.cotacao_id).filter(Boolean))];
            const userIds = [...new Set(pedidos.map(p => p.user_id).filter(Boolean))];

            const [obrasRes, cotacoesRes, usersRes] = await Promise.all([
                obraIds.length > 0
                    ? supabaseAdmin.from('obras').select('id, nome, bairro, cidade, estado, endereco').in('id', obraIds)
                    : Promise.resolve({ data: [] }),
                cotacaoIds.length > 0
                    ? supabaseAdmin.from('cotacoes').select('id, status, data_validade').in('id', cotacaoIds)
                    : Promise.resolve({ data: [] }),
                userIds.length > 0
                    ? supabaseAdmin.from('users').select('id, nome, email').in('id', userIds)
                    : Promise.resolve({ data: [] }),
            ]);

            const obraMap = new Map((obrasRes.data || []).map(o => [o.id, o]));
            const cotacaoMap = new Map((cotacoesRes.data || []).map(c => [c.id, c]));
            const userMap = new Map((usersRes.data || []).map(u => [u.id, u]));

            // Enrich pedidos
            for (const pedido of pedidos) {
                (pedido as any)._obra = obraMap.get(pedido.obra_id) || null;
                (pedido as any)._cotacao = cotacaoMap.get(pedido.cotacao_id) || null;
                (pedido as any)._cliente = userMap.get(pedido.user_id) || null;
            }
        }

        return NextResponse.json({ data: pedidos, fornecedor_id: fornecedorId });
    } catch (error: any) {
        console.error('Erro na API pedidos:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

// POST: Update pedido status
export async function POST(req: NextRequest) {
    try {
        const user = await getAuthUser(req);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const fornecedorId = await getFornecedorId(user.id);
        if (!fornecedorId) {
            return NextResponse.json({ error: 'Fornecedor não encontrado' }, { status: 404 });
        }

        const body = await req.json();
        const { action, pedido_id, status, summary_update, invoice_file } = body;

        if (action === 'update_status') {
            if (!pedido_id || !status) {
                return NextResponse.json({ error: 'pedido_id e status são obrigatórios' }, { status: 400 });
            }

            // Verify ownership
            const { data: pedido } = await supabaseAdmin
                .from('pedidos')
                .select('id, fornecedor_id, user_id, numero, status, created_at, data_previsao_entrega, endereco_entrega')
                .eq('id', pedido_id)
                .eq('fornecedor_id', fornecedorId)
                .single();

            if (!pedido) {
                return NextResponse.json({ error: 'Pedido não encontrado ou acesso negado' }, { status: 404 });
            }

            const updateData: any = {
                status,
                updated_at: new Date().toISOString(),
            };

            let computedSummaryUpdate: Record<string, any> = {
                ...(summary_update && typeof summary_update === 'object' ? summary_update : {}),
            };

            if (invoice_file && typeof invoice_file === 'object') {
                const fileName = String(invoice_file.fileName || '').trim();
                const fileType = String(invoice_file.fileType || 'application/octet-stream').trim();
                const fileBase64 = String(invoice_file.fileBase64 || '').trim();
                const fileSize = Number(invoice_file.fileSize) || 0;

                if (!fileName || !fileBase64) {
                    return NextResponse.json({ error: 'Arquivo da nota fiscal inválido' }, { status: 400 });
                }

                if (!ALLOWED_INVOICE_TYPES.has(fileType)) {
                    return NextResponse.json({
                        error: 'Formato inválido. Envie PDF, JPG ou PNG.'
                    }, { status: 400 });
                }

                if (fileSize <= 0 || fileSize > MAX_INVOICE_SIZE_BYTES) {
                    return NextResponse.json({
                        error: 'Arquivo excede o limite de 10MB.'
                    }, { status: 400 });
                }

                const bucketName = process.env.SUPABASE_INVOICES_BUCKET || 'invoices';
                const safeName = sanitizeFileName(fileName);
                const storagePath = `fornecedor-${fornecedorId}/pedido-${pedido_id}/${Date.now()}-${safeName}`;

                const { data: buckets } = await supabaseAdmin.storage.listBuckets();
                const bucketExists = (buckets || []).some((bucket: any) => bucket.name === bucketName);
                if (!bucketExists) {
                    await supabaseAdmin.storage.createBucket(bucketName, { public: false });
                }

                const fileBuffer = Buffer.from(fileBase64, 'base64');
                const uploadResult = await supabaseAdmin
                    .storage
                    .from(bucketName)
                    .upload(storagePath, fileBuffer, {
                        contentType: fileType,
                        upsert: true,
                    });

                if (uploadResult.error) {
                    console.error('Erro ao subir nota fiscal:', uploadResult.error);
                    return NextResponse.json({ error: 'Falha ao fazer upload da nota fiscal' }, { status: 500 });
                }

                const publicUrlData = supabaseAdmin.storage.from(bucketName).getPublicUrl(storagePath);

                computedSummaryUpdate = {
                    ...computedSummaryUpdate,
                    invoiceAttachment: {
                        fileName,
                        fileType,
                        fileSize: fileSize || fileBuffer.length,
                        storageBucket: bucketName,
                        storagePath,
                        publicUrl: publicUrlData?.data?.publicUrl || null,
                        uploadedAt: new Date().toISOString(),
                    }
                };
            }

            if (Object.keys(computedSummaryUpdate).length > 0) {
                const currentEndereco = (pedido as any)?.endereco_entrega || {};
                const currentSummary = currentEndereco.summary || {};

                updateData.endereco_entrega = {
                    ...currentEndereco,
                    summary: {
                        ...currentSummary,
                        ...computedSummaryUpdate
                    }
                };
            }

            if (status === 'confirmado') {
                updateData.data_confirmacao = new Date().toISOString();
            }

            if (status === 'entregue') {
                updateData.data_entrega = new Date().toISOString();
            }

            const { data, error } = await supabaseAdmin
                .from('pedidos')
                .update(updateData)
                .eq('id', pedido_id)
                .select()
                .single();

            if (error) {
                console.error('Erro ao atualizar pedido:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            const pedidoNumero = String((pedido as any)?.numero || (pedido_id || '').slice(0, 8));
            const statusNotification = getClientStatusNotification(status, pedidoNumero);

            if (statusNotification) {
                const pedidoLink = `/dashboard/cliente?tab=pedidos&pedidoId=${encodeURIComponent(pedido_id)}`;
                await supabaseAdmin
                    .from('notificacoes')
                    .insert({
                        user_id: (pedido as any).user_id,
                        titulo: statusNotification.titulo,
                        mensagem: statusNotification.mensagem,
                        tipo: statusNotification.tipo,
                        lida: false,
                        link: pedidoLink
                    });
            }

            const expectedDeliveryDate = computeExpectedDeliveryDate(pedido);
            const deliveredAt = status === 'entregue' ? new Date() : null;
            const now = new Date();
            const isDelayedOpenOrder = status !== 'entregue' && expectedDeliveryDate && now.getTime() > expectedDeliveryDate.getTime();
            const isDeliveredLate = status === 'entregue' && expectedDeliveryDate && deliveredAt && deliveredAt.getTime() > expectedDeliveryDate.getTime();

            if (isDelayedOpenOrder || isDeliveredLate) {
                const atrasoMsg = isDeliveredLate
                    ? `O subpedido #${pedidoNumero} foi entregue com atraso.`
                    : `O subpedido #${pedidoNumero} está com atraso na entrega.`;

                await supabaseAdmin
                    .from('notificacoes')
                    .insert({
                        user_id: (pedido as any).user_id,
                        titulo: 'Alerta de atraso no subpedido',
                        mensagem: atrasoMsg,
                        tipo: 'warning',
                        lida: false,
                        link: `/dashboard/cliente?tab=pedidos&pedidoId=${encodeURIComponent(pedido_id)}`
                    });
            }

            return NextResponse.json({ success: true, data });
        }

        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    } catch (error: any) {
        console.error('Erro na API pedidos:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

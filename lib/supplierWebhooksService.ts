import { createHash, randomBytes } from 'crypto';
import { SupplierApiError } from '@/lib/supplierApiErrors';

export const SUPPLIER_WEBHOOK_EVENTS = [
    'quote.created',
    'quote.updated',
    'proposal.accepted',
    'proposal.rejected',
    'order.created',
    'order.status_changed',
    'stock.low',
    'stock.updated',
] as const;

const SUPPLIER_WEBHOOK_EVENT_SET = new Set<string>(SUPPLIER_WEBHOOK_EVENTS);

function hashSecret(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
}

function generateWebhookSecret() {
    const publicId = randomBytes(5).toString('base64url');
    const secret = `ccwhsec_${publicId}_${randomBytes(32).toString('base64url')}`;
    return {
        secret,
        secretPrefix: `ccwhsec_${publicId}`,
        secretHash: hashSecret(secret),
    };
}

function normalizeUrl(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) {
        throw new SupplierApiError(400, 'invalid_webhook_url', 'url é obrigatória');
    }

    let parsed: URL;
    try {
        parsed = new URL(value.trim());
    } catch {
        throw new SupplierApiError(400, 'invalid_webhook_url', 'url deve ser uma URL válida');
    }

    if (!['https:', 'http:'].includes(parsed.protocol)) {
        throw new SupplierApiError(400, 'invalid_webhook_url', 'url deve usar http ou https');
    }

    if (parsed.protocol === 'http:' && !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
        throw new SupplierApiError(400, 'invalid_webhook_url', 'use https em URLs públicas');
    }

    return parsed.toString();
}

function normalizeEvents(value: unknown) {
    if (!Array.isArray(value) || value.length === 0) {
        throw new SupplierApiError(400, 'invalid_webhook_events', 'events deve conter ao menos um evento');
    }

    const events = [...new Set(value.map((event) => String(event).trim()).filter(Boolean))];
    const invalid = events.filter((event) => !SUPPLIER_WEBHOOK_EVENT_SET.has(event));

    if (invalid.length > 0) {
        throw new SupplierApiError(400, 'invalid_webhook_events', `Eventos inválidos: ${invalid.join(', ')}`);
    }

    return events;
}

function publicWebhookFields(row: any) {
    return {
        id: row.id,
        fornecedor_id: row.fornecedor_id,
        url: row.url,
        description: row.description,
        events: row.events || [],
        secret_prefix: row.secret_prefix,
        ativo: row.ativo,
        last_delivery_at: row.last_delivery_at,
        last_delivery_status: row.last_delivery_status,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

export async function listSupplierWebhooks(
    supabase: any,
    params: {
        fornecedorId: string;
        ativo?: boolean | null;
        page: number;
        pageSize: number;
    }
) {
    const start = (params.page - 1) * params.pageSize;
    const end = start + params.pageSize - 1;

    let query = supabase
        .from('fornecedor_webhook_endpoints')
        .select('*', { count: 'exact' })
        .eq('fornecedor_id', params.fornecedorId)
        .order('created_at', { ascending: false })
        .range(start, end);

    if (typeof params.ativo === 'boolean') query = query.eq('ativo', params.ativo);

    const { data, error, count } = await query;
    if (error) throw error;

    return {
        data: (data || []).map(publicWebhookFields),
        events_disponiveis: SUPPLIER_WEBHOOK_EVENTS,
        page: params.page,
        page_size: params.pageSize,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / params.pageSize),
    };
}

export async function getSupplierWebhook(supabase: any, fornecedorId: string, webhookId: string) {
    const { data, error } = await supabase
        .from('fornecedor_webhook_endpoints')
        .select('*')
        .eq('id', webhookId)
        .eq('fornecedor_id', fornecedorId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new SupplierApiError(404, 'webhook_not_found', 'Webhook não encontrado');
    return publicWebhookFields(data);
}

export async function createSupplierWebhook(supabase: any, fornecedorId: string, body: any) {
    const generated = generateWebhookSecret();
    const payload = {
        fornecedor_id: fornecedorId,
        url: normalizeUrl(body?.url),
        description: body?.description ? String(body.description).trim() : null,
        events: normalizeEvents(body?.events),
        secret_hash: generated.secretHash,
        secret_prefix: generated.secretPrefix,
        ativo: typeof body?.ativo === 'boolean' ? body.ativo : true,
    };

    const { data, error } = await supabase
        .from('fornecedor_webhook_endpoints')
        .insert(payload)
        .select()
        .single();

    if (error) throw error;

    return {
        data: publicWebhookFields(data),
        secret: generated.secret,
    };
}

export async function updateSupplierWebhook(supabase: any, fornecedorId: string, webhookId: string, body: any) {
    await getSupplierWebhook(supabase, fornecedorId, webhookId);

    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (body?.url !== undefined) payload.url = normalizeUrl(body.url);
    if (body?.description !== undefined) payload.description = body.description ? String(body.description).trim() : null;
    if (body?.events !== undefined) payload.events = normalizeEvents(body.events);
    if (typeof body?.ativo === 'boolean') payload.ativo = body.ativo;

    const { data, error } = await supabase
        .from('fornecedor_webhook_endpoints')
        .update(payload)
        .eq('id', webhookId)
        .eq('fornecedor_id', fornecedorId)
        .select()
        .single();

    if (error) throw error;
    return publicWebhookFields(data);
}

export async function rotateSupplierWebhookSecret(supabase: any, fornecedorId: string, webhookId: string) {
    await getSupplierWebhook(supabase, fornecedorId, webhookId);
    const generated = generateWebhookSecret();

    const { data, error } = await supabase
        .from('fornecedor_webhook_endpoints')
        .update({
            secret_hash: generated.secretHash,
            secret_prefix: generated.secretPrefix,
            updated_at: new Date().toISOString(),
        })
        .eq('id', webhookId)
        .eq('fornecedor_id', fornecedorId)
        .select()
        .single();

    if (error) throw error;
    return {
        data: publicWebhookFields(data),
        secret: generated.secret,
    };
}

export async function deleteSupplierWebhook(supabase: any, fornecedorId: string, webhookId: string) {
    await getSupplierWebhook(supabase, fornecedorId, webhookId);

    const { data, error } = await supabase
        .from('fornecedor_webhook_endpoints')
        .update({ ativo: false, updated_at: new Date().toISOString() })
        .eq('id', webhookId)
        .eq('fornecedor_id', fornecedorId)
        .select()
        .single();

    if (error) throw error;
    return publicWebhookFields(data);
}

export async function buildSupplierWebhookTestPayload(supabase: any, fornecedorId: string, webhookId: string) {
    const webhook = await getSupplierWebhook(supabase, fornecedorId, webhookId);
    const event = webhook.events?.[0] || 'order.status_changed';

    return {
        webhook,
        test_payload: {
            id: `evt_test_${Date.now()}`,
            event,
            created_at: new Date().toISOString(),
            fornecedor_id: fornecedorId,
            data: {
                message: 'Payload de teste. Nenhuma entrega externa foi executada por este endpoint.',
            },
        },
        signature_header: 'X-Cotare-Signature: t=<timestamp>,v1=<hmac_sha256>',
    };
}

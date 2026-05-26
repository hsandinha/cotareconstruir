import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { logServerAuditEvent } from '@/lib/serverAudit';
import {
    createSupplierWebhook,
    listSupplierWebhooks,
} from '@/lib/supplierWebhooksService';
import {
    parseBooleanQuery,
    parsePageSize,
    parsePositivePage,
    supplierApiErrorResponse,
} from '@/lib/supplierApiErrors';

export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'webhooks:read' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { searchParams } = new URL(request.url);
        const result = await listSupplierWebhooks(supabaseAdmin, {
            fornecedorId: auth.fornecedorId,
            ativo: parseBooleanQuery(searchParams.get('ativo')),
            page: parsePositivePage(searchParams.get('page')),
            pageSize: parsePageSize(searchParams.get('page_size'), 50, 200),
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de webhooks');
    }
}

export async function POST(request: NextRequest) {
    let auth: Awaited<ReturnType<typeof authenticateSupplierApiKey>> | null = null;

    try {
        auth = await authenticateSupplierApiKey(request, { requiredScope: 'webhooks:write' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const body = await request.json().catch(() => null);
        const result = await createSupplierWebhook(supabaseAdmin, auth.fornecedorId, body);

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_API_WEBHOOK_CREATED',
            entityType: 'fornecedor_webhook_endpoint',
            entityId: result.data.id,
            details: { apiKeyId: auth.keyId, fornecedorId: auth.fornecedorId, events: result.data.events },
            request,
        });

        return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de webhooks');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

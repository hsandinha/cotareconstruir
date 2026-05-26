import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { logServerAuditEvent } from '@/lib/serverAudit';
import {
    deleteSupplierWebhook,
    getSupplierWebhook,
    rotateSupplierWebhookSecret,
    updateSupplierWebhook,
} from '@/lib/supplierWebhooksService';
import { assertUuid, supplierApiErrorResponse } from '@/lib/supplierApiErrors';

type RouteContext = { params: Promise<{ webhookId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'webhooks:read' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { webhookId } = await context.params;
        const data = await getSupplierWebhook(supabaseAdmin, auth.fornecedorId, assertUuid(webhookId, 'webhookId'));
        return NextResponse.json({ data });
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de webhooks');
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    let auth: Awaited<ReturnType<typeof authenticateSupplierApiKey>> | null = null;

    try {
        auth = await authenticateSupplierApiKey(request, { requiredScope: 'webhooks:write' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { webhookId } = await context.params;
        const body = await request.json().catch(() => null);
        const result = body?.rotate_secret === true
            ? await rotateSupplierWebhookSecret(supabaseAdmin, auth.fornecedorId, assertUuid(webhookId, 'webhookId'))
            : { data: await updateSupplierWebhook(supabaseAdmin, auth.fornecedorId, assertUuid(webhookId, 'webhookId'), body) };

        await logServerAuditEvent(supabaseAdmin, {
            action: body?.rotate_secret === true ? 'SUPPLIER_API_WEBHOOK_SECRET_ROTATED' : 'SUPPLIER_API_WEBHOOK_UPDATED',
            entityType: 'fornecedor_webhook_endpoint',
            entityId: result.data.id,
            details: { apiKeyId: auth.keyId, fornecedorId: auth.fornecedorId },
            request,
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de webhooks');
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    let auth: Awaited<ReturnType<typeof authenticateSupplierApiKey>> | null = null;

    try {
        auth = await authenticateSupplierApiKey(request, { requiredScope: 'webhooks:write' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { webhookId } = await context.params;
        const data = await deleteSupplierWebhook(supabaseAdmin, auth.fornecedorId, assertUuid(webhookId, 'webhookId'));

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_API_WEBHOOK_DISABLED',
            entityType: 'fornecedor_webhook_endpoint',
            entityId: data.id,
            details: { apiKeyId: auth.keyId, fornecedorId: auth.fornecedorId },
            request,
        });

        return NextResponse.json({ data });
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de webhooks');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

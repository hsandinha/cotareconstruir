import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { buildSupplierWebhookTestPayload } from '@/lib/supplierWebhooksService';
import { assertUuid, supplierApiErrorResponse } from '@/lib/supplierApiErrors';

type RouteContext = { params: Promise<{ webhookId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'webhooks:write' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { webhookId } = await context.params;
        const result = await buildSupplierWebhookTestPayload(supabaseAdmin, auth.fornecedorId, assertUuid(webhookId, 'webhookId'));
        return NextResponse.json(result);
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de webhooks');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

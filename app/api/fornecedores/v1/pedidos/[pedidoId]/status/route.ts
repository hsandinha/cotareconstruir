import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { logServerAuditEvent } from '@/lib/serverAudit';
import { updateSupplierOrderStatus } from '@/lib/supplierCommerceService';
import { assertUuid, supplierApiErrorResponse } from '@/lib/supplierApiErrors';

type RouteContext = { params: Promise<{ pedidoId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
    let auth: Awaited<ReturnType<typeof authenticateSupplierApiKey>> | null = null;

    try {
        auth = await authenticateSupplierApiKey(request, { requiredScope: 'orders:write' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { pedidoId } = await context.params;
        const body = await request.json().catch(() => null);
        const data = await updateSupplierOrderStatus(supabaseAdmin, {
            fornecedorId: auth.fornecedorId,
            pedidoId: assertUuid(pedidoId, 'pedidoId'),
            status: body?.status,
            observacoes: body?.observacoes === undefined ? undefined : (body.observacoes ? String(body.observacoes) : null),
            trackingUrl: body?.tracking_url ? String(body.tracking_url) : null,
            trackingCode: body?.tracking_code ? String(body.tracking_code) : null,
            dataPrevisaoEntrega: body?.data_previsao_entrega ? String(body.data_previsao_entrega) : null,
        });

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_API_ORDER_STATUS_UPDATED',
            entityType: 'pedido',
            entityId: data.id,
            details: {
                apiKeyId: auth.keyId,
                fornecedorId: auth.fornecedorId,
                status: data.status,
            },
            request,
        });

        return NextResponse.json({ data });
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de pedidos');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

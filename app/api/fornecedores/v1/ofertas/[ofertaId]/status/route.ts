import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { logServerAuditEvent } from '@/lib/serverAudit';
import { setSupplierOfferStatus } from '@/lib/supplierOffersService';
import { SupplierApiError, assertUuid, supplierApiErrorResponse } from '@/lib/supplierApiErrors';

type RouteContext = { params: Promise<{ ofertaId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
    let auth: Awaited<ReturnType<typeof authenticateSupplierApiKey>> | null = null;

    try {
        auth = await authenticateSupplierApiKey(request, { requiredScope: 'offers:write' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { ofertaId } = await context.params;
        const body = await request.json().catch(() => null);
        if (typeof body?.ativo !== 'boolean') {
            throw new SupplierApiError(400, 'invalid_offer_status', 'ativo deve ser booleano');
        }

        const data = await setSupplierOfferStatus(supabaseAdmin, auth.fornecedorId, assertUuid(ofertaId, 'ofertaId'), body.ativo);

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_API_OFFER_STATUS_UPDATED',
            entityType: 'oferta',
            entityId: data.id,
            details: { apiKeyId: auth.keyId, fornecedorId: auth.fornecedorId, ativo: data.ativo },
            request,
        });

        return NextResponse.json({ data });
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de ofertas');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

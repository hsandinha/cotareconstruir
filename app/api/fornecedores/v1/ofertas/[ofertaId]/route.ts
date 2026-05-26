import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { logServerAuditEvent } from '@/lib/serverAudit';
import {
    deleteSupplierOffer,
    getSupplierOffer,
    updateSupplierOffer,
} from '@/lib/supplierOffersService';
import { assertUuid, supplierApiErrorResponse } from '@/lib/supplierApiErrors';

type RouteContext = { params: Promise<{ ofertaId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'offers:read' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { ofertaId } = await context.params;
        const data = await getSupplierOffer(supabaseAdmin, auth.fornecedorId, assertUuid(ofertaId, 'ofertaId'));
        return NextResponse.json({ data });
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de ofertas');
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    let auth: Awaited<ReturnType<typeof authenticateSupplierApiKey>> | null = null;

    try {
        auth = await authenticateSupplierApiKey(request, { requiredScope: 'offers:write' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { ofertaId } = await context.params;
        const body = await request.json().catch(() => null);
        const data = await updateSupplierOffer(supabaseAdmin, auth.fornecedorId, assertUuid(ofertaId, 'ofertaId'), body);

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_API_OFFER_UPDATED',
            entityType: 'oferta',
            entityId: data.id,
            details: { apiKeyId: auth.keyId, fornecedorId: auth.fornecedorId },
            request,
        });

        return NextResponse.json({ data });
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de ofertas');
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    let auth: Awaited<ReturnType<typeof authenticateSupplierApiKey>> | null = null;

    try {
        auth = await authenticateSupplierApiKey(request, { requiredScope: 'offers:write' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { ofertaId } = await context.params;
        const data = await deleteSupplierOffer(supabaseAdmin, auth.fornecedorId, assertUuid(ofertaId, 'ofertaId'));

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_API_OFFER_DELETED',
            entityType: 'oferta',
            entityId: data.id,
            details: { apiKeyId: auth.keyId, fornecedorId: auth.fornecedorId },
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

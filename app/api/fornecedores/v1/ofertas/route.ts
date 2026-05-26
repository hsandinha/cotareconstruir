import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { logServerAuditEvent } from '@/lib/serverAudit';
import {
    createSupplierOffer,
    listSupplierOffers,
} from '@/lib/supplierOffersService';
import {
    parseBooleanQuery,
    parsePageSize,
    parsePositivePage,
    supplierApiErrorResponse,
} from '@/lib/supplierApiErrors';

export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'offers:read' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { searchParams } = new URL(request.url);
        const result = await listSupplierOffers(supabaseAdmin, {
            fornecedorId: auth.fornecedorId,
            ativo: parseBooleanQuery(searchParams.get('ativo')),
            page: parsePositivePage(searchParams.get('page')),
            pageSize: parsePageSize(searchParams.get('page_size')),
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de ofertas');
    }
}

export async function POST(request: NextRequest) {
    let auth: Awaited<ReturnType<typeof authenticateSupplierApiKey>> | null = null;

    try {
        auth = await authenticateSupplierApiKey(request, { requiredScope: 'offers:write' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const body = await request.json().catch(() => null);
        const data = await createSupplierOffer(supabaseAdmin, auth.fornecedorId, body);

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_API_OFFER_CREATED',
            entityType: 'oferta',
            entityId: data.id,
            details: { apiKeyId: auth.keyId, fornecedorId: auth.fornecedorId },
            request,
        });

        return NextResponse.json({ data }, { status: 201 });
    } catch (error: any) {
        if (supabaseAdmin && auth) {
            await logServerAuditEvent(supabaseAdmin, {
                action: 'SUPPLIER_API_OFFER_CREATE_FAILED',
                entityType: 'fornecedor',
                entityId: auth.fornecedorId,
                details: { apiKeyId: auth.keyId, code: error?.code, error: error?.message },
                request,
            });
        }
        return supplierApiErrorResponse(error, 'Erro na API pública de ofertas');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

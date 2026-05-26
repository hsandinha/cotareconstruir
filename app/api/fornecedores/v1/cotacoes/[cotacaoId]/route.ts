import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { getSupplierQuote } from '@/lib/supplierCommerceService';
import { assertUuid, supplierApiErrorResponse } from '@/lib/supplierApiErrors';

type RouteContext = { params: Promise<{ cotacaoId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'quotes:read' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { cotacaoId } = await context.params;
        const data = await getSupplierQuote(supabaseAdmin, auth.fornecedorId, assertUuid(cotacaoId, 'cotacaoId'));
        return NextResponse.json({ data });
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de cotações');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { getSupplierStock } from '@/lib/supplierStockService';
import { assertUuid, supplierApiErrorResponse } from '@/lib/supplierApiErrors';

type RouteContext = { params: Promise<{ materialId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'stock:read' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { materialId } = await context.params;
        const data = await getSupplierStock(supabaseAdmin, auth.fornecedorId, assertUuid(materialId, 'materialId'));
        return NextResponse.json({ data });
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de estoques');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

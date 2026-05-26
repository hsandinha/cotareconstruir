import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { getSupplierOrder } from '@/lib/supplierCommerceService';
import { assertUuid, supplierApiErrorResponse } from '@/lib/supplierApiErrors';

type RouteContext = { params: Promise<{ pedidoId: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'orders:read' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { pedidoId } = await context.params;
        const data = await getSupplierOrder(supabaseAdmin, auth.fornecedorId, assertUuid(pedidoId, 'pedidoId'));
        return NextResponse.json({ data });
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de pedidos');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

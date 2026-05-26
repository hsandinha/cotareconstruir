import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { listSupplierQuotes } from '@/lib/supplierCommerceService';
import {
    SupplierApiError,
    parsePageSize,
    parsePositivePage,
    supplierApiErrorResponse,
} from '@/lib/supplierApiErrors';

export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'quotes:read' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { searchParams } = new URL(request.url);
        const updatedSince = searchParams.get('updated_since');
        if (updatedSince && Number.isNaN(new Date(updatedSince).getTime())) {
            throw new SupplierApiError(400, 'invalid_updated_since', 'updated_since deve ser uma data ISO válida');
        }

        const result = await listSupplierQuotes(supabaseAdmin, {
            fornecedorId: auth.fornecedorId,
            status: searchParams.get('status'),
            updatedSince,
            page: parsePositivePage(searchParams.get('page')),
            pageSize: parsePageSize(searchParams.get('page_size'), 50, 200),
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de cotações');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateSupplierApiKey, SupplierApiAuthError } from '@/lib/supplierApiAuth';
import { listSupplierCatalogMaterials } from '@/lib/supplierMaterialsService';

function errorResponse(error: any) {
    if (error instanceof SupplierApiAuthError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    console.error('Erro na API pública de catálogo de materiais:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
}

export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'materials:read' });
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const result = await listSupplierCatalogMaterials(supabaseAdmin, {
            fornecedorId: auth.fornecedorId,
            q: searchParams.get('q'),
            grupoId: searchParams.get('grupo_id'),
            page: searchParams.get('page'),
            pageSize: searchParams.get('page_size'),
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return errorResponse(error);
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

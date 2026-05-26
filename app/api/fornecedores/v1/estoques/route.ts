import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { logServerAuditEvent } from '@/lib/serverAudit';
import {
    listSupplierStocks,
    updateSupplierStocks,
} from '@/lib/supplierStockService';
import {
    parseBooleanQuery,
    parsePageSize,
    parsePositivePage,
    supplierApiErrorResponse,
} from '@/lib/supplierApiErrors';

export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'stock:read' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { searchParams } = new URL(request.url);
        const result = await listSupplierStocks(supabaseAdmin, {
            fornecedorId: auth.fornecedorId,
            ativo: parseBooleanQuery(searchParams.get('ativo')),
            belowMinimum: parseBooleanQuery(searchParams.get('abaixo_minimo')),
            page: parsePositivePage(searchParams.get('page')),
            pageSize: parsePageSize(searchParams.get('page_size')),
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de estoques');
    }
}

export async function PUT(request: NextRequest) {
    let auth: Awaited<ReturnType<typeof authenticateSupplierApiKey>> | null = null;

    try {
        auth = await authenticateSupplierApiKey(request, { requiredScope: 'stock:write' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const body = await request.json().catch(() => null);
        const result = await updateSupplierStocks(supabaseAdmin, {
            fornecedorId: auth.fornecedorId,
            items: Array.isArray(body?.items) ? body.items : [],
            dryRun: Boolean(body?.dry_run),
        });

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_API_STOCK_BULK_UPSERT',
            entityType: 'fornecedor',
            entityId: auth.fornecedorId,
            details: {
                apiKeyId: auth.keyId,
                dryRun: result.dry_run,
                acceptedCount: result.accepted_count,
                rejectedCount: result.rejected_count,
            },
            request,
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de estoques');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

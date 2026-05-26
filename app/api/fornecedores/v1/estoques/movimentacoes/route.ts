import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { logServerAuditEvent } from '@/lib/serverAudit';
import {
    createSupplierStockMovements,
    listSupplierStockMovements,
} from '@/lib/supplierStockService';
import {
    SupplierApiError,
    UUID_RE,
    parsePageSize,
    parsePositivePage,
    supplierApiErrorResponse,
} from '@/lib/supplierApiErrors';

export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'stock:read' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { searchParams } = new URL(request.url);
        const materialId = searchParams.get('material_id');
        const createdSince = searchParams.get('created_since');

        if (materialId && !UUID_RE.test(materialId)) {
            throw new SupplierApiError(400, 'invalid_uuid', 'material_id deve ser um UUID válido');
        }
        if (createdSince && Number.isNaN(new Date(createdSince).getTime())) {
            throw new SupplierApiError(400, 'invalid_created_since', 'created_since deve ser uma data ISO válida');
        }

        const result = await listSupplierStockMovements(supabaseAdmin, {
            fornecedorId: auth.fornecedorId,
            materialId,
            tipo: searchParams.get('tipo'),
            createdSince,
            page: parsePositivePage(searchParams.get('page')),
            pageSize: parsePageSize(searchParams.get('page_size')),
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return supplierApiErrorResponse(error, 'Erro na API pública de movimentações de estoque');
    }
}

export async function POST(request: NextRequest) {
    let auth: Awaited<ReturnType<typeof authenticateSupplierApiKey>> | null = null;

    try {
        auth = await authenticateSupplierApiKey(request, { requiredScope: 'stock:write' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const body = await request.json().catch(() => null);
        const result = await createSupplierStockMovements(supabaseAdmin, {
            fornecedorId: auth.fornecedorId,
            movements: Array.isArray(body?.movements) ? body.movements : [],
            dryRun: Boolean(body?.dry_run),
        });

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_API_STOCK_MOVEMENTS',
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
        return supplierApiErrorResponse(error, 'Erro na API pública de movimentações de estoque');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

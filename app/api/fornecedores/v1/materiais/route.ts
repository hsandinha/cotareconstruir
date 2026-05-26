import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { authenticateSupplierApiKey, SupplierApiAuthError } from '@/lib/supplierApiAuth';
import {
    listSupplierConfiguredMaterials,
    SupplierMaterialsServiceError,
    upsertSupplierMaterials,
} from '@/lib/supplierMaterialsService';
import { logServerAuditEvent } from '@/lib/serverAudit';

function parseAtivo(value: string | null): boolean | null {
    if (value === null || value === '') return null;
    const normalized = value.toLowerCase();
    if (['1', 'true', 'ativo', 'sim'].includes(normalized)) return true;
    if (['0', 'false', 'inativo', 'nao', 'não'].includes(normalized)) return false;
    return null;
}

function errorResponse(error: any) {
    if (error instanceof SupplierApiAuthError || error instanceof SupplierMaterialsServiceError) {
        return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }

    console.error('Erro na API pública de materiais do fornecedor:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
}

export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateSupplierApiKey(request, { requiredScope: 'materials:read' });
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const { searchParams } = new URL(request.url);
        const updatedSince = searchParams.get('updated_since');
        if (updatedSince && Number.isNaN(new Date(updatedSince).getTime())) {
            return NextResponse.json({ error: 'updated_since deve ser uma data ISO válida', code: 'invalid_updated_since' }, { status: 400 });
        }

        const result = await listSupplierConfiguredMaterials(supabaseAdmin, {
            fornecedorId: auth.fornecedorId,
            ativo: parseAtivo(searchParams.get('ativo')),
            updatedSince,
            page: searchParams.get('page'),
            pageSize: searchParams.get('page_size'),
        });

        return NextResponse.json(result);
    } catch (error: any) {
        return errorResponse(error);
    }
}

export async function PUT(request: NextRequest) {
    let auth: Awaited<ReturnType<typeof authenticateSupplierApiKey>> | null = null;

    try {
        auth = await authenticateSupplierApiKey(request, { requiredScope: 'materials:write' });
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json({ error: 'Payload JSON inválido', code: 'invalid_json' }, { status: 400 });
        }

        const result = await upsertSupplierMaterials(supabaseAdmin, {
            fornecedorId: auth.fornecedorId,
            items: Array.isArray((body as any).items) ? (body as any).items : [],
            dryRun: Boolean((body as any).dry_run),
        });

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_MATERIALS_API_IMPORT',
            entityType: 'fornecedor',
            entityId: auth.fornecedorId,
            details: {
                apiKeyId: auth.keyId,
                dryRun: result.dry_run,
                acceptedCount: result.accepted_count,
                rejectedCount: result.rejected_count,
                deduplicatedCount: result.deduplicated_count,
            },
            request,
        });

        return NextResponse.json(result);
    } catch (error: any) {
        if (supabaseAdmin && auth) {
            await logServerAuditEvent(supabaseAdmin, {
                action: 'SUPPLIER_MATERIALS_API_IMPORT_FAILED',
                entityType: 'fornecedor',
                entityId: auth.fornecedorId,
                details: {
                    apiKeyId: auth.keyId,
                    error: error?.message || 'Erro desconhecido',
                    code: error?.code,
                },
                request,
            });
        }
        return errorResponse(error);
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

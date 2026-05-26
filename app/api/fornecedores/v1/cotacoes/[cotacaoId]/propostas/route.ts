import { NextRequest, NextResponse } from 'next/server';
import { authenticateSupplierApiKey } from '@/lib/supplierApiAuth';
import { supabaseAdmin } from '@/lib/supabase';
import { logServerAuditEvent } from '@/lib/serverAudit';
import { upsertSupplierProposal } from '@/lib/supplierCommerceService';
import { assertUuid, supplierApiErrorResponse } from '@/lib/supplierApiErrors';

type RouteContext = { params: Promise<{ cotacaoId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
    let auth: Awaited<ReturnType<typeof authenticateSupplierApiKey>> | null = null;

    try {
        auth = await authenticateSupplierApiKey(request, { requiredScope: 'proposals:write' });
        if (!supabaseAdmin) return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });

        const { cotacaoId } = await context.params;
        const body = await request.json().catch(() => null);
        const result = await upsertSupplierProposal(supabaseAdmin, {
            fornecedorId: auth.fornecedorId,
            cotacaoId: assertUuid(cotacaoId, 'cotacaoId'),
            body,
        });

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_API_PROPOSAL_UPSERTED',
            entityType: 'proposta',
            entityId: result.data.id,
            details: {
                apiKeyId: auth.keyId,
                fornecedorId: auth.fornecedorId,
                cotacaoId,
                valorTotal: result.valor_total,
            },
            request,
        });

        return NextResponse.json(result, { status: 201 });
    } catch (error: any) {
        if (supabaseAdmin && auth) {
            await logServerAuditEvent(supabaseAdmin, {
                action: 'SUPPLIER_API_PROPOSAL_UPSERT_FAILED',
                entityType: 'fornecedor',
                entityId: auth.fornecedorId,
                details: { apiKeyId: auth.keyId, code: error?.code, error: error?.message },
                request,
            });
        }
        return supplierApiErrorResponse(error, 'Erro na API pública de propostas');
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 204 });
}

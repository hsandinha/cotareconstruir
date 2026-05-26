import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { userHasSupplierAccess } from '@/lib/supplierAccessServer';
import { createSupplierApiKey } from '@/lib/supplierApiAuth';
import { logServerAuditEvent } from '@/lib/serverAudit';

function isSupplierApiKeysTableMissing(error: any) {
    const message = String(error?.message || '').toLowerCase();
    return error?.code === 'PGRST205' && message.includes('fornecedor_api_keys');
}

function supplierApiKeysMigrationPendingResponse() {
    return NextResponse.json({
        error: 'A tabela fornecedor_api_keys ainda não existe no banco. Aplique a migration supabase/migrations/20260228000000_fornecedor_api_keys.sql.',
        code: 'supplier_api_migration_pending',
        migration: 'supabase/migrations/20260228000000_fornecedor_api_keys.sql',
    }, { status: 503 });
}

async function getAuthUser(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    let token = authHeader?.replace('Bearer ', '');

    if (!token) {
        const supabaseAuthCookie = req.cookies
            .getAll()
            .find((cookie) => cookie.name.endsWith('-auth-token'))?.value;

        if (supabaseAuthCookie) {
            try {
                const parsed = JSON.parse(supabaseAuthCookie);
                if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
                    token = parsed[0];
                }
            } catch {
                // ignore
            }
        }
    }

    if (!token) {
        token = req.cookies.get('authToken')?.value
            || req.cookies.get('token')?.value
            || req.cookies.get('sb-access-token')?.value;
    }

    if (!token || !supabaseAdmin) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

async function requireSupplierAccess(req: NextRequest, fornecedorId: string) {
    const user = await getAuthUser(req);
    if (!user) {
        return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) };
    }

    if (!supabaseAdmin) {
        return { error: NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 }) };
    }

    const hasAccess = await userHasSupplierAccess(supabaseAdmin, user.id, fornecedorId);
    if (!hasAccess) {
        return { error: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) };
    }

    return { user };
}

export async function GET(req: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const { searchParams } = new URL(req.url);
        const fornecedorId = searchParams.get('fornecedor_id');
        if (!fornecedorId) {
            return NextResponse.json({ error: 'fornecedor_id é obrigatório' }, { status: 400 });
        }

        const auth = await requireSupplierAccess(req, fornecedorId);
        if ('error' in auth) return auth.error;

        const { data, error } = await supabaseAdmin
            .from('fornecedor_api_keys')
            .select('id, fornecedor_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at, updated_at')
            .eq('fornecedor_id', fornecedorId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Erro ao listar API keys:', error);
            if (isSupplierApiKeysTableMissing(error)) {
                return supplierApiKeysMigrationPendingResponse();
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ data: data || [] });
    } catch (error: any) {
        console.error('Erro na API supplier/api-keys GET:', error);
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const body = await req.json().catch(() => null);
        const fornecedorId = body?.fornecedor_id;
        const name = typeof body?.name === 'string' ? body.name.trim() : '';
        const expiresAt = body?.expires_at ? String(body.expires_at) : null;

        if (!fornecedorId) {
            return NextResponse.json({ error: 'fornecedor_id é obrigatório' }, { status: 400 });
        }

        if (!name) {
            return NextResponse.json({ error: 'Nome da chave é obrigatório' }, { status: 400 });
        }

        if (name.length > 120) {
            return NextResponse.json({ error: 'Nome da chave deve ter até 120 caracteres' }, { status: 400 });
        }

        if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
            return NextResponse.json({ error: 'expires_at deve ser uma data ISO válida' }, { status: 400 });
        }

        const auth = await requireSupplierAccess(req, fornecedorId);
        if ('error' in auth) return auth.error;

        const created = await createSupplierApiKey(supabaseAdmin, {
            fornecedorId,
            name,
            expiresAt,
            createdBy: auth.user.id,
        });

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_API_KEY_CREATED',
            userId: auth.user.id,
            entityType: 'fornecedor_api_key',
            entityId: created.data.id,
            details: {
                fornecedorId,
                keyPrefix: created.data.key_prefix,
            },
            request: req,
        });

        return NextResponse.json({
            success: true,
            api_key: created.apiKey,
            data: created.data,
        }, { status: 201 });
    } catch (error: any) {
        console.error('Erro na API supplier/api-keys POST:', error);
        if (isSupplierApiKeysTableMissing(error)) {
            return supplierApiKeysMigrationPendingResponse();
        }
        return NextResponse.json({ error: error.message || 'Erro interno do servidor' }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const body = await req.json().catch(() => null);
        const keyId = body?.id;
        const fornecedorId = body?.fornecedor_id;

        if (!keyId || !fornecedorId) {
            return NextResponse.json({ error: 'id e fornecedor_id são obrigatórios' }, { status: 400 });
        }

        const auth = await requireSupplierAccess(req, fornecedorId);
        if ('error' in auth) return auth.error;

        const { data: keyRow, error: fetchError } = await supabaseAdmin
            .from('fornecedor_api_keys')
            .select('id, fornecedor_id, key_prefix, revoked_at')
            .eq('id', keyId)
            .eq('fornecedor_id', fornecedorId)
            .maybeSingle();

        if (fetchError) {
            if (isSupplierApiKeysTableMissing(fetchError)) {
                return supplierApiKeysMigrationPendingResponse();
            }
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        if (!keyRow) {
            return NextResponse.json({ error: 'Chave não encontrada' }, { status: 404 });
        }

        const revokedAt = keyRow.revoked_at || new Date().toISOString();
        const { data, error } = await supabaseAdmin
            .from('fornecedor_api_keys')
            .update({ revoked_at: revokedAt, updated_at: new Date().toISOString() })
            .eq('id', keyId)
            .select('id, fornecedor_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at, updated_at')
            .single();

        if (error) {
            if (isSupplierApiKeysTableMissing(error)) {
                return supplierApiKeysMigrationPendingResponse();
            }
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        await logServerAuditEvent(supabaseAdmin, {
            action: 'SUPPLIER_API_KEY_REVOKED',
            userId: auth.user.id,
            entityType: 'fornecedor_api_key',
            entityId: keyId,
            details: {
                fornecedorId,
                keyPrefix: keyRow.key_prefix,
            },
            request: req,
        });

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Erro na API supplier/api-keys DELETE:', error);
        if (isSupplierApiKeysTableMissing(error)) {
            return supplierApiKeysMigrationPendingResponse();
        }
        return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
    }
}

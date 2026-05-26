import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '')
        || request.cookies.get('token')?.value
        || request.cookies.get('sb-access-token')?.value;

    if (!token) {
        return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
    }

    const { data: profile } = await supabase
        .from('users')
        .select('role, roles')
        .eq('id', user.id)
        .single();

    if (!profile || (profile.role !== 'admin' && !profile.roles?.includes('admin'))) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    return { user, supabase };
}

function parsePage(value: string | null) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parsePageSize(value: string | null) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return 50;
    return Math.min(parsed, 200);
}

function keyStatus(key: any) {
    if (key.revoked_at) return 'revoked';
    if (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) return 'expired';
    return 'active';
}

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

export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;

        const { supabase } = auth;
        const { searchParams } = new URL(request.url);
        const page = parsePage(searchParams.get('page'));
        const pageSize = parsePageSize(searchParams.get('page_size'));
        const status = searchParams.get('status');
        const q = (searchParams.get('q') || '').trim().toLowerCase();
        const start = (page - 1) * pageSize;
        const end = start + pageSize - 1;

        let query = supabase
            .from('fornecedor_api_keys')
            .select('id, fornecedor_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_by, created_at, updated_at', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (status === 'revoked') {
            query = query.not('revoked_at', 'is', null);
        } else if (status === 'active') {
            query = query.is('revoked_at', null);
        }

        const { data: allRows, error } = await query;
        if (error) {
            if (isSupplierApiKeysTableMissing(error)) {
                return supplierApiKeysMigrationPendingResponse();
            }
            throw error;
        }

        const now = Date.now();
        const statusFilteredRows = (allRows || []).filter((row: any) => {
            const computedStatus = keyStatus(row);
            if (status === 'expired' && computedStatus !== 'expired') return false;
            if (status === 'active' && computedStatus !== 'active') return false;
            return true;
        });

        const fornecedorIds = [...new Set(statusFilteredRows.map((row: any) => row.fornecedor_id).filter(Boolean))];
        const userIds = [...new Set(statusFilteredRows.map((row: any) => row.created_by).filter(Boolean))];

        const [fornecedoresRes, usersRes] = await Promise.all([
            fornecedorIds.length > 0
                ? supabase
                    .from('fornecedores')
                    .select('id, razao_social, nome_fantasia, cnpj, email, ativo, status')
                    .in('id', fornecedorIds)
                : Promise.resolve({ data: [], error: null }),
            userIds.length > 0
                ? supabase
                    .from('users')
                    .select('id, nome, email, role, roles')
                    .in('id', userIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        if (fornecedoresRes.error) throw fornecedoresRes.error;
        if (usersRes.error) throw usersRes.error;

        const fornecedorById = new Map((fornecedoresRes.data || []).map((row: any) => [row.id, row]));
        const userById = new Map((usersRes.data || []).map((row: any) => [row.id, row]));

        const enriched = statusFilteredRows.map((row: any) => ({
            ...row,
            status: keyStatus(row),
            is_expired: Boolean(row.expires_at && new Date(row.expires_at).getTime() <= now),
            fornecedor: fornecedorById.get(row.fornecedor_id) || null,
            created_by_user: row.created_by ? userById.get(row.created_by) || null : null,
        })).filter((row: any) => {
            if (!q) return true;
            return [
                row.name,
                row.key_prefix,
                row.fornecedor_id,
                row.created_by,
                row.fornecedor?.razao_social,
                row.fornecedor?.nome_fantasia,
                row.fornecedor?.cnpj,
                row.created_by_user?.nome,
                row.created_by_user?.email,
            ].some((value) => String(value || '').toLowerCase().includes(q));
        });

        const total = enriched.length;
        const paginated = enriched.slice(start, end + 1);
        const summary = {
            total_keys: enriched.length,
            active_keys: enriched.filter((row: any) => row.status === 'active').length,
            revoked_keys: enriched.filter((row: any) => row.status === 'revoked').length,
            expired_keys: enriched.filter((row: any) => row.status === 'expired').length,
            suppliers_with_keys: new Set(enriched.map((row: any) => row.fornecedor_id)).size,
        };

        return NextResponse.json({
            data: paginated,
            summary,
            page,
            page_size: pageSize,
            total,
            total_pages: Math.ceil(total / pageSize),
        });
    } catch (error: any) {
        console.error('Erro ao listar chaves de API de fornecedores:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const auth = await verifyAdmin(request);
        if (auth instanceof NextResponse) return auth;

        const { user, supabase } = auth;
        const body = await request.json().catch(() => null);
        const keyId = body?.id;

        if (!keyId) {
            return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 });
        }

        const { data: keyRow, error: fetchError } = await supabase
            .from('fornecedor_api_keys')
            .select('id, fornecedor_id, key_prefix, revoked_at')
            .eq('id', keyId)
            .maybeSingle();

        if (fetchError) {
            if (isSupplierApiKeysTableMissing(fetchError)) {
                return supplierApiKeysMigrationPendingResponse();
            }
            throw fetchError;
        }
        if (!keyRow) {
            return NextResponse.json({ error: 'Chave não encontrada' }, { status: 404 });
        }

        const revokedAt = keyRow.revoked_at || new Date().toISOString();
        const { data, error } = await supabase
            .from('fornecedor_api_keys')
            .update({ revoked_at: revokedAt, updated_at: new Date().toISOString() })
            .eq('id', keyId)
            .select('id, fornecedor_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_by, created_at, updated_at')
            .single();

        if (error) {
            if (isSupplierApiKeysTableMissing(error)) {
                return supplierApiKeysMigrationPendingResponse();
            }
            throw error;
        }

        await supabase
            .from('audit_logs')
            .insert({
                user_id: user.id,
                action: 'ADMIN_SUPPLIER_API_KEY_REVOKED',
                entity_type: 'fornecedor_api_key',
                entity_id: keyId,
                details: {
                    fornecedorId: keyRow.fornecedor_id,
                    keyPrefix: keyRow.key_prefix,
                },
                ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
                user_agent: request.headers.get('user-agent'),
            });

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error('Erro ao revogar chave de API de fornecedor:', error);
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
    }
}

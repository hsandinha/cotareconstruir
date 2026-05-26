import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/redis';

export const SUPPLIER_API_KEY_PREFIX = 'ccfk';
export const DEFAULT_SUPPLIER_API_SCOPES = [
    'materials:read',
    'materials:write',
    'offers:read',
    'offers:write',
    'stock:read',
    'stock:write',
    'quotes:read',
    'proposals:write',
    'orders:read',
    'orders:write',
    'webhooks:read',
    'webhooks:write',
];

export class SupplierApiAuthError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.name = 'SupplierApiAuthError';
        this.status = status;
        this.code = code;
    }
}

export interface SupplierApiAuthContext {
    keyId: string;
    fornecedorId: string;
    scopes: string[];
    fornecedor: {
        id: string;
        razao_social: string | null;
        nome_fantasia: string | null;
        cnpj: string | null;
        status: string | null;
        ativo: boolean | null;
    };
}

export function hashSupplierApiKey(apiKey: string): string {
    return createHash('sha256').update(apiKey).digest('hex');
}

function safeCompareHex(a: string, b: string): boolean {
    try {
        const left = Buffer.from(a, 'hex');
        const right = Buffer.from(b, 'hex');
        return left.length === right.length && timingSafeEqual(left, right);
    } catch {
        return false;
    }
}

export function generateSupplierApiKey() {
    const publicId = randomBytes(6).toString('base64url');
    const secret = randomBytes(32).toString('base64url');
    const apiKey = `${SUPPLIER_API_KEY_PREFIX}_${publicId}_${secret}`;

    return {
        apiKey,
        keyPrefix: `${SUPPLIER_API_KEY_PREFIX}_${publicId}`,
        keyHash: hashSupplierApiKey(apiKey),
    };
}

export function extractSupplierApiKey(request: NextRequest): string | null {
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
        const match = authHeader.match(/^Bearer\s+(.+)$/i);
        if (match?.[1]) return match[1].trim();
    }

    const apiKeyHeader = request.headers.get('x-api-key');
    return apiKeyHeader?.trim() || null;
}

function getKeyPrefixFromApiKey(apiKey: string): string | null {
    const parts = apiKey.split('_');
    if (parts.length < 3 || parts[0] !== SUPPLIER_API_KEY_PREFIX || !parts[1]) {
        return null;
    }
    return `${parts[0]}_${parts[1]}`;
}

function normalizeFornecedor(row: any) {
    const fornecedor = Array.isArray(row?.fornecedores) ? row.fornecedores[0] : row?.fornecedores;
    if (!fornecedor?.id) return null;
    return {
        id: String(fornecedor.id),
        razao_social: fornecedor.razao_social ?? null,
        nome_fantasia: fornecedor.nome_fantasia ?? null,
        cnpj: fornecedor.cnpj ?? null,
        status: fornecedor.status ?? null,
        ativo: typeof fornecedor.ativo === 'boolean' ? fornecedor.ativo : null,
    };
}

export async function authenticateSupplierApiKey(
    request: NextRequest,
    options: { requiredScope?: string } = {}
): Promise<SupplierApiAuthContext> {
    if (!supabaseAdmin) {
        throw new SupplierApiAuthError(500, 'server_not_configured', 'Configuração do servidor incompleta');
    }

    const apiKey = extractSupplierApiKey(request);
    if (!apiKey) {
        throw new SupplierApiAuthError(401, 'api_key_required', 'API key é obrigatória');
    }

    const keyPrefix = getKeyPrefixFromApiKey(apiKey);
    if (!keyPrefix) {
        throw new SupplierApiAuthError(401, 'api_key_invalid', 'API key inválida');
    }

    const apiKeyHash = hashSupplierApiKey(apiKey);
    const { data: candidates, error } = await supabaseAdmin
        .from('fornecedor_api_keys')
        .select(`
            id,
            fornecedor_id,
            key_hash,
            scopes,
            expires_at,
            revoked_at,
            fornecedores:fornecedor_id (
                id,
                razao_social,
                nome_fantasia,
                cnpj,
                status,
                ativo
            )
        `)
        .eq('key_prefix', keyPrefix)
        .limit(5);

    if (error) {
        console.error('Erro ao validar API key de fornecedor:', error);
        throw new SupplierApiAuthError(500, 'api_key_lookup_failed', 'Erro ao validar API key');
    }

    const matched = (candidates || []).find((row: any) => safeCompareHex(row.key_hash, apiKeyHash));
    if (!matched) {
        throw new SupplierApiAuthError(401, 'api_key_invalid', 'API key inválida');
    }

    if (matched.revoked_at) {
        throw new SupplierApiAuthError(401, 'api_key_revoked', 'API key revogada');
    }

    if (matched.expires_at && new Date(matched.expires_at).getTime() <= Date.now()) {
        throw new SupplierApiAuthError(401, 'api_key_expired', 'API key expirada');
    }

    const scopes = Array.isArray(matched.scopes) ? matched.scopes.map(String) : [];
    if (options.requiredScope && !scopes.includes(options.requiredScope)) {
        throw new SupplierApiAuthError(403, 'scope_denied', 'API key sem permissão para esta operação');
    }

    const fornecedor = normalizeFornecedor(matched);
    if (!fornecedor) {
        throw new SupplierApiAuthError(403, 'supplier_not_found', 'Fornecedor não encontrado');
    }

    if (fornecedor.ativo === false || fornecedor.status === 'suspended') {
        throw new SupplierApiAuthError(403, 'supplier_inactive', 'Fornecedor inativo ou suspenso');
    }

    const rateLimit = await checkRateLimit(`supplier-api:${matched.id}`, 120, 60);
    if (!rateLimit.success) {
        throw new SupplierApiAuthError(429, 'rate_limit_exceeded', 'Limite de requisições excedido');
    }

    await supabaseAdmin
        .from('fornecedor_api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', matched.id);

    return {
        keyId: matched.id,
        fornecedorId: matched.fornecedor_id,
        scopes,
        fornecedor,
    };
}

export async function createSupplierApiKey(
    supabase: any,
    params: {
        fornecedorId: string;
        name: string;
        createdBy: string;
        expiresAt?: string | null;
        scopes?: string[];
    }
) {
    const generated = generateSupplierApiKey();
    const scopes = params.scopes?.length ? params.scopes : DEFAULT_SUPPLIER_API_SCOPES;

    const { data, error } = await supabase
        .from('fornecedor_api_keys')
        .insert({
            fornecedor_id: params.fornecedorId,
            name: params.name.trim(),
            key_prefix: generated.keyPrefix,
            key_hash: generated.keyHash,
            scopes,
            expires_at: params.expiresAt || null,
            created_by: params.createdBy,
        })
        .select('id, fornecedor_id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at, updated_at')
        .single();

    if (error) throw error;

    return {
        apiKey: generated.apiKey,
        data,
    };
}

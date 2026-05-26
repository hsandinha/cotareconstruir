export class SupplierApiError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
        super(message);
        this.name = 'SupplierApiError';
        this.status = status;
        this.code = code;
    }
}

export function supplierApiErrorResponse(error: any, fallbackMessage = 'Erro interno do servidor') {
    if (error && typeof error.status === 'number' && typeof error.code === 'string') {
        return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }

    console.error(fallbackMessage, error);
    return Response.json({ error: fallbackMessage }, { status: 500 });
}

export function parsePositivePage(value: string | null, fallback = 1) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parsePageSize(value: string | null, fallback = 100, max = 500) {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
}

export function parseBooleanQuery(value: string | null): boolean | null {
    if (value === null || value === '') return null;
    const normalized = value.toLowerCase();
    if (['1', 'true', 'sim', 'ativo', 'active'].includes(normalized)) return true;
    if (['0', 'false', 'nao', 'não', 'inativo', 'inactive'].includes(normalized)) return false;
    return null;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(value: unknown, field: string) {
    if (typeof value !== 'string' || !UUID_RE.test(value.trim())) {
        throw new SupplierApiError(400, 'invalid_uuid', `${field} deve ser um UUID válido`);
    }
    return value.trim();
}

export function parseNonNegativeNumber(value: unknown, field: string) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new SupplierApiError(400, 'invalid_number', `${field} deve ser um número maior ou igual a zero`);
    }
    return parsed;
}

export function parseNonNegativeInteger(value: unknown, field: string) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
        throw new SupplierApiError(400, 'invalid_integer', `${field} deve ser um inteiro maior ou igual a zero`);
    }
    return parsed;
}

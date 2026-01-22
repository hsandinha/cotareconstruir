/**
 * Sistema de Audit Logs
 * Registra todas as ações críticas do sistema para auditoria e segurança
 * Migrado para Supabase
 */

import { supabase } from './supabase';

export enum AuditAction {
    // Autenticação
    LOGIN = 'LOGIN',
    LOGOUT = 'LOGOUT',
    LOGIN_FAILED = 'LOGIN_FAILED',
    PASSWORD_CHANGED = 'PASSWORD_CHANGED',
    PASSWORD_RESET = 'PASSWORD_RESET',

    // Usuários
    USER_CREATED = 'USER_CREATED',
    USER_UPDATED = 'USER_UPDATED',
    USER_DELETED = 'USER_DELETED',
    USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',

    // Fornecedores
    SUPPLIER_CREATED = 'SUPPLIER_CREATED',
    SUPPLIER_UPDATED = 'SUPPLIER_UPDATED',
    SUPPLIER_DELETED = 'SUPPLIER_DELETED',
    SUPPLIER_VERIFIED = 'SUPPLIER_VERIFIED',

    // Clientes
    CLIENT_CREATED = 'CLIENT_CREATED',
    CLIENT_UPDATED = 'CLIENT_UPDATED',
    CLIENT_DELETED = 'CLIENT_DELETED',

    // Obras
    WORK_CREATED = 'WORK_CREATED',
    WORK_UPDATED = 'WORK_UPDATED',
    WORK_DELETED = 'WORK_DELETED',

    // Materiais
    MATERIAL_CREATED = 'MATERIAL_CREATED',
    MATERIAL_UPDATED = 'MATERIAL_UPDATED',
    MATERIAL_DELETED = 'MATERIAL_DELETED',

    // Cotações e Pedidos
    QUOTATION_CREATED = 'QUOTATION_CREATED',
    QUOTATION_SENT = 'QUOTATION_SENT',
    PROPOSAL_CREATED = 'PROPOSAL_CREATED',
    ORDER_CREATED = 'ORDER_CREATED',
    ORDER_APPROVED = 'ORDER_APPROVED',
    ORDER_CANCELLED = 'ORDER_CANCELLED',

    // Segurança
    UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
    SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',

    // Webhooks
    WEBHOOK_RECEIVED = 'WEBHOOK_RECEIVED',
}

export interface AuditLogEntry {
    action: AuditAction;
    userId?: string | null;
    userEmail?: string;
    userRole?: string;
    targetId?: string;
    targetType?: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    success: boolean;
    errorMessage?: string;
}

/**
 * Registra uma ação no audit log
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
    try {
        const { error } = await supabase.from('audit_logs').insert({
            user_id: entry.userId || null,
            action: entry.action,
            entity_type: entry.targetType,
            entity_id: entry.targetId || null,
            details: {
                userEmail: entry.userEmail,
                userRole: entry.userRole,
                success: entry.success,
                errorMessage: entry.errorMessage,
                ...entry.details,
            },
            ip_address: entry.ipAddress,
            user_agent: entry.userAgent,
        });

        if (error) {
            console.error('Erro ao registrar audit log:', error);
        }
    } catch (error) {
        // Não deve falhar a operação principal se o log falhar
        console.error('Erro ao registrar audit log:', error);
    }
}

/**
 * Helper para extrair IP e User Agent da request
 */
export function extractRequestMetadata(request: Request) {
    const headers = request.headers;

    return {
        ipAddress: headers.get('x-forwarded-for')?.split(',')[0] ||
            headers.get('x-real-ip') ||
            'unknown',
        userAgent: headers.get('user-agent') || 'unknown',
    };
}

/**
 * Helper para log de login
 */
export async function logLogin(
    userId: string,
    userEmail: string,
    userRole: string,
    request: Request,
    success: boolean = true,
    errorMessage?: string
) {
    const metadata = extractRequestMetadata(request);

    await logAuditEvent({
        action: success ? AuditAction.LOGIN : AuditAction.LOGIN_FAILED,
        userId,
        userEmail,
        userRole,
        success,
        errorMessage,
        ...metadata,
    });
}

/**
 * Helper para log de logout
 */
export async function logLogout(
    userId: string,
    userEmail: string,
    request: Request
) {
    const metadata = extractRequestMetadata(request);

    await logAuditEvent({
        action: AuditAction.LOGOUT,
        userId,
        userEmail,
        success: true,
        ...metadata,
    });
}

/**
 * Helper para log de acesso não autorizado
 */
export async function logUnauthorizedAccess(
    userId: string | null,
    targetPath: string,
    request: Request
) {
    const metadata = extractRequestMetadata(request);

    await logAuditEvent({
        action: AuditAction.UNAUTHORIZED_ACCESS,
        userId,
        success: false,
        details: { targetPath },
        ...metadata,
    });
}

/**
 * Helper para log de rate limit excedido
 */
export async function logRateLimitExceeded(
    identifier: string,
    request: Request
) {
    const metadata = extractRequestMetadata(request);

    await logAuditEvent({
        action: AuditAction.RATE_LIMIT_EXCEEDED,
        success: false,
        details: { identifier },
        ...metadata,
    });
}

import type { NextRequest } from 'next/server';

export function getRequestMetadata(request: Request | NextRequest) {
    const headers = request.headers;
    return {
        ipAddress: headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || headers.get('x-real-ip')
            || 'unknown',
        userAgent: headers.get('user-agent') || 'unknown',
    };
}

export async function logServerAuditEvent(
    supabase: any,
    params: {
        action: string;
        userId?: string | null;
        entityType?: string | null;
        entityId?: string | null;
        details?: Record<string, any>;
        request?: Request | NextRequest;
    }
) {
    try {
        const metadata = params.request ? getRequestMetadata(params.request) : {};
        await supabase.from('audit_logs').insert({
            user_id: params.userId || null,
            action: params.action,
            entity_type: params.entityType || null,
            entity_id: params.entityId || null,
            details: params.details || {},
            ip_address: (metadata as any).ipAddress,
            user_agent: (metadata as any).userAgent,
        });
    } catch (error) {
        console.error('Erro ao registrar auditoria server-side:', error);
    }
}

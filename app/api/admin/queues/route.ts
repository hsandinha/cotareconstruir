/**
 * API: Status das Filas (BullMQ)
 * GET /api/admin/queues
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats } from '@/lib/queue';
import { formatErrorResponse } from '@/lib/errorHandler';
import { withCors } from '@/lib/cors';
import { supabaseAdmin } from '@/lib/supabase';

async function getAuthUser(req: NextRequest) {
    if (!supabaseAdmin) return null;

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
            } catch { }
        }
    }

    if (!token) {
        token = req.cookies.get('authToken')?.value
            || req.cookies.get('token')?.value
            || req.cookies.get('sb-access-token')?.value;
    }

    if (!token) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
}

async function handler(request: NextRequest) {
    try {
        const user = await getAuthUser(request);
        if (!user) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
        }

        if (!supabaseAdmin) {
            return NextResponse.json({ error: 'Configuração do servidor incompleta' }, { status: 500 });
        }

        const { data: userData } = await supabaseAdmin
            .from('users')
            .select('role, roles')
            .eq('id', user.id)
            .single();

        const isAdmin = userData?.role === 'admin' || (Array.isArray(userData?.roles) && userData.roles.includes('admin'));
        if (!isAdmin) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }

        const stats = await getQueueStats();

        return NextResponse.json({
            success: true,
            queues: stats,
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        const errorResponse = formatErrorResponse(error);
        return NextResponse.json(
            errorResponse,
            { status: errorResponse.error.statusCode }
        );
    }
}

export const GET = withCors(handler);

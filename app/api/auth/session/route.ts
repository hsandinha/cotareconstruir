/**
 * API Route para verificação de sessão
 * Valida sessão Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { formatErrorResponse, AuthenticationError } from '@/lib/errorHandler';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
    try {
        // Pegar token do header Authorization
        const authHeader = request.headers.get('authorization');
        const token = authHeader?.replace('Bearer ', '');

        if (!token) {
            throw new AuthenticationError('Token não encontrado');
        }

        // Criar cliente Supabase
        const supabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        // Verificar o token
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            throw new AuthenticationError('Sessão inválida ou expirada');
        }

        // Buscar dados do perfil
        const { data: profile } = await supabase
            .from('users')
            .select('role, roles, status')
            .eq('id', user.id)
            .single();

        return NextResponse.json({
            valid: true,
            userId: user.id,
            email: user.email,
            role: profile?.role || 'cliente',
            roles: profile?.roles || ['cliente'],
            status: profile?.status || 'active',
        });

    } catch (error) {
        const errorResponse = formatErrorResponse(error);
        return NextResponse.json(
            errorResponse,
            { status: errorResponse.error.statusCode }
        );
    }
}

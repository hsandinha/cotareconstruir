/**
 * API Route para Logout
 * Implementa logout com Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { logLogout } from '@/lib/auditLog';
import { formatErrorResponse } from '@/lib/errorHandler';

export async function POST(request: NextRequest) {
    try {
        const userId = request.cookies.get('userId')?.value;
        const userEmail = request.cookies.get('userEmail')?.value;

        // Audit log
        if (userId && userEmail) {
            await logLogout(userId, userEmail, request);
        }

        // Nota: O logout real do Supabase acontece no client-side
        // Aqui apenas limpamos os cookies

        // Criar response e limpar todos os cookies
        const response = NextResponse.json({
            success: true,
            message: 'Logout realizado com sucesso'
        });

        const cookieOptions = 'Path=/; Max-Age=0; SameSite=Strict';

        response.headers.append('Set-Cookie', `token=; ${cookieOptions}`);
        response.headers.append('Set-Cookie', `role=; ${cookieOptions}`);
        response.headers.append('Set-Cookie', `userId=; ${cookieOptions}`);
        response.headers.append('Set-Cookie', `userEmail=; ${cookieOptions}`);
        response.headers.append('Set-Cookie', `mustChangePassword=; ${cookieOptions}`);

        return response;

    } catch (error) {
        const errorResponse = formatErrorResponse(error);
        return NextResponse.json(
            errorResponse,
            { status: errorResponse.error.statusCode }
        );
    }
}

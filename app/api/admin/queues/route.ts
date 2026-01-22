/**
 * API: Status das Filas (BullMQ)
 * GET /api/admin/queues
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats } from '@/lib/queue';
import { formatErrorResponse } from '@/lib/errorHandler';
import { withCors } from '@/lib/cors';

async function handler(request: NextRequest) {
    try {
        // TODO: Verificar se usuário é admin

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

/**
 * API Route para validação de CEP
 * Consulta ViaCEP/BrasilAPI
 */

import { NextRequest, NextResponse } from 'next/server';
import { sanitizeNumeric, validateCEP } from '@/lib/validation';
import { formatErrorResponse, ValidationError } from '@/lib/errorHandler';
import { rateLimit } from '@/lib/rateLimit';
import { withCors } from '@/lib/cors';

const limiter = rateLimit({
    interval: 60 * 1000,
    uniqueTokenPerInterval: 100,
});

async function handler(request: NextRequest) {
    try {
        // Rate limiting
        const identifier = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
        const rateLimitResult = await limiter.check(identifier, 20); // 20 consultas por minuto

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Muitas consultas. Tente novamente em instantes.' },
                { status: 429 }
            );
        }

        const { searchParams } = new URL(request.url);
        const cep = searchParams.get('cep');

        if (!cep) {
            throw new ValidationError('CEP é obrigatório');
        }

        const cleanCEP = sanitizeNumeric(cep);

        if (cleanCEP.length !== 8) {
            throw new ValidationError('CEP deve ter 8 dígitos');
        }

        // Consultar BrasilAPI
        const response = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCEP}`);

        if (!response.ok) {
            throw new ValidationError('CEP não encontrado');
        }

        const data = await response.json();

        return NextResponse.json({
            success: true,
            data: {
                cep: cleanCEP,
                logradouro: data.street || '',
                bairro: data.neighborhood || '',
                cidade: data.city || '',
                estado: data.state || '',
            },
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

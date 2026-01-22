/**
 * API Route para validação de CNPJ
 * Consulta Receita Federal e valida dados
 */

import { NextRequest, NextResponse } from 'next/server';
import { sanitizeNumeric, validateCNPJ } from '@/lib/validation';
import { formatErrorResponse, ValidationError } from '@/lib/errorHandler';
import { rateLimit } from '@/lib/rateLimit';
import { withCors } from '@/lib/cors';

const limiter = rateLimit({
    interval: 60 * 1000, // 1 minuto
    uniqueTokenPerInterval: 100,
});

async function handler(request: NextRequest) {
    try {
        // Rate limiting
        const identifier = request.headers.get('x-forwarded-for')?.split(',')[0] || 'anonymous';
        const rateLimitResult = await limiter.check(identifier, 10); // 10 consultas por minuto

        if (!rateLimitResult.success) {
            return NextResponse.json(
                { error: 'Muitas consultas. Tente novamente em instantes.' },
                { status: 429 }
            );
        }

        const { searchParams } = new URL(request.url);
        const cnpj = searchParams.get('cnpj');

        if (!cnpj) {
            throw new ValidationError('CNPJ é obrigatório');
        }

        const cleanCNPJ = sanitizeNumeric(cnpj);

        if (!validateCNPJ(cleanCNPJ)) {
            throw new ValidationError('CNPJ inválido');
        }

        // Consultar API da Receita Federal
        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`, {
            headers: {
                'User-Agent': 'CotaReconstruir/1.0',
            },
        });

        if (!response.ok) {
            throw new ValidationError('CNPJ não encontrado ou erro na consulta');
        }

        const data = await response.json();

        // Retornar dados formatados
        return NextResponse.json({
            success: true,
            data: {
                cnpj: cleanCNPJ,
                razaoSocial: data.razao_social || '',
                nomeFantasia: data.nome_fantasia || '',
                situacao: data.descricao_situacao_cadastral || '',
                dataAbertura: data.data_inicio_atividade || '',
                logradouro: data.logradouro || '',
                numero: data.numero || '',
                complemento: data.complemento || '',
                bairro: data.bairro || '',
                cidade: data.municipio || '',
                estado: data.uf || '',
                cep: data.cep || '',
                telefone: data.ddd_telefone_1 || '',
                email: data.email || '',
                atividadePrincipal: data.cnae_fiscal_descricao || '',
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

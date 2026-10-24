/**
 * API: código de indicação → nome do parceiro
 *
 * GET /api/afiliados/resolver?codigo=MARCOS
 *
 * Serve para a tela de cadastro confirmar na cara do cliente quem o indicou:
 * "Indicado por Marcos Vieira". Sem esse retorno, a atribuição é invisível —
 * quando o cookie se perde (clicou no celular, cadastrou no computador),
 * ninguém percebe até o parceiro cobrar uma comissão que não existe.
 *
 * Devolve SÓ o nome. `afiliados` guarda e-mail, CPF/CNPJ e chave PIX de
 * terceiros, e nada disso tem o que fazer numa rota pública.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { normalizarCodigo, codigoValido } from '@/lib/cobrancaModelo';
import { rateLimit } from '@/lib/rateLimit';

// O código é curto e a rota é anônima: sem teto, dá para varrer a lista de
// parceiros tentando combinações.
const limitador = rateLimit({ interval: 60_000 });

function ipDe(req: NextRequest): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        || req.headers.get('x-real-ip')
        || 'desconhecido';
}

export async function GET(req: NextRequest) {
    if (!supabaseAdmin) {
        return NextResponse.json({ encontrado: false });
    }

    const limite = await limitador.check(`afiliado-resolver:${ipDe(req)}`, 20);
    if (!limite.success) {
        return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto.' }, { status: 429 });
    }

    const codigo = normalizarCodigo(new URL(req.url).searchParams.get('codigo'));
    if (!codigoValido(codigo)) {
        return NextResponse.json({ encontrado: false });
    }

    const { data } = await supabaseAdmin
        .from('afiliados')
        .select('nome')
        .eq('codigo', codigo)
        .eq('status', 'ativo')
        .maybeSingle();

    if (!data) {
        return NextResponse.json({ encontrado: false });
    }

    return NextResponse.json({ encontrado: true, codigo, nome: data.nome });
}

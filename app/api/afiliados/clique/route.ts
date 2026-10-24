/**
 * API: registra a visita vinda de um link de parceiro
 *
 * POST /api/afiliados/clique
 *
 * Só alimenta o funil do parceiro (cliques → cadastros). Quem decide de quem
 * é o cliente é o cookie no momento do cadastro, em /api/auth/signup — então
 * uma falha aqui não custa comissão a ninguém, e a rota responde 200 em
 * qualquer cenário para não poluir o console do visitante.
 *
 * Rota pública por natureza: o visitante ainda não tem conta. O que a
 * protege de virar canal de spam é só aceitar código que exista e cadastrar
 * um registro por visita.
 */

import { NextRequest, NextResponse } from 'next/server';
import { registrarClique, COOKIE_REF, COOKIE_VISITANTE } from '@/lib/afiliados';
import { normalizarCodigo, codigoValido } from '@/lib/cobrancaModelo';
import { rateLimit } from '@/lib/rateLimit';

/** Teto por visitante: registrar visita não é algo que se faça em rajada. */
const limitador = rateLimit({ interval: 60_000 });

/** Lê o cookie `cc_ref`, que o proxy grava como {"c":"CODIGO","t":123}. */
function codigoDoCookie(valor: string | undefined): string {
    if (!valor) return '';
    try {
        const dados = JSON.parse(valor);
        return normalizarCodigo(dados?.c);
    } catch {
        // Formato antigo ou cookie mexido à mão: tenta como texto puro
        return normalizarCodigo(valor);
    }
}

export async function POST(req: NextRequest) {
    try {
        const codigo = codigoDoCookie(req.cookies.get(COOKIE_REF)?.value);
        const visitante = req.cookies.get(COOKIE_VISITANTE)?.value;

        if (!codigo || !codigoValido(codigo) || !visitante) {
            return NextResponse.json({ ok: false });
        }

        // Um visitante não precisa registrar visita mais que algumas vezes.
        const limite = await limitador.check(`afiliado-clique:${visitante}`, 10);
        if (!limite.success) {
            return NextResponse.json({ ok: false });
        }

        let destino: string | null = null;
        let utm: Record<string, string> | null = null;
        try {
            const body = await req.json();
            destino = typeof body?.destino === 'string' ? body.destino : null;
            if (body?.utm && typeof body.utm === 'object') {
                utm = Object.fromEntries(
                    Object.entries(body.utm)
                        .filter(([, v]) => typeof v === 'string')
                        .slice(0, 10)
                        .map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 200)])
                );
            }
        } catch {
            // Corpo vazio é aceitável: o cookie já diz o essencial
        }

        await registrarClique({
            codigo,
            visitante,
            destino,
            utm,
            userAgent: req.headers.get('user-agent'),
        });

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('❌ Afiliados: erro na rota de clique', error);
        return NextResponse.json({ ok: false });
    }
}

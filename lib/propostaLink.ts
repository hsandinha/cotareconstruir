/**
 * Link de resposta de cotação — o fornecedor responde sem ter conta.
 *
 * O caminho da planilha (docs/cotacao-por-whatsapp.md) exige baixar um .xlsx,
 * abrir num app de planilha e devolver o arquivo. No celular isso derruba a
 * taxa de resposta. Aqui o fornecedor toca no link, o formulário abre no
 * navegador do próprio WhatsApp e ele digita os preços.
 *
 * Segurança deste link, já que ele vale como autenticação:
 *
 * - O token tem 32 bytes de entropia. Adivinhar está fora de cogitação.
 * - O banco guarda só o SHA-256. Quem ler a tabela não consegue responder no
 *   lugar de ninguém — o token em claro só existe na URL enviada.
 * - Cada token vale para UM par (cotação, fornecedor). Ele não abre outra
 *   cotação nem fala por outro fornecedor.
 * - Tem validade. Link velho encontrado numa conversa antiga não serve.
 *
 * O que o link NÃO dá: ver quem é o cliente, ver proposta de concorrente, ou
 * qualquer coisa fora daquela cotação. Ver `app/api/proposta-link/route.ts`.
 */

import { createHash, randomBytes } from 'crypto';
import { supabaseAdmin } from './supabase';

/** Validade padrão. Cotação parada mais que isso já virou outra conversa. */
export const VALIDADE_PADRAO_DIAS = 30;

export const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://comprareconstruir.com';

/** Token novo, em base64url — cabe numa URL sem escapar nada. */
export function gerarToken(): string {
    return randomBytes(32).toString('base64url');
}

/**
 * SHA-256 em hex, que é o que vai para o banco.
 *
 * Sem salt de propósito: o token já tem 256 bits de aleatoriedade, então não
 * há dicionário a defender — e um hash determinístico é o que permite achar
 * a linha pelo índice em vez de varrer a tabela.
 */
export function hashToken(token: string): string {
    return createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
}

/** URL completa que vai na mensagem do fornecedor. */
export function urlDaProposta(token: string): string {
    return `${BASE_URL}/proposta/${token}`;
}

/** Data de expiração a partir de hoje. */
export function expiraEm(dias = VALIDADE_PADRAO_DIAS): string {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + Math.max(1, dias));
    return d.toISOString();
}

/**
 * Formato plausível de token, checado ANTES de ir ao banco.
 *
 * Evita que qualquer lixo colado na URL vire uma consulta. Não diz nada sobre
 * o token ser válido — só que vale a pena perguntar.
 */
export function tokenPlausivel(token: unknown): boolean {
    return typeof token === 'string' && /^[A-Za-z0-9_-]{40,64}$/.test(token);
}

// ============================================================
// GERAÇÃO EM LOTE (disparo da cotação)
// ============================================================

export interface ConviteParaToken {
    cotacaoId: string;
    fornecedorId: string;
}

/** Chave do mapa devolvido por `gerarTokensDeResposta`. */
export function chaveConvite(cotacaoId: string, fornecedorId: string): string {
    return `${cotacaoId}:${fornecedorId}`;
}

/**
 * Cria um token de resposta para cada convite e devolve os tokens em claro.
 *
 * Chamado no disparo da cotação, para que o botão da notificação já aponte
 * direto para o formulário do fornecedor. Em lote porque um envio atinge
 * dezenas de fornecedores de uma vez.
 *
 * O token em claro só existe no retorno desta função — o banco fica com o
 * hash. Quem não pegar o valor aqui não o recupera depois.
 *
 * Nunca lança: cotação tem que sair mesmo que o link falhe. Sem token, a
 * notificação cai no template anterior, que leva o fornecedor ao login.
 */
export async function gerarTokensDeResposta(
    convites: ConviteParaToken[],
    dias = VALIDADE_PADRAO_DIAS,
): Promise<Map<string, string>> {
    const tokens = new Map<string, string>();
    if (!supabaseAdmin || convites.length === 0) return tokens;

    const expira = expiraEm(dias);
    const agora = new Date().toISOString();

    await Promise.allSettled(
        convites.map(async ({ cotacaoId, fornecedorId }) => {
            const token = gerarToken();
            const { error } = await supabaseAdmin!
                .from('cotacao_convites')
                .update({
                    token_hash: hashToken(token),
                    token_criado_em: agora,
                    token_expira_em: expira,
                    token_aberto_em: null,
                })
                .eq('cotacao_id', cotacaoId)
                .eq('fornecedor_id', fornecedorId);

            if (error) {
                console.error('❌ Link de proposta: falha ao gravar token', error);
                return;
            }
            tokens.set(chaveConvite(cotacaoId, fornecedorId), token);
        })
    );

    return tokens;
}

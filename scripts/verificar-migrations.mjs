/**
 * Confere o que as migrations recentes criaram, direto no banco.
 *
 * "Apliquei a migration" e "a migration está valendo" são coisas diferentes
 * quando um `DO $$ ... $$` engole um erro ou a migration roda pela metade.
 * Este script pergunta ao banco em vez de supor.
 *
 * Uso:
 *   node scripts/verificar-migrations.mjs
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../.env.local') });

const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
);

const ok = (t) => `\x1b[32m✓\x1b[0m ${t}`;
const falha = (t, d) => `\x1b[31m✗\x1b[0m ${t}${d ? `  \x1b[90m${d}\x1b[0m` : ''}`;

/** A tabela existe e tem estas colunas? */
async function conferirTabela(tabela, colunas) {
    const { error } = await db.from(tabela).select(colunas.join(', ')).limit(1);
    if (!error) return console.log(ok(`${tabela} (${colunas.length} colunas)`));

    // 42P01 = tabela não existe; 42703 = coluna não existe
    const motivo = error.code === '42P01' ? 'tabela não existe' : error.message;
    console.log(falha(tabela, motivo));
    return false;
}

/** A função existe e está acessível ao service_role? */
async function conferirRpc(nome, args) {
    const { error } = await db.rpc(nome, args);
    if (!error) return console.log(ok(`rpc ${nome}()`));
    if (/could not find the function|does not exist/i.test(error.message)) {
        return console.log(falha(`rpc ${nome}()`, 'função não existe'));
    }
    // Erro de dado (token inexistente, por exemplo) significa que a função está lá
    console.log(ok(`rpc ${nome}()`));
}

async function main() {
    console.log('\n\x1b[1m20261023100000_proposta_por_link\x1b[0m');
    await conferirTabela('cotacao_convites', [
        'id', 'token_hash', 'token_criado_em', 'token_expira_em', 'token_aberto_em', 'respondido_em',
    ]);
    await conferirTabela('propostas', ['id', 'origem', 'lancada_por_admin']);
    await conferirRpc('convite_por_token', { p_token_hash: 'x'.repeat(64) });

    console.log('\n\x1b[1m20261023000000_assinaturas_e_afiliados\x1b[0m');
    await conferirTabela('cobranca_config', [
        'id', 'modelo', 'valor_centavos', 'ciclo', 'dias_trial', 'cobranca_ativa',
        'afiliado_percentual_padrao', 'afiliado_duracao_meses_padrao', 'afiliado_janela_dias',
    ]);
    await conferirTabela('assinaturas', ['id', 'cliente_id', 'obra_id', 'modelo', 'valor_centavos', 'status']);
    await conferirTabela('pagamentos', ['id', 'assinatura_id', 'competencia', 'valor_centavos', 'status']);
    await conferirTabela('afiliados', ['id', 'codigo', 'nome', 'percentual', 'duracao_meses', 'status']);
    await conferirTabela('afiliado_cliques', ['id', 'afiliado_id', 'visitante']);
    await conferirTabela('afiliado_indicacoes', ['id', 'afiliado_id', 'user_id', 'percentual', 'comissao_inicio']);
    await conferirTabela('afiliado_comissoes', ['id', 'afiliado_id', 'pagamento_id', 'valor_centavos', 'status']);
    await conferirRpc('afiliado_por_codigo', { p_codigo: 'NAOEXISTE' });

    // A linha única de configuração precisa existir, senão o admin abre vazio
    const { data: cfg } = await db.from('cobranca_config').select('*').eq('id', true).maybeSingle();
    if (cfg) {
        console.log(ok(`cobranca_config semeada — ${cfg.modelo}, R$ ${(cfg.valor_centavos / 100).toFixed(2)}, cobrança ${cfg.cobranca_ativa ? 'LIGADA' : 'desligada'}`));
    } else {
        console.log(falha('cobranca_config semeada', 'linha única ausente'));
    }
    console.log('');
}

main().catch((e) => { console.error('❌', e); process.exit(1); });

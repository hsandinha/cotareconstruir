/**
 * Gera localmente a planilha de resposta de uma cotação — o mesmo arquivo que
 * o fornecedor recebe anexado no WhatsApp.
 *
 * Serve para conferir o formato sem precisar disparar cotação de verdade.
 *
 * Uso:
 *   npx tsx scripts/gerar-planilha-cotacao.ts --listar     # cotações recentes e seus itens
 *   npx tsx scripts/gerar-planilha-cotacao.ts              # cotação mais recente com itens
 *   npx tsx scripts/gerar-planilha-cotacao.ts 10070        # por número
 *   npx tsx scripts/gerar-planilha-cotacao.ts 10070 /tmp   # escolhendo a pasta
 *
 * Variáveis de ambiente (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import dotenv from 'dotenv';
import { writeFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { gerarPlanilhaResposta, nomeArquivoPlanilha } from '../lib/cotacaoPlanilha';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
    console.error('❌ Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local');
    process.exit(1);
}

const db = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const apenasListar = process.argv.includes('--listar');
const numeroPedido = process.argv.slice(2).find((a) => !a.startsWith('--'));
const destino = process.argv.slice(2).filter((a) => !a.startsWith('--'))[1] || process.cwd();

/** Panorama rápido: qual cotação vale a pena usar de exemplo. */
async function listarCotacoes() {
    const { data } = await db
        .from('cotacoes')
        .select('numero, status, created_at, cotacao_itens(id)')
        .order('created_at', { ascending: false })
        .limit(80);

    const linhas = (data || [])
        .map((c: any) => ({
            numero: c.numero,
            status: c.status,
            itens: (c.cotacao_itens || []).length,
            criada: String(c.created_at).slice(0, 10),
        }))
        .sort((a, b) => b.itens - a.itens)
        .slice(0, 15);

    console.table(linhas);
}

async function escolherCotacao() {
    if (numeroPedido) {
        const { data } = await db
            .from('cotacoes')
            .select('id, numero, status, created_at')
            .eq('numero', numeroPedido)
            .maybeSingle();
        return data;
    }

    // Sem número: a mais recente que tenha itens — é a que interessa para olhar o formato.
    const { data } = await db
        .from('cotacoes')
        .select('id, numero, status, created_at, cotacao_itens(id)')
        .order('created_at', { ascending: false })
        .limit(25);

    return (data || []).find((c: any) => (c.cotacao_itens || []).length > 0) || null;
}

async function main() {
    if (apenasListar) {
        await listarCotacoes();
        return;
    }

    const cotacao = await escolherCotacao();
    if (!cotacao) {
        console.error(numeroPedido
            ? `❌ Cotação #${numeroPedido} não encontrada`
            : '❌ Nenhuma cotação com itens encontrada');
        process.exit(1);
    }

    const { data: itens } = await db
        .from('cotacao_itens')
        .select('id, nome, fabricante, unidade, quantidade')
        .eq('cotacao_id', cotacao.id)
        .order('created_at', { ascending: true });

    if (!itens || itens.length === 0) {
        console.error(`❌ Cotação #${cotacao.numero} não tem itens`);
        process.exit(1);
    }

    const arquivo = join(destino, nomeArquivoPlanilha(String(cotacao.numero || cotacao.id)));
    writeFileSync(arquivo, gerarPlanilhaResposta(cotacao, itens));

    console.log(`\n📄 Cotação #${cotacao.numero} — ${cotacao.status} — ${itens.length} itens`);
    for (const item of itens.slice(0, 10)) {
        console.log(`   • ${item.nome} — ${item.quantidade} ${item.unidade || ''}`);
    }
    if (itens.length > 10) console.log(`   … e mais ${itens.length - 10}`);
    console.log(`\n✅ Planilha gerada: ${arquivo}\n`);
}

main().catch((err) => {
    console.error('❌ Erro inesperado:', err);
    process.exit(1);
});

/**
 * Script para atualizar cotações e pedidos existentes com número sequencial numérico.
 * 
 * - Cotações: 10001, 10002, 10003... (ordenadas por created_at)
 * - Pedidos: 10001, 10002, 10003... (ordenados por created_at)
 * 
 * Uso: node scripts/update-pedidos-numero.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateTable(tableName, label) {
    console.log(`\n🔄 Atualizando ${label}...\n`);

    const { data: records, error } = await supabase
        .from(tableName)
        .select('id, numero, created_at, status')
        .order('created_at', { ascending: true });

    if (error) {
        console.error(`❌ Erro ao buscar ${label}:`, error.message);
        return;
    }

    if (!records || records.length === 0) {
        console.log(`ℹ️  Nenhum(a) ${label} encontrado(a).`);
        return;
    }

    console.log(`📦 Total de ${label}: ${records.length}`);

    // Encontrar o maior número existente
    let nextNumber = 10001;
    for (const record of records) {
        if (record.numero) {
            const num = parseInt(record.numero, 10);
            if (!isNaN(num) && num >= nextNumber) {
                nextNumber = num + 1;
            }
        }
    }

    let updated = 0;
    let skipped = 0;

    for (const record of records) {
        const isNumericOnly = record.numero && /^\d+$/.test(record.numero);

        if (isNumericOnly) {
            skipped++;
            console.log(`  ⏭️  ${label} ${record.id.slice(0, 8)} já tem número: ${record.numero}`);
            continue;
        }

        const numero = String(nextNumber);
        const { error: updateError } = await supabase
            .from(tableName)
            .update({ numero })
            .eq('id', record.id);

        if (updateError) {
            console.error(`  ❌ Erro ao atualizar ${label} ${record.id}:`, updateError.message);
        } else {
            console.log(`  ✅ ${label} ${record.id.slice(0, 8)} → #${numero} (status: ${record.status}, criado: ${record.created_at})`);
            updated++;
            nextNumber++;
        }
    }

    console.log(`\n📊 Resultado ${label}:`);
    console.log(`   Atualizados: ${updated}`);
    console.log(`   Já com número: ${skipped}`);
    console.log(`   Próximo número disponível: ${nextNumber}`);
}

async function main() {
    console.log('='.repeat(60));
    console.log('  Atualização de Números - Cotações e Pedidos');
    console.log('='.repeat(60));

    await updateTable('cotacoes', 'Cotação');
    await updateTable('pedidos', 'Pedido');

    console.log('\n✅ Concluído!');
}

main().catch(console.error);

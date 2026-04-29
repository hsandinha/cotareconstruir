/**
 * Exporta nome, telefone e email dos fornecedores para CSV.
 * Uso: node scripts/export-fornecedores-contatos.mjs
 * Saída: fornecedores-contatos.csv (na raiz do projeto)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente não configuradas (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n;]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

async function main() {
    const pageSize = 1000;
    let from = 0;
    const all = [];

    while (true) {
        const { data, error } = await supabase
            .from('fornecedores')
            .select('razao_social, nome_fantasia, telefone, whatsapp, email')
            .order('razao_social', { ascending: true })
            .range(from, from + pageSize - 1);

        if (error) {
            console.error('❌ Erro ao consultar:', error.message);
            process.exit(1);
        }

        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
    }

    const header = ['nome', 'telefone', 'whatsapp', 'email'];
    const lines = [header.join(',')];

    for (const row of all) {
        const nome = row.nome_fantasia || row.razao_social || '';
        lines.push([
            csvEscape(nome),
            csvEscape(row.telefone),
            csvEscape(row.whatsapp),
            csvEscape(row.email),
        ].join(','));
    }

    const outPath = resolve(__dirname, '../fornecedores-contatos.csv');
    // BOM para acentuação correta no Excel
    writeFileSync(outPath, '\uFEFF' + lines.join('\n'), 'utf8');

    console.log(`✅ Exportados ${all.length} fornecedores para: ${outPath}`);
}

main();

/**
 * Script para atualizar fornecedores no banco de dados a partir do Excel
 * "FORNECEDORES ATUALIZADOS.xlsx"
 * 
 * Campos do Excel:
 * RAZÃO SOCIAL | GRUPOS DE MATERIAIS | CONTATO | FONE | WHATSAPP | EMAIL | CNPJ |
 * INSC. ESTADUAL | ENDEREÇO | NUMERO | BAIRRO | CIDADE | ESTADO | CEP | CARTÃO DE CRÉDITO
 * 
 * Uso: node scripts/update-fornecedores-from-excel.mjs
 */

import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Admin (service_role key)
const supabaseUrl = 'https://rboauvtemdlislypnggq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJib2F1dnRlbWRsaXNseXBuZ2dxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA4MzQ5NywiZXhwIjoyMDg0NjU5NDk3fQ.MynE4KL4xC_nXK2BhOV81eOmIPTi5TFssCySFQS7Eec';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Ler o Excel
const excelPath = path.join(__dirname, '..', 'FORNECEDORES ATUALIZADOS.xlsx');
console.log(`📁 Lendo arquivo: ${excelPath}`);

const workbook = XLSX.readFile(excelPath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

console.log(`📊 Planilha: "${sheetName}" - ${rows.length} linhas encontradas\n`);

// Mostrar colunas encontradas
if (rows.length > 0) {
    console.log('📋 Colunas encontradas:', Object.keys(rows[0]).join(' | '));
    console.log('');
}

// Buscar todos os fornecedores do banco
const { data: fornecedoresDB, error: fetchError } = await supabase
    .from('fornecedores')
    .select('id, razao_social, cnpj, email, contato, telefone, whatsapp, cartao_credito, inscricao_estadual, logradouro, numero, bairro, cidade, estado, cep');

if (fetchError) {
    console.error('❌ Erro ao buscar fornecedores do banco:', fetchError.message);
    process.exit(1);
}

console.log(`🗄️  Fornecedores no banco: ${fornecedoresDB.length}\n`);

// Função para limpar CNPJ
function cleanCnpj(cnpj) {
    return String(cnpj || '').replace(/\D/g, '');
}

// Função para normalizar texto para comparação
function normalize(str) {
    return String(str || '').trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Estatísticas
let matched = 0;
let updated = 0;
let notFound = 0;
let errors = 0;
let skipped = 0;

// Para cada linha do Excel, encontrar o fornecedor correspondente no banco e atualizar
for (const row of rows) {
    // Mapear colunas do Excel (flexível para variações de nome)
    const razaoSocial = String(row['RAZÃO SOCIAL'] || row['RAZAO SOCIAL'] || row['razao_social'] || '').trim();
    const contato = String(row['CONTATO'] || row['contato'] || '').trim();
    const fone = String(row['FONE'] || row['TELEFONE'] || row['fone'] || '').trim();
    const whatsapp = String(row['WHATSAPP'] || row['whatsapp'] || '').trim();
    const email = String(row['EMAIL'] || row['email'] || '').trim();
    const cnpj = String(row['CNPJ'] || row['cnpj'] || '').trim();
    const inscEstadual = String(row['INSC. ESTADUAL'] || row['INSCRICAO ESTADUAL'] || row['inscricao_estadual'] || '').trim();
    const endereco = String(row['ENDEREÇO'] || row['ENDERECO'] || row['endereco'] || '').trim();
    const numero = String(row['NUMERO'] || row['NÚMERO'] || row['numero'] || '').trim();
    const bairro = String(row['BAIRRO'] || row['bairro'] || '').trim();
    const cidade = String(row['CIDADE'] || row['cidade'] || '').trim();
    const estado = String(row['ESTADO'] || row['estado'] || '').trim();
    const cep = String(row['CEP'] || row['cep'] || '').trim();
    const cartaoRaw = String(row['CARTÃO DE CRÉDITO'] || row['CARTAO DE CREDITO'] || row['cartao_credito'] || '').trim();
    const cartaoCredito = cartaoRaw.toUpperCase() === 'SIM' || cartaoRaw === '1' || cartaoRaw.toUpperCase() === 'S' || cartaoRaw.toUpperCase() === 'TRUE';

    if (!razaoSocial) {
        skipped++;
        continue;
    }

    // Encontrar fornecedor no banco - match por CNPJ ou razão social
    let fornecedorDB = null;

    // Primeiro tentar match por CNPJ
    if (cnpj) {
        const cleanedCnpj = cleanCnpj(cnpj);
        fornecedorDB = fornecedoresDB.find(f => cleanCnpj(f.cnpj) === cleanedCnpj && cleanedCnpj.length >= 11);
    }

    // Se não encontrou por CNPJ, tentar por razão social
    if (!fornecedorDB) {
        const normalizedRazao = normalize(razaoSocial);
        fornecedorDB = fornecedoresDB.find(f => normalize(f.razao_social) === normalizedRazao);
    }

    // Se ainda não encontrou, tentar por email
    if (!fornecedorDB && email) {
        fornecedorDB = fornecedoresDB.find(f => f.email && f.email.toLowerCase() === email.toLowerCase());
    }

    if (!fornecedorDB) {
        notFound++;
        console.log(`⚠️  NÃO ENCONTRADO: ${razaoSocial} (CNPJ: ${cnpj || 'N/A'}, Email: ${email || 'N/A'})`);
        continue;
    }

    matched++;

    // Preparar dados para atualização - só atualizar campos que estão vazios no banco OU que vieram preenchidos no Excel
    const updateData = {};

    // Contato - atualizar se Excel tem valor e banco está vazio
    if (contato && !fornecedorDB.contato) {
        updateData.contato = contato;
    }

    // Telefone
    if (fone && !fornecedorDB.telefone) {
        updateData.telefone = fone;
    }

    // WhatsApp
    if (whatsapp && !fornecedorDB.whatsapp) {
        updateData.whatsapp = whatsapp;
    }

    // Cartão de crédito
    if (cartaoRaw && !fornecedorDB.cartao_credito && cartaoCredito) {
        updateData.cartao_credito = true;
    }

    // Inscrição Estadual
    if (inscEstadual && !fornecedorDB.inscricao_estadual) {
        updateData.inscricao_estadual = inscEstadual;
    }

    // Endereço (só se banco está vazio)
    if (endereco && !fornecedorDB.logradouro) {
        updateData.logradouro = endereco;
    }
    if (numero && !fornecedorDB.numero) {
        updateData.numero = numero;
    }
    if (bairro && !fornecedorDB.bairro) {
        updateData.bairro = bairro;
    }
    if (cidade && !fornecedorDB.cidade) {
        updateData.cidade = cidade;
    }
    if (estado && !fornecedorDB.estado) {
        updateData.estado = estado;
    }
    if (cep && !fornecedorDB.cep) {
        updateData.cep = cep;
    }

    // Email (só se banco está vazio)
    if (email && !fornecedorDB.email) {
        updateData.email = email;
    }

    // Se nada para atualizar, pular
    if (Object.keys(updateData).length === 0) {
        // console.log(`  ✓ ${razaoSocial} - já atualizado`);
        continue;
    }

    // Atualizar timestamp
    updateData.updated_at = new Date().toISOString();

    // Atualizar no banco
    const { error: updateError } = await supabase
        .from('fornecedores')
        .update(updateData)
        .eq('id', fornecedorDB.id);

    if (updateError) {
        errors++;
        console.log(`❌ ERRO ao atualizar ${razaoSocial}: ${updateError.message}`);
    } else {
        updated++;
        const campos = Object.keys(updateData).filter(k => k !== 'updated_at').join(', ');
        console.log(`✅ ${razaoSocial} → ${campos}`);
    }
}

console.log('\n' + '='.repeat(60));
console.log('📊 RESUMO DA IMPORTAÇÃO');
console.log('='.repeat(60));
console.log(`📄 Linhas no Excel:        ${rows.length}`);
console.log(`🔗 Encontrados no banco:   ${matched}`);
console.log(`✅ Atualizados:            ${updated}`);
console.log(`⚠️  Não encontrados:        ${notFound}`);
console.log(`⏭️  Sem razão social:       ${skipped}`);
console.log(`❌ Erros:                  ${errors}`);
console.log('='.repeat(60));

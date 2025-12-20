#!/usr/bin/env tsx

/**
 * Script para IMPORTAR fornecedores do CSV para o Firestore
 * Execute: npx tsx scripts/importFornecedores.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, writeBatch, doc } from 'firebase/firestore';
import { readFileSync } from 'fs';

// Carregar .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Configuração do Firebase
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

interface Fornecedor {
    codigo: string;
    razaoSocial: string;
    codigoGrupo: string;
    grupoInsumos: string;
    contato: string;
    fone: string;
    whatsapp: string;
    email: string;
    cnpj: string;
    inscricaoEstadual: string;
    endereco: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
    cartaoCredito: boolean;
}

async function importFornecedores() {
    console.log('📥 Iniciando importação de fornecedores...\n');

    // Validar variáveis de ambiente
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        console.error('❌ Erro: Variáveis de ambiente do Firebase não configuradas!');
        process.exit(1);
    }

    // Inicializar Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    try {
        // Ler o arquivo CSV
        const csvPath = resolve(process.cwd(), 'Fornecedores.csv');
        const csvContent = readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n');

        // Remover header
        lines.shift();

        const fornecedores: Fornecedor[] = [];
        const fornecedoresMap = new Map<string, Fornecedor>();

        // Processar cada linha
        for (const line of lines) {
            if (!line.trim()) continue;

            const fields = line.split(';');
            if (fields.length < 17) continue;

            const fornecedor: Fornecedor = {
                codigo: fields[0]?.trim() || '',
                razaoSocial: fields[1]?.trim() || '',
                codigoGrupo: fields[2]?.trim() || '',
                grupoInsumos: fields[3]?.trim() || '',
                contato: fields[4]?.trim() || '',
                fone: fields[5]?.trim() || '',
                whatsapp: fields[6]?.trim() || '',
                email: fields[7]?.trim() || '',
                cnpj: fields[8]?.trim() || '',
                inscricaoEstadual: fields[9]?.trim() || '',
                endereco: fields[10]?.trim() || '',
                numero: fields[11]?.trim() || '',
                bairro: fields[12]?.trim() || '',
                cidade: fields[13]?.trim() || '',
                estado: fields[14]?.trim() || '',
                cep: fields[15]?.trim() || '',
                cartaoCredito: fields[16]?.trim().toUpperCase() === 'SIM',
            };

            // Agrupar por CNPJ ou código (alguns não têm CNPJ)
            const key = fornecedor.cnpj || fornecedor.codigo;

            if (fornecedoresMap.has(key)) {
                // Fornecedor já existe, adicionar grupo de insumos
                const existing = fornecedoresMap.get(key)!;
                if (!existing.grupoInsumos.includes(fornecedor.grupoInsumos)) {
                    existing.grupoInsumos += `, ${fornecedor.grupoInsumos}`;
                }
            } else {
                fornecedoresMap.set(key, fornecedor);
            }
        }

        const fornecedoresUnicos = Array.from(fornecedoresMap.values());
        console.log(`📊 Total de fornecedores únicos: ${fornecedoresUnicos.length}\n`);

        // Inserir em batches de 500
        const batchSize = 500;
        let count = 0;

        for (let i = 0; i < fornecedoresUnicos.length; i += batchSize) {
            const batch = writeBatch(db);
            const chunk = fornecedoresUnicos.slice(i, i + batchSize);

            for (const fornecedor of chunk) {
                const docId = `F${fornecedor.codigo.padStart(4, '0')}`;
                const docRef = doc(collection(db, 'fornecedores'), docId);

                batch.set(docRef, {
                    ...fornecedor,
                    ativo: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                count++;
            }

            await batch.commit();
            console.log(`✅ Importados ${Math.min(i + batchSize, fornecedoresUnicos.length)} de ${fornecedoresUnicos.length} fornecedores`);
        }

        console.log(`\n✅ Importação concluída! ${count} fornecedores adicionados ao Firestore.`);
        console.log('💡 Coleção: fornecedores\n');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao importar fornecedores:', error);
        process.exit(1);
    }
}

importFornecedores();

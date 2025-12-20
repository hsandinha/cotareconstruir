#!/usr/bin/env tsx

/**
 * Script para IMPORTAR fornecedores do CSV para o Firestore usando Admin SDK
 * Execute: npx tsx scripts/importFornecedoresAdmin.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Carregar .env.local
config({ path: resolve(process.cwd(), '.env.local') });

// Configuração do Firebase Admin
const serviceAccount = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

const app = initializeApp({
    credential: cert(serviceAccount as any),
});

const db = getFirestore(app);

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
    try {
        console.log('📥 Iniciando importação de fornecedores...\n');

        // Ler o CSV
        const csvPath = resolve(process.cwd(), 'Fornecedores.csv');
        const csvContent = readFileSync(csvPath, 'utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());

        // Remover cabeçalho
        lines.shift();

        // Map para armazenar fornecedores únicos (por CNPJ ou Codigo)
        const fornecedoresMap = new Map<string, Fornecedor & { grupos: Set<string> }>();

        // Processar cada linha
        for (const line of lines) {
            const fields = line.split(';');
            if (fields.length < 17) continue;

            const [
                codigo,
                razaoSocial,
                codigoGrupo,
                grupoInsumos,
                contato,
                fone,
                whatsapp,
                email,
                cnpj,
                inscricaoEstadual,
                endereco,
                numero,
                bairro,
                cidade,
                estado,
                cep,
                cartaoCredito
            ] = fields.map(f => f.trim());

            // Usar CNPJ como chave única, ou codigo se CNPJ estiver vazio
            const chave = cnpj || codigo;

            if (fornecedoresMap.has(chave)) {
                // Fornecedor já existe, adicionar grupo
                const existing = fornecedoresMap.get(chave)!;
                if (grupoInsumos) {
                    existing.grupos.add(grupoInsumos);
                }
            } else {
                // Novo fornecedor
                fornecedoresMap.set(chave, {
                    codigo,
                    razaoSocial,
                    codigoGrupo,
                    grupoInsumos: '',
                    contato,
                    fone,
                    whatsapp,
                    email,
                    cnpj,
                    inscricaoEstadual,
                    endereco,
                    numero,
                    bairro,
                    cidade,
                    estado,
                    cep,
                    cartaoCredito: cartaoCredito.toUpperCase() === 'SIM',
                    grupos: new Set(grupoInsumos ? [grupoInsumos] : [])
                });
            }
        }

        console.log(`📊 Total de fornecedores únicos: ${fornecedoresMap.size}\n`);

        // Converter para array e concatenar grupos
        const fornecedores = Array.from(fornecedoresMap.values()).map((f, index) => {
            const { grupos, ...rest } = f;
            return {
                ...rest,
                grupoInsumos: Array.from(grupos).join(', '),
                id: `F${String(index + 1).padStart(4, '0')}`, // F0001, F0002, etc.
            };
        });

        // Importar em batches (Firestore limita a 500 documentos por batch)
        const batchSize = 500;
        for (let i = 0; i < fornecedores.length; i += batchSize) {
            const batch = db.batch();
            const batchFornecedores = fornecedores.slice(i, i + batchSize);

            for (const fornecedor of batchFornecedores) {
                const docRef = db.collection('fornecedores').doc(fornecedor.id);
                batch.set(docRef, {
                    ...fornecedor,
                    ativo: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }

            await batch.commit();
            console.log(`✅ Importados ${Math.min((i + 1) * batchSize, fornecedores.length)}/${fornecedores.length} fornecedores`);
        }

        console.log('\n✅ Importação concluída com sucesso!');
        console.log(`📦 Total de fornecedores importados: ${fornecedores.length}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao importar fornecedores:', error);
        process.exit(1);
    }
}

importFornecedores();

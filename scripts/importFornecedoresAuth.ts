#!/usr/bin/env tsx

/**
 * Script alternativo para importar fornecedores com autenticação admin
 * Execute com as credenciais de admin configuradas
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
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

        // Autenticar como admin
        console.log('🔐 Autenticando...');

        // Tentar pegar credenciais dos argumentos ou variáveis de ambiente
        const email = process.argv[2] || process.env.ADMIN_EMAIL;
        const password = process.argv[3] || process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            console.error('\n❌ Credenciais de administrador não fornecidas!\n');
            console.error('Opção 1 - Via argumentos:');
            console.error('   npx tsx scripts/importFornecedoresAuth.ts seu-email@dominio.com sua-senha-real\n');
            console.error('Opção 2 - Via variáveis de ambiente (.env.local):');
            console.error('   Adicione ao .env.local:');
            console.error('   ADMIN_EMAIL=seu-email@dominio.com');
            console.error('   ADMIN_PASSWORD=sua-senha-real\n');
            console.error('⚠️  IMPORTANTE: Use suas credenciais REAIS de administrador, não os exemplos acima!\n');
            process.exit(1);
        }

        // Validar que não são as credenciais de exemplo
        if (email.includes('seu-email') || email.includes('@admin.com') || password === 'sua-senha') {
            console.error('\n❌ Você está usando credenciais de EXEMPLO!\n');
            console.error('Por favor, substitua por suas credenciais REAIS de administrador.');
            console.error('Exemplo: npx tsx scripts/importFornecedoresAuth.ts hebert@exemplo.com MinhaS3nh@R3al\n');
            process.exit(1);
        }

        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Autenticado com sucesso!\n');

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
            const batch = writeBatch(db);
            const batchFornecedores = fornecedores.slice(i, i + batchSize);

            for (const fornecedor of batchFornecedores) {
                const docRef = doc(collection(db, 'fornecedores'), fornecedor.id);
                batch.set(docRef, {
                    ...fornecedor,
                    ativo: true,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
            }

            await batch.commit();
            console.log(`✅ Importados ${Math.min(i + batchSize, fornecedores.length)}/${fornecedores.length} fornecedores`);
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

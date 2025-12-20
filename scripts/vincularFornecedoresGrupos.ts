#!/usr/bin/env tsx

/**
 * Script para vincular fornecedores aos grupos de insumos
 * Converte o campo grupoInsumos (texto) em grupoInsumoIds (array de IDs)
 * Execute: npx tsx scripts/vincularFornecedoresGrupos.ts seu-email@dominio.com sua-senha
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

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
    id: string;
    grupoInsumos?: string;
    [key: string]: any;
}

async function vincularFornecedores() {
    try {
        console.log('🔗 Iniciando vinculação de fornecedores aos grupos...\n');

        // Autenticar
        console.log('🔐 Autenticando...');
        const email = process.argv[2] || process.env.ADMIN_EMAIL;
        const password = process.argv[3] || process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            console.error('\n❌ Credenciais não fornecidas!');
            console.error('Execute: npx tsx scripts/vincularFornecedoresGrupos.ts seu-email@dominio.com sua-senha\n');
            process.exit(1);
        }

        if (email.includes('seu-email') || password === 'sua-senha') {
            console.error('\n❌ Use suas credenciais REAIS!\n');
            process.exit(1);
        }

        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Autenticado!\n');

        // Carregar grupos de insumos
        console.log('📦 Carregando grupos de insumos...');
        const gruposSnap = await getDocs(collection(db, 'grupos_insumo'));
        const gruposMap = new Map<string, string>(); // nome → id

        gruposSnap.forEach(doc => {
            const nome = doc.data().nome;
            gruposMap.set(nome.toLowerCase().trim(), doc.id);
        });

        console.log(`   ${gruposMap.size} grupos encontrados\n`);

        // Carregar fornecedores
        console.log('🏢 Carregando fornecedores...');
        const fornecedoresSnap = await getDocs(collection(db, 'fornecedores'));
        const fornecedores: Fornecedor[] = fornecedoresSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`   ${fornecedores.length} fornecedores encontrados\n`);

        // Processar vinculações
        console.log('🔄 Processando vinculações...\n');

        let processados = 0;
        let vinculados = 0;
        let naoEncontrados = new Set<string>();

        const batchSize = 500;
        for (let i = 0; i < fornecedores.length; i += batchSize) {
            const batch = writeBatch(db);
            const batchFornecedores = fornecedores.slice(i, i + batchSize);

            for (const fornecedor of batchFornecedores) {
                processados++;

                // Pegar o campo grupoInsumos (texto)
                const grupoInsumos = fornecedor.grupoInsumos || '';

                if (!grupoInsumos) {
                    continue;
                }

                // Separar por vírgula e limpar
                const nomesGrupos = grupoInsumos
                    .split(',')
                    .map((g: string) => g.trim())
                    .filter((g: string) => g);

                // Buscar IDs correspondentes
                const grupoIds: string[] = [];

                for (const nomeGrupo of nomesGrupos) {
                    const grupoId = gruposMap.get(nomeGrupo.toLowerCase().trim());

                    if (grupoId) {
                        grupoIds.push(grupoId);
                    } else {
                        naoEncontrados.add(nomeGrupo);
                    }
                }

                // Atualizar fornecedor se encontrou algum grupo
                if (grupoIds.length > 0) {
                    const fornecedorRef = doc(db, 'fornecedores', fornecedor.id);
                    batch.update(fornecedorRef, {
                        grupoInsumoIds: grupoIds,
                        updatedAt: new Date()
                    });
                    vinculados++;
                }
            }

            await batch.commit();
            console.log(`   Processados ${Math.min(i + batchSize, fornecedores.length)}/${fornecedores.length}`);
        }

        console.log('\n✅ Vinculação concluída!');
        console.log(`📊 Fornecedores processados: ${processados}`);
        console.log(`🔗 Fornecedores vinculados: ${vinculados}`);

        if (naoEncontrados.size > 0) {
            console.log(`\n⚠️  Grupos não encontrados no banco (${naoEncontrados.size}):`);
            Array.from(naoEncontrados).sort().forEach((nome, i) => {
                if (i < 20) { // Mostrar apenas os primeiros 20
                    console.log(`   - ${nome}`);
                }
            });
            if (naoEncontrados.size > 20) {
                console.log(`   ... e mais ${naoEncontrados.size - 20}`);
            }
            console.log('\n💡 Dica: Execute o script importGruposInsumo.ts para adicionar esses grupos ao banco.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro ao vincular fornecedores:', error);
        process.exit(1);
    }
}

vincularFornecedores();

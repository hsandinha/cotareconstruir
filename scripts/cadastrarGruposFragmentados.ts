#!/usr/bin/env tsx

/**
 * Script para cadastrar os 23 grupos fragmentados encontrados
 * Execute: npx tsx scripts/cadastrarGruposFragmentados.ts seu-email@dominio.com sua-senha
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

// Grupos fragmentados identificados
const GRUPOS_FRAGMENTADOS = [
    "ACESSÓRIOS E POLICARBONATO",
    "ARTEFATO DE AÇO INOX / Chapa",
    "BERMUDA",
    "CATRACA",
    "ELÉTRICA",
    "GRAMA ESMERALDA",
    "LOCAÇÃO Andaime Balacin",
    "MÁQUINA E EQUIPAMENTO (cabo de aço",
    "PAPELÃO",
    "PISCINA",
    "PLÁSTICO BOLHA",
    "RELOGIO DE PONTO",
    "SAUNA E BANHEIRA",
    "SPA",
    "SÃO CARLOS",
    "TELEFONE E LÓGICA",
    "TELEFONE E LÓGICA (SERVIÇOS)",
    "ZEON",
    "cordas de poliamida)",
    "corrente",
    "fita de amarração e elevação normatizada",
    "mini grua",
    "tubo e outros"
];

async function cadastrarGrupos() {
    try {
        console.log('📝 Cadastrando grupos fragmentados...\n');

        // Autenticar
        const email = process.argv[2] || process.env.ADMIN_EMAIL;
        const password = process.argv[3] || process.env.ADMIN_PASSWORD;

        if (!email || !password) {
            console.error('\n❌ Credenciais não fornecidas!');
            process.exit(1);
        }

        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Autenticado!\n');

        // Carregar grupos existentes
        const gruposSnap = await getDocs(collection(db, 'grupos_insumo'));
        const gruposExistentes = new Set<string>();
        let ultimoId = 0;

        gruposSnap.forEach(doc => {
            const nome = doc.data().nome;
            gruposExistentes.add(nome.toLowerCase().trim());

            const match = doc.id.match(/GI(\d+)/);
            if (match) {
                const num = parseInt(match[1]);
                if (num > ultimoId) {
                    ultimoId = num;
                }
            }
        });

        console.log(`📦 Grupos existentes: ${gruposExistentes.size}`);
        console.log(`🔢 Último ID: GI${String(ultimoId).padStart(4, '0')}\n`);

        // Filtrar apenas grupos que ainda não existem
        const gruposParaCadastrar = GRUPOS_FRAGMENTADOS.filter(
            grupo => !gruposExistentes.has(grupo.toLowerCase().trim())
        );

        if (gruposParaCadastrar.length === 0) {
            console.log('✅ Todos os grupos fragmentados já estão cadastrados!');
            process.exit(0);
        }

        console.log(`➕ Cadastrando ${gruposParaCadastrar.length} grupos:\n`);
        gruposParaCadastrar.forEach((grupo, i) => {
            console.log(`   ${i + 1}. ${grupo}`);
        });

        // Cadastrar em batch
        const batch = writeBatch(db);
        let contador = ultimoId;

        gruposParaCadastrar.forEach((grupo) => {
            contador++;
            const id = `GI${String(contador).padStart(4, '0')}`;
            const docRef = doc(db, 'grupos_insumo', id);

            batch.set(docRef, {
                nome: grupo,
                descricao: `Grupo de insumos: ${grupo}`,
                ativo: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        });

        await batch.commit();

        console.log('\n✅ Grupos cadastrados com sucesso!');
        console.log(`📊 Novos grupos: ${gruposParaCadastrar.length}`);
        console.log(`📈 Total no sistema: ${gruposExistentes.size + gruposParaCadastrar.length}\n`);

        console.log('💡 Execute a vinculação novamente:');
        console.log(`   npx tsx scripts/vincularFornecedoresGrupos.ts ${email} ${password}\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

cadastrarGrupos();

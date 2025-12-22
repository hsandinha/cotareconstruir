/**
 * Script para verificar e corrigir vínculos entre usuários, clientes e fornecedores
 * 
 * Este script:
 * 1. Busca todos os usuários com roles 'cliente' ou 'fornecedor'
 * 2. Verifica se existe cadastro correspondente na tabela clientes/fornecedores
 * 3. Se existir pelo email, cria o vínculo automaticamente
 * 4. Se não existir, marca como pendingProfile para solicitar cadastro
 * 
 * Execute com: npx ts-node scripts/corrigirVinculosUsuarios.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as path from 'path';

// Inicializar Firebase Admin
const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');

if (getApps().length === 0) {
    try {
        const serviceAccount = require(serviceAccountPath);
        initializeApp({
            credential: cert(serviceAccount)
        });
    } catch (error) {
        console.error('❌ Erro ao carregar serviceAccountKey.json');
        console.log('Por favor, baixe o arquivo de credenciais do Firebase Console:');
        console.log('1. Acesse: Firebase Console > Project Settings > Service Accounts');
        console.log('2. Clique em "Generate new private key"');
        console.log('3. Salve como serviceAccountKey.json na raiz do projeto');
        process.exit(1);
    }
}

const db = getFirestore();

interface User {
    id: string;
    email: string;
    name?: string;
    companyName?: string;
    role?: string;
    roles?: string[];
    clienteId?: string;
    fornecedorId?: string;
    pendingClienteProfile?: boolean;
    pendingFornecedorProfile?: boolean;
}

interface Cliente {
    id: string;
    email: string;
    nome: string;
    userId?: string;
}

interface Fornecedor {
    id: string;
    email: string;
    razaoSocial: string;
    userId?: string;
}

async function corrigirVinculos() {
    console.log('🔄 Iniciando correção de vínculos...\n');

    // Buscar todos os usuários
    const usersSnapshot = await db.collection('users').get();
    const users: User[] = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as User));

    console.log(`📊 Total de usuários: ${users.length}`);

    // Buscar todos os clientes
    const clientesSnapshot = await db.collection('clientes').get();
    const clientes: Cliente[] = clientesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Cliente));

    console.log(`📊 Total de clientes: ${clientes.length}`);

    // Buscar todos os fornecedores
    const fornecedoresSnapshot = await db.collection('fornecedores').get();
    const fornecedores: Fornecedor[] = fornecedoresSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    } as Fornecedor));

    console.log(`📊 Total de fornecedores: ${fornecedores.length}\n`);

    // Criar mapas para busca rápida por email
    const clientesByEmail = new Map<string, Cliente>();
    clientes.forEach(c => {
        if (c.email) clientesByEmail.set(c.email.toLowerCase(), c);
    });

    const fornecedoresByEmail = new Map<string, Fornecedor>();
    fornecedores.forEach(f => {
        if (f.email) fornecedoresByEmail.set(f.email.toLowerCase(), f);
    });

    let corrigidos = 0;
    let pendentes = 0;
    let jaVinculados = 0;

    for (const user of users) {
        const roles = user.roles || (user.role ? [user.role] : []);
        const email = user.email?.toLowerCase();

        if (!email) continue;

        const updates: any = {};

        // Verificar vínculo de CLIENTE
        if (roles.includes('cliente')) {
            if (user.clienteId) {
                // Já tem vínculo, verificar se o cliente existe
                const clienteDoc = await db.collection('clientes').doc(user.clienteId).get();
                if (clienteDoc.exists) {
                    console.log(`✅ ${user.email} - Cliente já vinculado (${user.clienteId})`);
                    jaVinculados++;
                } else {
                    // Cliente não existe, buscar por email
                    const clienteByEmail = clientesByEmail.get(email);
                    if (clienteByEmail) {
                        updates.clienteId = clienteByEmail.id;
                        updates.pendingClienteProfile = false;
                        // Atualizar o cliente com o userId
                        await db.collection('clientes').doc(clienteByEmail.id).update({
                            userId: user.id,
                            hasUserAccount: true
                        });
                        console.log(`🔗 ${user.email} - Vínculo de cliente corrigido (${clienteByEmail.id})`);
                        corrigidos++;
                    } else {
                        updates.clienteId = null;
                        updates.pendingClienteProfile = true;
                        console.log(`⚠️  ${user.email} - Cadastro de cliente PENDENTE`);
                        pendentes++;
                    }
                }
            } else {
                // Não tem vínculo, buscar por email
                const clienteByEmail = clientesByEmail.get(email);
                if (clienteByEmail) {
                    updates.clienteId = clienteByEmail.id;
                    updates.pendingClienteProfile = false;
                    // Atualizar o cliente com o userId
                    await db.collection('clientes').doc(clienteByEmail.id).update({
                        userId: user.id,
                        hasUserAccount: true
                    });
                    console.log(`🔗 ${user.email} - Cliente vinculado por email (${clienteByEmail.id})`);
                    corrigidos++;
                } else {
                    updates.pendingClienteProfile = true;
                    console.log(`⚠️  ${user.email} - Cadastro de cliente PENDENTE`);
                    pendentes++;
                }
            }
        } else {
            // Remover flags de cliente se não tem mais o role
            if (user.clienteId || user.pendingClienteProfile) {
                updates.clienteId = null;
                updates.pendingClienteProfile = false;
            }
        }

        // Verificar vínculo de FORNECEDOR
        if (roles.includes('fornecedor')) {
            if (user.fornecedorId) {
                // Já tem vínculo, verificar se o fornecedor existe
                const fornecedorDoc = await db.collection('fornecedores').doc(user.fornecedorId).get();
                if (fornecedorDoc.exists) {
                    console.log(`✅ ${user.email} - Fornecedor já vinculado (${user.fornecedorId})`);
                    jaVinculados++;
                } else {
                    // Fornecedor não existe, buscar por email
                    const fornecedorByEmail = fornecedoresByEmail.get(email);
                    if (fornecedorByEmail) {
                        updates.fornecedorId = fornecedorByEmail.id;
                        updates.pendingFornecedorProfile = false;
                        // Atualizar o fornecedor com o userId
                        await db.collection('fornecedores').doc(fornecedorByEmail.id).update({
                            userId: user.id,
                            hasUserAccount: true
                        });
                        console.log(`🔗 ${user.email} - Vínculo de fornecedor corrigido (${fornecedorByEmail.id})`);
                        corrigidos++;
                    } else {
                        updates.fornecedorId = null;
                        updates.pendingFornecedorProfile = true;
                        console.log(`⚠️  ${user.email} - Cadastro de fornecedor PENDENTE`);
                        pendentes++;
                    }
                }
            } else {
                // Não tem vínculo, buscar por email
                const fornecedorByEmail = fornecedoresByEmail.get(email);
                if (fornecedorByEmail) {
                    updates.fornecedorId = fornecedorByEmail.id;
                    updates.pendingFornecedorProfile = false;
                    // Atualizar o fornecedor com o userId
                    await db.collection('fornecedores').doc(fornecedorByEmail.id).update({
                        userId: user.id,
                        hasUserAccount: true
                    });
                    console.log(`🔗 ${user.email} - Fornecedor vinculado por email (${fornecedorByEmail.id})`);
                    corrigidos++;
                } else {
                    updates.pendingFornecedorProfile = true;
                    console.log(`⚠️  ${user.email} - Cadastro de fornecedor PENDENTE`);
                    pendentes++;
                }
            }
        } else {
            // Remover flags de fornecedor se não tem mais o role
            if (user.fornecedorId || user.pendingFornecedorProfile) {
                updates.fornecedorId = null;
                updates.pendingFornecedorProfile = false;
            }
        }

        // Aplicar atualizações se houver
        if (Object.keys(updates).length > 0) {
            await db.collection('users').doc(user.id).update(updates);
        }
    }

    console.log('\n========================================');
    console.log('📊 RESUMO DA CORREÇÃO');
    console.log('========================================');
    console.log(`✅ Já vinculados corretamente: ${jaVinculados}`);
    console.log(`🔗 Vínculos corrigidos: ${corrigidos}`);
    console.log(`⚠️  Cadastros pendentes: ${pendentes}`);
    console.log('========================================\n');

    console.log('✨ Correção concluída!');
    console.log('Os usuários com cadastro pendente verão um modal para completar seus dados ao acessar o sistema.');
}

// Executar
corrigirVinculos()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Erro:', error);
        process.exit(1);
    });

/**
 * INSTRUÇÕES PARA EXECUTAR ESTE SCRIPT
 * 
 * 1. Faça login como administrador no sistema (localhost:3000/dashboard/admin)
 * 2. Abra o Console do navegador (F12 ou Cmd+Option+I no Mac)
 * 3. Cole e execute o código abaixo no Console
 * 
 * Este script irá:
 * - Verificar todos os usuários com roles 'cliente' ou 'fornecedor'
 * - Buscar se existe cadastro correspondente na tabela clientes/fornecedores
 * - Se existir pelo email, criar o vínculo automaticamente
 * - Se não existir, marcar como pendingProfile para solicitar cadastro
 */

// Cole o código abaixo no Console do navegador:

const corrigirVinculos = async () => {
    // Importar do Firebase que já está carregado na página
    const { collection, getDocs, doc, updateDoc, getDoc, getFirestore } = await import('firebase/firestore');
    const db = getFirestore();

    console.log('🔄 Iniciando correção de vínculos...\n');

    // Buscar todos os usuários
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    console.log(`📊 Total de usuários: ${users.length}`);

    // Buscar todos os clientes
    const clientesSnapshot = await getDocs(collection(db, 'clientes'));
    const clientes = clientesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    console.log(`📊 Total de clientes: ${clientes.length}`);

    // Buscar todos os fornecedores
    const fornecedoresSnapshot = await getDocs(collection(db, 'fornecedores'));
    const fornecedores = fornecedoresSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));

    console.log(`📊 Total de fornecedores: ${fornecedores.length}\n`);

    // Criar mapas para busca rápida por email
    const clientesByEmail = new Map();
    clientes.forEach(c => {
        if (c.email) clientesByEmail.set(c.email.toLowerCase(), c);
    });

    const fornecedoresByEmail = new Map();
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

        const updates = {};

        // Verificar vínculo de CLIENTE
        if (roles.includes('cliente')) {
            if (user.clienteId) {
                // Já tem vínculo, verificar se o cliente existe
                const clienteDoc = await getDoc(doc(db, 'clientes', user.clienteId));
                if (clienteDoc.exists()) {
                    console.log(`✅ ${user.email} - Cliente já vinculado (${user.clienteId})`);
                    jaVinculados++;
                } else {
                    // Cliente não existe, buscar por email
                    const clienteByEmail = clientesByEmail.get(email);
                    if (clienteByEmail) {
                        updates.clienteId = clienteByEmail.id;
                        updates.pendingClienteProfile = false;
                        await updateDoc(doc(db, 'clientes', clienteByEmail.id), {
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
                    await updateDoc(doc(db, 'clientes', clienteByEmail.id), {
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
        }

        // Verificar vínculo de FORNECEDOR
        if (roles.includes('fornecedor')) {
            if (user.fornecedorId) {
                // Já tem vínculo, verificar se o fornecedor existe
                const fornecedorDoc = await getDoc(doc(db, 'fornecedores', user.fornecedorId));
                if (fornecedorDoc.exists()) {
                    console.log(`✅ ${user.email} - Fornecedor já vinculado (${user.fornecedorId})`);
                    jaVinculados++;
                } else {
                    // Fornecedor não existe, buscar por email
                    const fornecedorByEmail = fornecedoresByEmail.get(email);
                    if (fornecedorByEmail) {
                        updates.fornecedorId = fornecedorByEmail.id;
                        updates.pendingFornecedorProfile = false;
                        await updateDoc(doc(db, 'fornecedores', fornecedorByEmail.id), {
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
                    await updateDoc(doc(db, 'fornecedores', fornecedorByEmail.id), {
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
        }

        // Aplicar atualizações se houver
        if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'users', user.id), updates);
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

    return { jaVinculados, corrigidos, pendentes };
};

// Executar
corrigirVinculos();

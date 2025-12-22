import { db } from './firebase';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    where,
    getDocs,
    serverTimestamp
} from 'firebase/firestore';

/**
 * Serviço para gerenciar vínculos entre usuários (users), clientes e fornecedores.
 * 
 * Fluxo:
 * 1. Admin atribui perfil "cliente" ou "fornecedor" a um usuário
 * 2. Sistema verifica se já existe cadastro na tabela correspondente
 * 3. Se não existir, marca como pendingProfileCompletion
 * 4. Usuário é direcionado a completar o cadastro no próximo acesso
 */

export interface ProfileLinkStatus {
    hasClienteProfile: boolean;
    hasFornecedorProfile: boolean;
    clienteId?: string;
    fornecedorId?: string;
    pendingClienteProfile: boolean;
    pendingFornecedorProfile: boolean;
}

export interface ClienteMinimalData {
    nome: string;
    email: string;
    telefone?: string;
    cpf?: string;
    cnpj?: string;
    cidade?: string;
    estado?: string;
    endereco?: string;
    bairro?: string;
    cep?: string;
}

export interface FornecedorMinimalData {
    razaoSocial: string;
    email: string;
    cnpj?: string;
    telefone?: string;
    whatsapp?: string;
    cidade?: string;
    estado?: string;
    endereco?: string;
    bairro?: string;
    cep?: string;
}

/**
 * Verifica o status de vínculo de perfil do usuário
 */
export async function checkProfileLinkStatus(userId: string): Promise<ProfileLinkStatus> {
    const result: ProfileLinkStatus = {
        hasClienteProfile: false,
        hasFornecedorProfile: false,
        pendingClienteProfile: false,
        pendingFornecedorProfile: false
    };

    try {
        // Buscar dados do usuário
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) return result;

        const userData = userDoc.data();
        const roles = userData.roles || (userData.role ? [userData.role] : []);

        // Verificar se tem role de cliente
        if (roles.includes('cliente')) {
            // Verificar se já tem clienteId vinculado
            if (userData.clienteId) {
                const clienteDoc = await getDoc(doc(db, 'clientes', userData.clienteId));
                result.hasClienteProfile = clienteDoc.exists();
                result.clienteId = userData.clienteId;
            } else {
                // Buscar por email na tabela clientes
                const clienteQuery = query(
                    collection(db, 'clientes'),
                    where('email', '==', userData.email)
                );
                const clienteSnap = await getDocs(clienteQuery);

                if (!clienteSnap.empty) {
                    result.hasClienteProfile = true;
                    result.clienteId = clienteSnap.docs[0].id;
                    // Atualizar o vínculo no usuário
                    await updateDoc(doc(db, 'users', userId), {
                        clienteId: clienteSnap.docs[0].id
                    });
                } else {
                    result.pendingClienteProfile = true;
                }
            }
        }

        // Verificar se tem role de fornecedor
        if (roles.includes('fornecedor')) {
            // Verificar se já tem fornecedorId vinculado
            if (userData.fornecedorId) {
                const fornecedorDoc = await getDoc(doc(db, 'fornecedores', userData.fornecedorId));
                result.hasFornecedorProfile = fornecedorDoc.exists();
                result.fornecedorId = userData.fornecedorId;
            } else {
                // Buscar por email na tabela fornecedores
                const fornecedorQuery = query(
                    collection(db, 'fornecedores'),
                    where('email', '==', userData.email)
                );
                const fornecedorSnap = await getDocs(fornecedorQuery);

                if (!fornecedorSnap.empty) {
                    result.hasFornecedorProfile = true;
                    result.fornecedorId = fornecedorSnap.docs[0].id;
                    // Atualizar o vínculo no usuário
                    await updateDoc(doc(db, 'users', userId), {
                        fornecedorId: fornecedorSnap.docs[0].id
                    });
                } else {
                    result.pendingFornecedorProfile = true;
                }
            }
        }

        return result;
    } catch (error) {
        console.error('Erro ao verificar status de perfil:', error);
        return result;
    }
}

/**
 * Cria ou atualiza vínculo de cliente quando role é atribuído
 */
export async function ensureClienteLink(userId: string, userEmail: string, userName?: string): Promise<{ success: boolean; clienteId?: string; needsCompletion: boolean }> {
    try {
        // Verificar se já existe um cliente com esse email
        const clienteQuery = query(
            collection(db, 'clientes'),
            where('email', '==', userEmail)
        );
        const clienteSnap = await getDocs(clienteQuery);

        if (!clienteSnap.empty) {
            // Vincular cliente existente ao usuário
            const clienteId = clienteSnap.docs[0].id;
            await updateDoc(doc(db, 'users', userId), {
                clienteId,
                pendingClienteProfile: false
            });

            // Atualizar o cliente com o userId
            await updateDoc(doc(db, 'clientes', clienteId), {
                userId,
                hasUserAccount: true,
                updatedAt: serverTimestamp()
            });

            return { success: true, clienteId, needsCompletion: false };
        }

        // Marcar como pendente de cadastro
        await updateDoc(doc(db, 'users', userId), {
            pendingClienteProfile: true,
            clientePreData: {
                nome: userName || '',
                email: userEmail
            }
        });

        return { success: true, needsCompletion: true };
    } catch (error) {
        console.error('Erro ao garantir vínculo de cliente:', error);
        return { success: false, needsCompletion: true };
    }
}

/**
 * Cria ou atualiza vínculo de fornecedor quando role é atribuído
 */
export async function ensureFornecedorLink(userId: string, userEmail: string, userName?: string): Promise<{ success: boolean; fornecedorId?: string; needsCompletion: boolean }> {
    try {
        // Verificar se já existe um fornecedor com esse email
        const fornecedorQuery = query(
            collection(db, 'fornecedores'),
            where('email', '==', userEmail)
        );
        const fornecedorSnap = await getDocs(fornecedorQuery);

        if (!fornecedorSnap.empty) {
            // Vincular fornecedor existente ao usuário
            const fornecedorId = fornecedorSnap.docs[0].id;
            await updateDoc(doc(db, 'users', userId), {
                fornecedorId,
                pendingFornecedorProfile: false
            });

            // Atualizar o fornecedor com o userId
            await updateDoc(doc(db, 'fornecedores', fornecedorId), {
                userId,
                hasUserAccount: true,
                updatedAt: serverTimestamp()
            });

            return { success: true, fornecedorId, needsCompletion: false };
        }

        // Marcar como pendente de cadastro
        await updateDoc(doc(db, 'users', userId), {
            pendingFornecedorProfile: true,
            fornecedorPreData: {
                razaoSocial: userName || '',
                email: userEmail
            }
        });

        return { success: true, needsCompletion: true };
    } catch (error) {
        console.error('Erro ao garantir vínculo de fornecedor:', error);
        return { success: false, needsCompletion: true };
    }
}

/**
 * Remove vínculo quando role é removido
 */
export async function removeProfileLink(userId: string, profileType: 'cliente' | 'fornecedor'): Promise<{ success: boolean }> {
    try {
        const updateData: any = {};

        if (profileType === 'cliente') {
            updateData.clienteId = null;
            updateData.pendingClienteProfile = false;
            updateData.clientePreData = null;
        } else {
            updateData.fornecedorId = null;
            updateData.pendingFornecedorProfile = false;
            updateData.fornecedorPreData = null;
        }

        await updateDoc(doc(db, 'users', userId), updateData);
        return { success: true };
    } catch (error) {
        console.error('Erro ao remover vínculo:', error);
        return { success: false };
    }
}

/**
 * Remove campos undefined de um objeto (Firebase não aceita undefined)
 */
function removeUndefined<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, value]) => value !== undefined)
    ) as Partial<T>;
}

/**
 * Completa o cadastro de cliente pendente
 */
export async function completeClienteProfile(
    userId: string,
    data: ClienteMinimalData
): Promise<{ success: boolean; clienteId?: string; error?: string }> {
    try {
        // Verificar se email já está em uso
        const existingQuery = query(
            collection(db, 'clientes'),
            where('email', '==', data.email)
        );
        const existingSnap = await getDocs(existingQuery);

        if (!existingSnap.empty) {
            // Vincular ao existente
            const clienteId = existingSnap.docs[0].id;
            await updateDoc(doc(db, 'users', userId), {
                clienteId,
                pendingClienteProfile: false,
                clientePreData: null
            });
            await updateDoc(doc(db, 'clientes', clienteId), {
                userId,
                hasUserAccount: true,
                updatedAt: serverTimestamp()
            });
            return { success: true, clienteId };
        }

        // Criar novo cliente - remover campos undefined
        const clienteRef = doc(collection(db, 'clientes'));
        const cleanData = removeUndefined(data);
        const clienteData = {
            ...cleanData,
            userId,
            hasUserAccount: true,
            ativo: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(clienteRef, clienteData);

        // Atualizar usuário com o vínculo
        await updateDoc(doc(db, 'users', userId), {
            clienteId: clienteRef.id,
            pendingClienteProfile: false,
            clientePreData: null
        });

        return { success: true, clienteId: clienteRef.id };
    } catch (error: any) {
        console.error('Erro ao completar cadastro de cliente:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Completa o cadastro de fornecedor pendente
 */
export async function completeFornecedorProfile(
    userId: string,
    data: FornecedorMinimalData
): Promise<{ success: boolean; fornecedorId?: string; error?: string }> {
    try {
        // Verificar se email já está em uso
        const existingQuery = query(
            collection(db, 'fornecedores'),
            where('email', '==', data.email)
        );
        const existingSnap = await getDocs(existingQuery);

        if (!existingSnap.empty) {
            // Vincular ao existente
            const fornecedorId = existingSnap.docs[0].id;
            await updateDoc(doc(db, 'users', userId), {
                fornecedorId,
                pendingFornecedorProfile: false,
                fornecedorPreData: null
            });
            await updateDoc(doc(db, 'fornecedores', fornecedorId), {
                userId,
                hasUserAccount: true,
                updatedAt: serverTimestamp()
            });
            return { success: true, fornecedorId };
        }

        // Criar novo fornecedor - remover campos undefined
        const fornecedorRef = doc(collection(db, 'fornecedores'));
        const cleanData = removeUndefined(data);
        const fornecedorData = {
            ...cleanData,
            userId,
            hasUserAccount: true,
            ativo: true,
            codigo: `F${Date.now()}`,
            codigoGrupo: '',
            grupoInsumos: '',
            contato: data.razaoSocial || '',
            fone: data.telefone || '',
            inscricaoEstadual: '',
            numero: '',
            cartaoCredito: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };

        await setDoc(fornecedorRef, fornecedorData);

        // Atualizar usuário com o vínculo
        await updateDoc(doc(db, 'users', userId), {
            fornecedorId: fornecedorRef.id,
            pendingFornecedorProfile: false,
            fornecedorPreData: null
        });

        return { success: true, fornecedorId: fornecedorRef.id };
    } catch (error: any) {
        console.error('Erro ao completar cadastro de fornecedor:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Gerencia a atualização de roles de forma integrada
 * Esta função deve ser chamada quando o admin atualiza os roles de um usuário
 */
export async function handleRolesUpdate(
    userId: string,
    previousRoles: string[],
    newRoles: string[],
    userEmail: string,
    userName?: string
): Promise<{
    success: boolean;
    pendingProfiles: string[];
    message?: string
}> {
    const pendingProfiles: string[] = [];

    try {
        // Roles adicionados
        const addedRoles = newRoles.filter(r => !previousRoles.includes(r));
        // Roles removidos
        const removedRoles = previousRoles.filter(r => !newRoles.includes(r));

        // Processar roles adicionados
        for (const role of addedRoles) {
            if (role === 'cliente') {
                const result = await ensureClienteLink(userId, userEmail, userName);
                if (result.needsCompletion) {
                    pendingProfiles.push('cliente');
                }
            } else if (role === 'fornecedor') {
                const result = await ensureFornecedorLink(userId, userEmail, userName);
                if (result.needsCompletion) {
                    pendingProfiles.push('fornecedor');
                }
            }
        }

        // Processar roles removidos (opcional: remover vínculos)
        for (const role of removedRoles) {
            if (role === 'cliente') {
                await removeProfileLink(userId, 'cliente');
            } else if (role === 'fornecedor') {
                await removeProfileLink(userId, 'fornecedor');
            }
        }

        let message = 'Perfis atualizados com sucesso!';
        if (pendingProfiles.length > 0) {
            message = `Perfis atualizados. O usuário precisará completar o cadastro de: ${pendingProfiles.join(', ')}.`;
        }

        return { success: true, pendingProfiles, message };
    } catch (error: any) {
        console.error('Erro ao atualizar roles:', error);
        return { success: false, pendingProfiles, message: error.message };
    }
}

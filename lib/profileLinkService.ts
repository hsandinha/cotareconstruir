import { supabase } from './supabase';

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
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (userError || !userData) return result;

        const roles = userData.roles || (userData.role ? [userData.role] : []);

        // Verificar se tem role de cliente
        if (roles.includes('cliente')) {
            // Verificar se já tem clienteId vinculado
            if (userData.cliente_id) {
                const { data: clienteData } = await supabase
                    .from('clientes')
                    .select('id')
                    .eq('id', userData.cliente_id)
                    .single();

                result.hasClienteProfile = !!clienteData;
                result.clienteId = userData.cliente_id;
            } else {
                // Buscar por email na tabela clientes
                const { data: clienteData } = await supabase
                    .from('clientes')
                    .select('id')
                    .eq('email', userData.email)
                    .limit(1);

                if (clienteData && clienteData.length > 0) {
                    result.hasClienteProfile = true;
                    result.clienteId = clienteData[0].id;
                    // Atualizar o vínculo no usuário
                    await supabase
                        .from('users')
                        .update({ cliente_id: clienteData[0].id })
                        .eq('id', userId);
                } else {
                    result.pendingClienteProfile = true;
                }
            }
        }

        // Verificar se tem role de fornecedor
        if (roles.includes('fornecedor')) {
            // Verificar se já tem fornecedorId vinculado
            if (userData.fornecedor_id) {
                const { data: fornecedorData } = await supabase
                    .from('fornecedores')
                    .select('id')
                    .eq('id', userData.fornecedor_id)
                    .single();

                result.hasFornecedorProfile = !!fornecedorData;
                result.fornecedorId = userData.fornecedor_id;
            } else {
                // Buscar por email na tabela fornecedores
                const { data: fornecedorData } = await supabase
                    .from('fornecedores')
                    .select('id')
                    .eq('email', userData.email)
                    .limit(1);

                if (fornecedorData && fornecedorData.length > 0) {
                    result.hasFornecedorProfile = true;
                    result.fornecedorId = fornecedorData[0].id;
                    // Atualizar o vínculo no usuário
                    await supabase
                        .from('users')
                        .update({ fornecedor_id: fornecedorData[0].id })
                        .eq('id', userId);
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
        const { data: clienteData } = await supabase
            .from('clientes')
            .select('id')
            .eq('email', userEmail)
            .limit(1);

        if (clienteData && clienteData.length > 0) {
            // Vincular cliente existente ao usuário
            const clienteId = clienteData[0].id;
            await supabase
                .from('users')
                .update({
                    cliente_id: clienteId,
                    pending_cliente_profile: false
                })
                .eq('id', userId);

            // Atualizar o cliente com o userId
            await supabase
                .from('clientes')
                .update({
                    user_id: userId,
                    has_user_account: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', clienteId);

            return { success: true, clienteId, needsCompletion: false };
        }

        // Marcar como pendente de cadastro
        await supabase
            .from('users')
            .update({
                pending_cliente_profile: true,
                cliente_pre_data: {
                    nome: userName || '',
                    email: userEmail
                }
            })
            .eq('id', userId);

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
        const { data: fornecedorData } = await supabase
            .from('fornecedores')
            .select('id')
            .eq('email', userEmail)
            .limit(1);

        if (fornecedorData && fornecedorData.length > 0) {
            // Vincular fornecedor existente ao usuário
            const fornecedorId = fornecedorData[0].id;
            await supabase
                .from('users')
                .update({
                    fornecedor_id: fornecedorId,
                    pending_fornecedor_profile: false
                })
                .eq('id', userId);

            // Atualizar o fornecedor com o userId
            await supabase
                .from('fornecedores')
                .update({
                    user_id: userId,
                    has_user_account: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', fornecedorId);

            return { success: true, fornecedorId, needsCompletion: false };
        }

        // Marcar como pendente de cadastro
        await supabase
            .from('users')
            .update({
                pending_fornecedor_profile: true,
                fornecedor_pre_data: {
                    razao_social: userName || '',
                    email: userEmail
                }
            })
            .eq('id', userId);

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
        const updateData: Record<string, any> = {};

        if (profileType === 'cliente') {
            updateData.cliente_id = null;
            updateData.pending_cliente_profile = false;
            updateData.cliente_pre_data = null;
        } else {
            updateData.fornecedor_id = null;
            updateData.pending_fornecedor_profile = false;
            updateData.fornecedor_pre_data = null;
        }

        await supabase
            .from('users')
            .update(updateData)
            .eq('id', userId);

        return { success: true };
    } catch (error) {
        console.error('Erro ao remover vínculo:', error);
        return { success: false };
    }
}

/**
 * Remove campos undefined de um objeto (Supabase não aceita undefined)
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
        const { data: existingClientes } = await supabase
            .from('clientes')
            .select('id')
            .eq('email', data.email)
            .limit(1);

        if (existingClientes && existingClientes.length > 0) {
            // Vincular ao existente
            const clienteId = existingClientes[0].id;
            await supabase
                .from('users')
                .update({
                    cliente_id: clienteId,
                    pending_cliente_profile: false,
                    cliente_pre_data: null
                })
                .eq('id', userId);

            await supabase
                .from('clientes')
                .update({
                    user_id: userId,
                    has_user_account: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', clienteId);

            return { success: true, clienteId };
        }

        // Criar novo cliente - remover campos undefined
        const cleanData = removeUndefined(data);
        const clienteData = {
            ...cleanData,
            user_id: userId,
            has_user_account: true,
            ativo: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: newCliente, error: insertError } = await supabase
            .from('clientes')
            .insert(clienteData)
            .select('id')
            .single();

        if (insertError) throw insertError;

        // Atualizar usuário com o vínculo
        await supabase
            .from('users')
            .update({
                cliente_id: newCliente.id,
                pending_cliente_profile: false,
                cliente_pre_data: null
            })
            .eq('id', userId);

        return { success: true, clienteId: newCliente.id };
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
        const { data: existingFornecedores } = await supabase
            .from('fornecedores')
            .select('id')
            .eq('email', data.email)
            .limit(1);

        if (existingFornecedores && existingFornecedores.length > 0) {
            // Vincular ao existente
            const fornecedorId = existingFornecedores[0].id;
            await supabase
                .from('users')
                .update({
                    fornecedor_id: fornecedorId,
                    pending_fornecedor_profile: false,
                    fornecedor_pre_data: null
                })
                .eq('id', userId);

            await supabase
                .from('fornecedores')
                .update({
                    user_id: userId,
                    has_user_account: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', fornecedorId);

            return { success: true, fornecedorId };
        }

        // Criar novo fornecedor - remover campos undefined
        const cleanData = removeUndefined(data);
        const fornecedorData = {
            ...cleanData,
            razao_social: data.razaoSocial,
            user_id: userId,
            has_user_account: true,
            ativo: true,
            codigo: `F${Date.now()}`,
            codigo_grupo: '',
            grupo_insumos: '',
            contato: data.razaoSocial || '',
            fone: data.telefone || '',
            inscricao_estadual: '',
            numero: '',
            cartao_credito: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Remove razaoSocial pois já mapeamos para razao_social
        delete (fornecedorData as any).razaoSocial;

        const { data: newFornecedor, error: insertError } = await supabase
            .from('fornecedores')
            .insert(fornecedorData)
            .select('id')
            .single();

        if (insertError) throw insertError;

        // Atualizar usuário com o vínculo
        await supabase
            .from('users')
            .update({
                fornecedor_id: newFornecedor.id,
                pending_fornecedor_profile: false,
                fornecedor_pre_data: null
            })
            .eq('id', userId);

        return { success: true, fornecedorId: newFornecedor.id };
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

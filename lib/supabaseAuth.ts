/**
 * Serviço de Autenticação - Supabase
 */

import { createClient, User, Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cliente público (client-side)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
});

// Cliente admin (server-side only)
export const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null;

// =====================================================
// TIPOS
// =====================================================

export interface UserProfile {
    id: string;
    email: string;
    nome: string | null;
    role: string;
    roles: string[];
    telefone: string | null;
    cpf_cnpj: string | null;
    avatar_url: string | null;
    fornecedor_id: string | null;
    cliente_id: string | null;
    two_factor_enabled: boolean;
    is_verified: boolean;
    status: string;
    created_at: string;
    updated_at: string;
    // Campos adicionais de perfil
    company_name?: string | null;
    cnpj?: string | null;
    state_registration?: string | null;
    phone?: string | null;
    manager_name?: string | null;
    manager_role?: string | null;
    whatsapp?: string | null;
    cep?: string | null;
    endereco?: string | null;
    address?: string | null;
    numero?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    complemento?: string | null;
    operating_regions?: string | null;
    operating_categories?: string | null;
    [key: string]: any; // Para campos extras dinâmicos
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface SignUpData {
    email: string;
    password: string;
    nome?: string;
    role?: string;
    telefone?: string;
}

export interface AuthResult {
    success: boolean;
    user?: User;
    session?: Session;
    profile?: UserProfile;
    error?: string;
}

// =====================================================
// FUNÇÕES DE AUTENTICAÇÃO
// =====================================================

/**
 * Login com email e senha
 */
export async function signIn(credentials: LoginCredentials): Promise<AuthResult> {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        if (!data.user || !data.session) {
            return { success: false, error: 'Falha na autenticação' };
        }

        // Buscar perfil do usuário
        const profile = await getUserProfile(data.user.id);

        return {
            success: true,
            user: data.user,
            session: data.session,
            profile: profile || undefined,
        };
    } catch (error: any) {
        return { success: false, error: error.message || 'Erro ao fazer login' };
    }
}

/**
 * Logout
 */
export async function signOut(): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) {
            return { success: false, error: error.message };
        }
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Cadastro de novo usuário
 */
export async function signUp(data: SignUpData): Promise<AuthResult> {
    try {
        const { data: authData, error } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    nome: data.nome,
                    role: data.role || 'cliente',
                },
            },
        });

        if (error) {
            return { success: false, error: error.message };
        }

        if (!authData.user) {
            return { success: false, error: 'Falha no cadastro' };
        }

        return {
            success: true,
            user: authData.user,
            session: authData.session || undefined,
        };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Solicitar reset de senha
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Atualizar senha
 */
export async function updatePassword(newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.auth.updateUser({
            password: newPassword,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Obter usuário atual
 */
export async function getCurrentUser(): Promise<User | null> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        return user;
    } catch {
        return null;
    }
}

/**
 * Obter sessão atual
 */
export async function getSession(): Promise<Session | null> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    } catch {
        return null;
    }
}

/**
 * Buscar perfil do usuário
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error || !data) {
            return null;
        }

        return data as UserProfile;
    } catch {
        return null;
    }
}

/**
 * Atualizar perfil do usuário
 */
export async function updateUserProfile(
    userId: string,
    updates: Partial<UserProfile>
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('users')
            .update(updates as any)
            .eq('id', userId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Verificar se usuário é admin
 */
export async function isAdmin(userId?: string): Promise<boolean> {
    try {
        const uid = userId || (await getCurrentUser())?.id;
        if (!uid) return false;

        const profile = await getUserProfile(uid);
        if (!profile) return false;

        return profile.role === 'admin' || profile.roles?.includes('admin');
    } catch {
        return false;
    }
}

/**
 * Listener de mudanças de auth
 */
export function onAuthStateChange(
    callback: (user: User | null, session: Session | null) => void
) {
    return supabase.auth.onAuthStateChange((event, session) => {
        callback(session?.user || null, session);
    });
}

// =====================================================
// FUNÇÕES ADMIN (Server-side)
// =====================================================

/**
 * Criar usuário (admin)
 */
export async function createUserAdmin(data: SignUpData & { mustChangePassword?: boolean }): Promise<AuthResult> {
    if (!supabaseAdmin) {
        return { success: false, error: 'Cliente admin não disponível' };
    }

    try {
        // Criar usuário no Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true,
        });

        if (authError || !authData.user) {
            return { success: false, error: authError?.message || 'Erro ao criar usuário' };
        }

        // Criar perfil na tabela users
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert({
                id: authData.user.id,
                email: data.email,
                nome: data.nome || null,
                role: data.role || 'cliente',
                roles: [data.role || 'cliente'],
                telefone: data.telefone || null,
                status: 'active',
                is_verified: true,
            } as any);

        if (profileError) {
            // Rollback: deletar usuário criado
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            return { success: false, error: profileError.message };
        }

        return { success: true, user: authData.user };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Listar usuários (admin)
 */
export async function listUsers(options?: {
    page?: number;
    perPage?: number;
    role?: string;
    status?: string;
    search?: string;
}): Promise<{ users: UserProfile[]; total: number; error?: string }> {
    if (!supabaseAdmin) {
        return { users: [], total: 0, error: 'Cliente admin não disponível' };
    }

    try {
        let query = supabaseAdmin
            .from('users')
            .select('*', { count: 'exact' });

        // Filtros
        if (options?.role && options.role !== 'all') {
            query = query.contains('roles', [options.role]);
        }
        if (options?.status && options.status !== 'all') {
            query = query.eq('status', options.status);
        }
        if (options?.search) {
            query = query.or(`email.ilike.%${options.search}%,nome.ilike.%${options.search}%`);
        }

        // Paginação
        const page = options?.page || 0;
        const perPage = options?.perPage || 10;
        query = query
            .order('created_at', { ascending: false })
            .range(page * perPage, (page + 1) * perPage - 1);

        const { data, count, error } = await query;

        if (error) {
            return { users: [], total: 0, error: error.message };
        }

        return {
            users: (data || []) as UserProfile[],
            total: count || 0,
        };
    } catch (error: any) {
        return { users: [], total: 0, error: error.message };
    }
}

/**
 * Atualizar roles do usuário (admin)
 */
export async function updateUserRoles(
    userId: string,
    roles: string[]
): Promise<{ success: boolean; error?: string }> {
    if (!supabaseAdmin) {
        return { success: false, error: 'Cliente admin não disponível' };
    }

    try {
        const primaryRole = roles.includes('admin') ? 'admin' :
            roles.includes('fornecedor') ? 'fornecedor' : 'cliente';

        const { error } = await supabaseAdmin
            .from('users')
            .update({ roles, role: primaryRole } as any)
            .eq('id', userId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Deletar usuário (admin)
 */
export async function deleteUserAdmin(userId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabaseAdmin) {
        return { success: false, error: 'Cliente admin não disponível' };
    }

    try {
        // Deletar do Auth (cascade deleta da tabela users)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * Atualizar senha de outro usuário (admin)
 */
export async function updateUserPasswordAdmin(
    userId: string,
    newPassword: string
): Promise<{ success: boolean; error?: string }> {
    if (!supabaseAdmin) {
        return { success: false, error: 'Cliente admin não disponível' };
    }

    try {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            password: newPassword,
        });

        if (error) {
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

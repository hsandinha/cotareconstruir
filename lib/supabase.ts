import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cliente para uso no lado do cliente (browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
});

// Cliente para uso no lado do servidor (API routes, Server Components)
export function createServerClient(cookieHeader?: string) {
    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        global: {
            headers: cookieHeader ? { cookie: cookieHeader } : {},
        },
    });
}

// Cliente admin com service role (apenas para uso no servidor!)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const supabaseAdmin = supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
    : null;

// Helper para obter o usuário atual
export async function getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
        console.error('Erro ao obter usuário:', error);
        return null;
    }
    return user;
}

// Helper para obter o perfil do usuário atual
export async function getCurrentUserProfile() {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error) {
        console.error('Erro ao obter perfil:', error);
        return null;
    }
    return data;
}

// Helper para verificar se é admin
export async function isCurrentUserAdmin() {
    const profile = await getCurrentUserProfile() as any;
    if (!profile) return false;
    return profile.role === 'admin' || profile.roles?.includes('admin');
}

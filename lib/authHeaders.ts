/**
 * Helper centralizado para obter headers de autenticação
 * Garante que o token mais recente seja usado em todas as requisições
 */
import { supabase } from './supabaseAuth';

/**
 * Obtém headers com token de autenticação válido.
 * @param accessToken - Token de acesso direto (opcional). Se fornecido, usa-o sem chamar getSession().
 * Caso não seja fornecido, tenta múltiplas fontes na seguinte ordem:
 * 1. Supabase session (auto-refresh via getSession)
 * 2. Refresh explícito da sessão
 * 3. Fallback para localStorage
 */
export async function getAuthHeaders(accessToken?: string): Promise<Record<string, string>> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    // Se um token foi fornecido diretamente, usá-lo
    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        return headers;
    }

    // 1. Tentar sessão do Supabase (auto-refresh embutido)
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
            return headers;
        }
    } catch (e: any) {
        // getSession falhou
    }

    // 2. Tentar refresh explícito da sessão
    try {
        const { data: { session }, error } = await supabase.auth.refreshSession();
        if (!error && session?.access_token) {
            // Atualizar localStorage com o token renovado
            if (typeof window !== 'undefined') {
                localStorage.setItem('token', session.access_token);
            }
            headers['Authorization'] = `Bearer ${session.access_token}`;
            return headers;
        }
    } catch (e: any) {
        // refreshSession falhou
    }

    // 3. Fallback final: localStorage
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
    }

    return headers;
}

/**
 * Wrapper para fetch com autenticação.
 * Tenta a requisição; se retornar 401, renova o token e retenta uma vez.
 */
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
    const headers = await getAuthHeaders();
    const mergedHeaders = { ...headers, ...(options?.headers || {}) };

    const res = await fetch(url, { ...options, headers: mergedHeaders });

    // Se 401, tentar renovar token e reenviar
    if (res.status === 401) {
        try {
            const { data: { session } } = await supabase.auth.refreshSession();
            if (session?.access_token) {
                // Atualizar localStorage
                if (typeof window !== 'undefined') {
                    localStorage.setItem('token', session.access_token);
                }

                const retryHeaders = {
                    ...mergedHeaders,
                    'Authorization': `Bearer ${session.access_token}`,
                };
                return fetch(url, { ...options, headers: retryHeaders });
            }
        } catch (e) {
            // Refresh falhou, retornar resposta 401 original
        }
    }

    return res;
}

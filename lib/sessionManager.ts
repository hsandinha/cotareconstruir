/**
 * Gerenciador de Sessão Client-Side
 * Renova tokens automaticamente e monitora expiração
 */

import { supabase } from './supabase';

let refreshInterval: NodeJS.Timeout | null = null;
let authSubscription: { unsubscribe: () => void } | null = null;
let isMonitoringStarted = false;

/**
 * Inicia monitoramento de sessão
 * Renova token automaticamente a cada 50 minutos (Supabase JWT expira em 1 hora por padrão)
 */
export function startSessionMonitoring() {
    // Evitar iniciar múltiplas vezes
    if (isMonitoringStarted) {
        return;
    }
    isMonitoringStarted = true;

    // Limpar intervalo anterior se existir
    if (refreshInterval) {
        clearInterval(refreshInterval);
    }

    // Configurar listener de mudança de autenticação
    if (!authSubscription) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'TOKEN_REFRESHED' && session) {
                // Atualizar cookie quando o token for renovado
                updateSessionCookie(session.access_token);
                // Log apenas uma vez por renovação
            } else if (event === 'SIGNED_OUT') {
                // Limpar cookies ao fazer logout
                clearSessionCookies();
            }
        });
        authSubscription = subscription;
    }

    // Verificar sessão a cada 50 minutos (não imediatamente)
    refreshInterval = setInterval(async () => {
        await refreshSession();
    }, 50 * 60 * 1000); // 50 minutos
}

/**
 * Para monitoramento de sessão
 */
export function stopSessionMonitoring() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }

    if (authSubscription) {
        authSubscription.unsubscribe();
        authSubscription = null;
    }

    isMonitoringStarted = false;
}

/**
 * Atualiza cookie de sessão
 */
function updateSessionCookie(token: string) {
    const isProduction = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const secureFlag = isProduction ? '; Secure' : '';
    document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Strict${secureFlag}`;
}

/**
 * Limpa cookies de sessão
 */
function clearSessionCookies() {
    document.cookie = 'token=; path=/; max-age=0';
    document.cookie = 'authToken=; path=/; max-age=0';
    document.cookie = 'refreshToken=; path=/; max-age=0';
}

/**
 * Renova sessão verificando e atualizando token
 */
export async function refreshSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
            return false;
        }

        // Tentar renovar a sessão
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError || !newSession) {
            console.error('Erro ao renovar sessão:', refreshError);
            return false;
        }

        // Atualizar cookie
        updateSessionCookie(newSession.access_token);

        return true;

    } catch (error) {
        console.error('Erro ao renovar sessão:', error);
        return false;
    }
}

/**
 * Verifica se a sessão está válida
 */
export async function validateSession(): Promise<boolean> {
    try {
        // Primeiro, verificar sessão local do Supabase
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
            return false;
        }

        // Também validar via API para consistência
        const response = await fetch('/api/auth/session', {
            method: 'GET',
            credentials: 'include',
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return data.valid;

    } catch (error) {
        console.error('Erro ao validar sessão:', error);
        return false;
    }
}

/**
 * Calcula tempo restante até expiração do token
 */
export async function getSessionTimeRemaining(): Promise<number> {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) return 0;

        // O token JWT do Supabase tem o campo 'exp' com timestamp de expiração
        const tokenPayload = JSON.parse(atob(session.access_token.split('.')[1]));
        const expirationTime = tokenPayload.exp * 1000; // converter para milliseconds
        const now = Date.now();

        return Math.max(0, expirationTime - now);

    } catch (error) {
        console.error('Erro ao obter tempo de sessão:', error);
        return 0;
    }
}

/**
 * Obtém o usuário atual da sessão
 */
export async function getCurrentUser() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            return null;
        }

        return user;
    } catch (error) {
        console.error('Erro ao obter usuário atual:', error);
        return null;
    }
}

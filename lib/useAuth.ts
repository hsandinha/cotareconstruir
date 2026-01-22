/**
 * Hook customizado para gerenciar autenticação
 * Integrado com Supabase Auth
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, Session } from '@supabase/supabase-js';
import {
    supabase,
    signIn,
    signOut as supabaseSignOut,
    getUserProfile,
    onAuthStateChange,
    type UserProfile
} from './supabaseAuth';
import { sanitizeEmail, validateEmail } from './validation';

interface LoginCredentials {
    email: string;
    password: string;
}

interface AuthState {
    user: User | null;
    profile: UserProfile | null;
    session: Session | null;
    loading: boolean;
    initialized: boolean;
}

export function useAuth() {
    const [state, setState] = useState<AuthState>({
        user: null,
        profile: null,
        session: null,
        loading: false,
        initialized: false,
    });
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // Inicializar e escutar mudanças de auth
    useEffect(() => {
        // Buscar sessão inicial
        const initAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                if (session?.user) {
                    const profile = await getUserProfile(session.user.id);
                    setState({
                        user: session.user,
                        profile,
                        session,
                        loading: false,
                        initialized: true,
                    });
                } else {
                    setState(prev => ({ ...prev, initialized: true }));
                }
            } catch (err) {
                console.error('Erro ao inicializar auth:', err);
                setState(prev => ({ ...prev, initialized: true }));
            }
        };

        initAuth();

        // Escutar mudanças
        const { data: { subscription } } = onAuthStateChange(async (user, session) => {
            if (user && session) {
                const profile = await getUserProfile(user.id);
                setState({
                    user,
                    profile,
                    session,
                    loading: false,
                    initialized: true,
                });
            } else {
                setState({
                    user: null,
                    profile: null,
                    session: null,
                    loading: false,
                    initialized: true,
                });
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const login = useCallback(async ({ email, password }: LoginCredentials): Promise<boolean> => {
        setState(prev => ({ ...prev, loading: true }));
        setError(null);

        try {
            // Validação client-side
            const sanitizedEmail = sanitizeEmail(email);
            if (!validateEmail(sanitizedEmail)) {
                throw new Error('Email inválido');
            }

            if (!password || password.length < 6) {
                throw new Error('Senha deve ter no mínimo 6 caracteres');
            }

            // Login via Supabase
            const result = await signIn({ email: sanitizedEmail, password });

            if (!result.success) {
                throw new Error(result.error || 'Email ou senha incorretos');
            }

            const profile = result.profile;
            const primaryRole = profile?.role || 'cliente';

            // Redirecionar baseado no role
            if (primaryRole === 'admin') {
                router.push('/dashboard/admin');
            } else if (primaryRole === 'fornecedor') {
                router.push('/dashboard/fornecedor');
            } else {
                router.push('/dashboard/cliente');
            }

            return true;

        } catch (err: any) {
            const errorMessage = err.message || 'Erro ao fazer login';
            setError(errorMessage);
            console.error('Login error:', err);
            return false;

        } finally {
            setState(prev => ({ ...prev, loading: false }));
        }
    }, [router]);

    const logout = useCallback(async (): Promise<boolean> => {
        setState(prev => ({ ...prev, loading: true }));
        setError(null);

        try {
            const result = await supabaseSignOut();

            if (!result.success) {
                throw new Error(result.error || 'Erro ao fazer logout');
            }

            // Limpar localStorage
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            localStorage.removeItem('uid');

            router.push('/login');
            return true;

        } catch (err: any) {
            setError(err.message || 'Erro ao fazer logout');
            console.error('Logout error:', err);
            return false;

        } finally {
            setState(prev => ({ ...prev, loading: false }));
        }
    }, [router]);

    const refreshProfile = useCallback(async () => {
        if (!state.user) return;

        const profile = await getUserProfile(state.user.id);
        setState(prev => ({ ...prev, profile }));
    }, [state.user]);

    return {
        // Estado
        user: state.user,
        profile: state.profile,
        session: state.session,
        loading: state.loading,
        initialized: state.initialized,
        isAuthenticated: !!state.user,
        isAdmin: state.profile?.role === 'admin' || state.profile?.roles?.includes('admin'),
        isFornecedor: state.profile?.role === 'fornecedor' || state.profile?.roles?.includes('fornecedor'),
        isCliente: state.profile?.role === 'cliente' || state.profile?.roles?.includes('cliente'),

        // Ações
        login,
        logout,
        refreshProfile,

        // Erros
        error,
        setError,
    };
}

/**
 * Configuração do Sentry para monitoramento de erros
 * Documentação: https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from "@sentry/nextjs";

// Inicializar Sentry apenas se a DSN estiver configurada
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

        // Configurar amostragem de traces (performance monitoring)
        tracesSampleRate: parseFloat(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || '0.1'),

        // Desabilitar em desenvolvimento
        enabled: process.env.NODE_ENV === 'production',

        // Environment
        environment: process.env.NODE_ENV,

        // Release tracking
        release: process.env.NEXT_PUBLIC_APP_VERSION || 'development',

        // Configurar contextos adicionais
        beforeSend(event, hint) {
            // Filtrar informações sensíveis
            if (event.request) {
                // Remover dados sensíveis das URLs
                if (event.request.url) {
                    event.request.url = event.request.url.replace(/token=[^&]+/g, 'token=[FILTERED]');
                }

                // Remover headers sensíveis
                if (event.request.headers) {
                    delete event.request.headers['authorization'];
                    delete event.request.headers['cookie'];
                }
            }

            // Adicionar informações de usuário se disponível
            const userEmail = typeof window !== 'undefined'
                ? localStorage.getItem('userEmail')
                : null;

            if (userEmail) {
                event.user = {
                    ...event.user,
                    email: userEmail,
                };
            }

            return event;
        },

        // Integrations (Next.js SDK configura automaticamente BrowserTracing)
        integrations: [],

        // Session Replay (apenas para erros)
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 1.0,

        // Trace Propagation Targets
        tracePropagationTargets: [
            'localhost',
            /^https:\/\/cotareconstruir\.com\.br/,
        ],
    });
}

/**
 * Função helper para capturar erros com contexto adicional
 */
export function captureError(error: Error, context?: Record<string, any>) {
    if (context) {
        Sentry.setContext('additional', context);
    }
    Sentry.captureException(error);
}

/**
 * Função helper para capturar mensagens
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
    Sentry.captureMessage(message, level);
}

/**
 * Configurar contexto de usuário
 */
export function setUserContext(userId: string, email: string, role: string) {
    Sentry.setUser({
        id: userId,
        email,
        role,
    });
}

/**
 * Limpar contexto de usuário (logout)
 */
export function clearUserContext() {
    Sentry.setUser(null);
}

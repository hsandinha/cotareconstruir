/**
 * Rate Limiting usando LRU Cache
 * Protege contra força bruta e abuso de APIs
 */

interface RateLimitOptions {
    uniqueTokenPerInterval?: number;
    interval?: number;
}

interface RateLimitResult {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
}

// Cache em memória usando Map (para ambientes serverless, considerar Redis em produção)
const tokenCache = new Map<string, { count: number; resetTime: number }>();

export function rateLimit(options: RateLimitOptions = {}) {
    const interval = options.interval || 60000; // 1 minuto padrão
    const uniqueTokenPerInterval = options.uniqueTokenPerInterval || 500;

    return {
        check: async (token: string, limit: number): Promise<RateLimitResult> => {
            const now = Date.now();
            const tokenKey = `${token}_${Math.floor(now / interval)}`;

            // Limpar entradas antigas
            for (const [key, value] of tokenCache.entries()) {
                if (value.resetTime < now) {
                    tokenCache.delete(key);
                }
            }

            // Limitar tamanho do cache
            if (tokenCache.size > uniqueTokenPerInterval) {
                const firstKey = tokenCache.keys().next().value;
                if (firstKey) tokenCache.delete(firstKey);
            }

            // Obter ou criar entrada
            let tokenData = tokenCache.get(tokenKey);
            if (!tokenData) {
                tokenData = {
                    count: 0,
                    resetTime: now + interval,
                };
                tokenCache.set(tokenKey, tokenData);
            }

            tokenData.count += 1;
            const isRateLimited = tokenData.count > limit;

            return {
                success: !isRateLimited,
                limit,
                remaining: Math.max(0, limit - tokenData.count),
                reset: tokenData.resetTime,
            };
        },
    };
}

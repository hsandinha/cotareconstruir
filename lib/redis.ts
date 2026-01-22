/**
 * Configuração Redis (Upstash)
 * Usado para: Cache, Rate Limiting, Filas (BullMQ)
 */

import { Redis } from '@upstash/redis';

// Verifica se Redis está configurado
const isRedisConfigured = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

// Cliente Redis para cache e rate limiting (null se não configurado)
export const redis = isRedisConfigured
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    : null;

/**
 * Helper para cache com TTL
 */
export async function getCached<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 300 // 5 minutos padrão
): Promise<T> {
    // Se Redis não está configurado, retorna dados direto
    if (!redis) {
        return fetchFn();
    }

    try {
        // Tentar pegar do cache
        const cached = await redis.get<string>(key);

        if (cached) {
            console.log('✅ Cache HIT:', key);
            return JSON.parse(cached);
        }

        // Cache MISS - buscar dados reais
        console.log('❌ Cache MISS:', key);
        const data = await fetchFn();

        // Salvar no cache
        await redis.setex(key, ttl, JSON.stringify(data));

        return data;
    } catch (error) {
        console.error('Redis cache error:', error);
        // Se Redis falhar, retorna dados sem cache
        return fetchFn();
    }
}

/**
 * Invalidar cache por padrão de chave
 */
export async function invalidateCache(pattern: string) {
    if (!redis) return;

    try {
        // Upstash não suporta SCAN, então mantemos uma lista de keys
        // Alternativa: usar prefixos conhecidos
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
            await redis.del(...keys);
            console.log(`🗑️ Invalidated ${keys.length} cache keys`);
        }
    } catch (error) {
        console.error('Cache invalidation error:', error);
    }
}

/**
 * Rate Limiting com Redis
 */
export async function checkRateLimit(
    identifier: string,
    limit: number = 5,
    window: number = 60 // segundos
): Promise<{ success: boolean; remaining: number; reset: number }> {
    // Se Redis não está configurado, permite todas requisições (dev mode)
    if (!redis) {
        return { success: true, remaining: limit, reset: Date.now() + (window * 1000) };
    }

    try {
        const key = `ratelimit:${identifier}`;

        // Usar pipeline para operações atômicas
        const count = await redis.incr(key);

        // Se primeira requisição, definir expiração
        if (count === 1) {
            await redis.expire(key, window);
        }

        // Pegar TTL para calcular reset time
        const ttl = await redis.ttl(key);

        return {
            success: count <= limit,
            remaining: Math.max(0, limit - count),
            reset: Date.now() + (ttl * 1000),
        };
    } catch (error) {
        console.error('Rate limit error:', error);
        // Se Redis falhar, permite a requisição
        return { success: true, remaining: limit, reset: Date.now() + (window * 1000) };
    }
}

/**
 * Limpar rate limit (útil para testes)
 */
export async function clearRateLimit(identifier: string) {
    if (!redis) return;
    await redis.del(`ratelimit:${identifier}`);
}

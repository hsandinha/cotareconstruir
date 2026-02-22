/**
 * API Route para CORS configurado
 * Headers de segurança e CORS policy
 */

import { NextRequest, NextResponse } from 'next/server';

const allowedOrigins = [
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    'https://Comprareconstruir.vercel.app',
];

export function corsHeaders(origin: string | null) {
    const isAllowedOrigin = origin && allowedOrigins.includes(origin);

    return {
        'Access-Control-Allow-Origin': isAllowedOrigin ? origin : allowedOrigins[0],
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
    };
}

export function securityHeaders() {
    return {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    };
}

export function withCors(handler: (req: NextRequest) => Promise<NextResponse>) {
    return async (request: NextRequest) => {
        const origin = request.headers.get('origin');

        // Handle preflight requests
        if (request.method === 'OPTIONS') {
            return new NextResponse(null, {
                status: 204,
                headers: {
                    ...corsHeaders(origin),
                    ...securityHeaders(),
                },
            });
        }

        // Handle actual request
        const response = await handler(request);

        // Add CORS and security headers
        Object.entries(corsHeaders(origin)).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        Object.entries(securityHeaders()).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    };
}

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Proxy de Segurança e Proteção de Rotas (Next.js 16+)
 * Atua como camada de rede que manipula requisições antes de chegar ao app
 * Usado para: autenticação, roteamento, redirecionamentos e segurança de borda
 */
export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl
    const token = request.cookies.get('authToken')?.value || request.cookies.get('token')?.value
    const role = request.cookies.get('userRole')?.value || request.cookies.get('role')?.value
    const mustChangePassword = request.cookies.get('mustChangePassword')?.value

    // Rotas públicas que não requerem autenticação
    const publicRoutes = ['/login', '/termos', '/privacidade', '/ajuda', '/']
    const isPublicRoute = publicRoutes.some(route => pathname === route || pathname === '/')

    // Se está em rota pública e já autenticado, redirecionar para dashboard
    if (isPublicRoute && pathname === '/login' && token && role) {
        if (role === 'admin' || role === 'administrador') {
            return NextResponse.redirect(new URL('/dashboard/admin', request.url))
        } else if (role === 'fornecedor') {
            return NextResponse.redirect(new URL('/dashboard/fornecedor', request.url))
        } else if (role === 'cliente') {
            return NextResponse.redirect(new URL('/dashboard/cliente', request.url))
        }
    }

    // Permitir acesso a rotas públicas
    if (isPublicRoute) {
        return NextResponse.next()
    }

    // PROTEÇÃO DE ROTAS /dashboard/* - Verificar autenticação
    if (pathname.startsWith('/dashboard')) {
        // Usuário não autenticado
        if (!token) {
            const loginUrl = new URL('/login', request.url)
            loginUrl.searchParams.set('redirect', pathname)
            return NextResponse.redirect(loginUrl)
        }

        // Verificar se deve trocar senha (exceto na página de troca)
        if (mustChangePassword === 'true' && !pathname.startsWith('/dashboard/change-password')) {
            return NextResponse.redirect(new URL('/dashboard/change-password', request.url))
        }

        // Prevenir acesso à página de troca de senha se não for necessário
        if (pathname.startsWith('/dashboard/change-password') && mustChangePassword !== 'true') {
            if (role === 'admin' || role === 'administrador') {
                return NextResponse.redirect(new URL('/dashboard/admin', request.url))
            } else if (role === 'fornecedor') {
                return NextResponse.redirect(new URL('/dashboard/fornecedor', request.url))
            } else if (role === 'cliente') {
                return NextResponse.redirect(new URL('/dashboard/cliente', request.url))
            }
        }

        // PROTEÇÃO POR ROLE - Garantir que usuários acessem apenas suas áreas

        // Proteção: Dashboard Admin (apenas admin)
        if (pathname.startsWith('/dashboard/admin')) {
            if (role !== 'admin' && role !== 'administrador') {
                // Não é admin, redirecionar para dashboard apropriado
                if (role === 'fornecedor') {
                    return NextResponse.redirect(new URL('/dashboard/fornecedor', request.url))
                } else if (role === 'cliente') {
                    return NextResponse.redirect(new URL('/dashboard/cliente', request.url))
                } else {
                    // Role desconhecido, forçar logout
                    return NextResponse.redirect(new URL('/login', request.url))
                }
            }
        }

        // Proteção: Dashboard Fornecedor (apenas fornecedor ou admin)
        if (pathname.startsWith('/dashboard/fornecedor')) {
            if (role !== 'fornecedor' && role !== 'admin' && role !== 'administrador') {
                if (role === 'cliente') {
                    return NextResponse.redirect(new URL('/dashboard/cliente', request.url))
                } else {
                    return NextResponse.redirect(new URL('/login', request.url))
                }
            }
        }

        // Proteção: Dashboard Cliente (apenas cliente ou admin)
        if (pathname.startsWith('/dashboard/cliente')) {
            if (role !== 'cliente' && role !== 'admin' && role !== 'administrador') {
                if (role === 'fornecedor') {
                    return NextResponse.redirect(new URL('/dashboard/fornecedor', request.url))
                } else {
                    return NextResponse.redirect(new URL('/login', request.url))
                }
            }
        }

        // Rota genérica /dashboard - redirecionar baseado no role
        if (pathname === '/dashboard' || pathname === '/dashboard/') {
            if (role === 'admin' || role === 'administrador') {
                return NextResponse.redirect(new URL('/dashboard/admin', request.url))
            } else if (role === 'fornecedor') {
                return NextResponse.redirect(new URL('/dashboard/fornecedor', request.url))
            } else if (role === 'cliente') {
                return NextResponse.redirect(new URL('/dashboard/cliente', request.url))
            } else {
                return NextResponse.redirect(new URL('/login', request.url))
            }
        }
    }

    return NextResponse.next()
}

/**
 * Configuração de rotas que o middleware processa
 * Otimizado para performance
 */
export const config = {
    matcher: [
        /*
         * Match all paths except:
         * - api routes
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico
         * - public folder assets
         */
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}

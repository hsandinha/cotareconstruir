import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { decodeLoginRef, quotationDeepLinkPath } from './lib/quotationLink'
import { normalizarCodigo, codigoValido } from './lib/cobrancaModelo'

/** Cookie que leva o código do parceiro da landing até o cadastro. */
const COOKIE_REF = 'cc_ref'
/** Id anônimo do visitante — liga clique a cadastro no funil do parceiro. */
const COOKIE_VISITANTE = 'cc_vis'
const DIAS_ATRIBUICAO = 90

/**
 * Proxy de Segurança e Proteção de Rotas (Next.js 16+)
 * Atua como camada de rede que manipula requisições antes de chegar ao app
 * Usado para: autenticação, roteamento, redirecionamentos e segurança de borda
 *
 * Também captura o `?ref=` dos links de afiliado. Fica aqui, e não numa
 * página, porque o parceiro divulga o link apontando para qualquer lugar do
 * site — landing, /cadastro, uma página de conteúdo — e o código precisa ser
 * guardado em todas elas.
 */
export function proxy(request: NextRequest) {
    const resposta = rotear(request)
    return marcarAfiliado(request, resposta)
}

/**
 * Guarda o código do parceiro no cookie.
 *
 * PRIMEIRO CLIQUE VENCE: se já existe um código gravado, um link novo não o
 * substitui. Quem investiu para trazer a pessoa foi o primeiro; trocar no
 * último clique premiaria quem só apareceu na hora da conversão (e o próprio
 * site, se o visitante voltasse por um link sem ref).
 *
 * O cookie não é HttpOnly de propósito: o tracker do cliente precisa lê-lo
 * para registrar a visita. Ele não carrega nada sensível — é um código
 * público, que o parceiro distribui.
 */
function marcarAfiliado(request: NextRequest, resposta: NextResponse): NextResponse {
    const bruto = request.nextUrl.searchParams.get('ref')
        || request.nextUrl.searchParams.get('afiliado')
    if (!bruto) return resposta

    const codigo = normalizarCodigo(bruto)
    if (!codigoValido(codigo)) return resposta

    const maxAge = DIAS_ATRIBUICAO * 24 * 60 * 60

    if (!request.cookies.get(COOKIE_REF)) {
        resposta.cookies.set(COOKIE_REF, JSON.stringify({ c: codigo, t: Date.now() }), {
            maxAge,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        })
    }

    if (!request.cookies.get(COOKIE_VISITANTE)) {
        resposta.cookies.set(COOKIE_VISITANTE, crypto.randomUUID(), {
            maxAge,
            path: '/',
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        })
    }

    return resposta
}

/** Roteamento e proteção de rotas — o comportamento original do proxy. */
function rotear(request: NextRequest): NextResponse {
    const { pathname } = request.nextUrl
    const token = request.cookies.get('authToken')?.value || request.cookies.get('token')?.value
    const role = request.cookies.get('userRole')?.value || request.cookies.get('role')?.value
    const mustChangePassword = request.cookies.get('mustChangePassword')?.value

    // Rotas públicas que não requerem autenticação
    const publicRoutes = ['/login', '/cadastro', '/forgot-password', '/reset-password', '/termos', '/privacidade', '/ajuda', '/sobre', '/']
    const isPublicRoute = publicRoutes.some(route => pathname === route || pathname === '/')

    // Se está em rota pública e já autenticado, redirecionar para dashboard
    if (isPublicRoute && pathname === '/login' && token && role) {
        const roleHome = (role === 'admin' || role === 'administrador')
            ? '/dashboard/admin'
            : role === 'fornecedor'
                ? '/dashboard/fornecedor'
                : role === 'cliente'
                    ? '/dashboard/cliente'
                    : null

        if (roleHome) {
            let target = roleHome

            // Link de notificação (?wa=<token>): abre direto a cotação
            const waToken = request.nextUrl.searchParams.get('wa')
            const loginLinkRef = waToken ? decodeLoginRef(waToken) : null
            if (loginLinkRef?.cotacaoId && (role === 'fornecedor' || role === 'cliente')) {
                // Abre a cotação no painel do papel real do usuário (cookie),
                // independentemente do papel gravado no token.
                target = quotationDeepLinkPath(loginLinkRef.cotacaoId, role)
            } else {
                // Preservar destino original (?redirect=) se for da área do usuário
                const redirectParam = request.nextUrl.searchParams.get('redirect')
                if (redirectParam && redirectParam.startsWith(roleHome)) {
                    target = redirectParam
                }
            }

            return NextResponse.redirect(new URL(target, request.url))
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
        // Para fornecedores, mantemos no dashboard e exibimos um modal obrigatório.
        if (mustChangePassword === 'true' && !pathname.startsWith('/dashboard/change-password')) {
            if (!pathname.startsWith('/dashboard/fornecedor')) {
                return NextResponse.redirect(new URL('/dashboard/change-password', request.url))
            }
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

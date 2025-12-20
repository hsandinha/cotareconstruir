import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const token = request.cookies.get('token')?.value
    const role = request.cookies.get('role')?.value

    // Protect dashboard routes
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
        if (!token) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        // Role based redirection/protection
        if (request.nextUrl.pathname.startsWith('/dashboard/cliente') && role !== 'cliente') {
            // If user is not client but tries to access client dashboard
            if (role === 'fornecedor') {
                return NextResponse.redirect(new URL('/dashboard/fornecedor', request.url))
            } else if (role === 'admin') {
                return NextResponse.redirect(new URL('/dashboard/admin', request.url))
            }
        }

        if (request.nextUrl.pathname.startsWith('/dashboard/fornecedor') && role !== 'fornecedor') {
            if (role === 'cliente') {
                return NextResponse.redirect(new URL('/dashboard/cliente', request.url))
            } else if (role === 'admin') {
                return NextResponse.redirect(new URL('/dashboard/admin', request.url))
            }
        }

        if (request.nextUrl.pathname.startsWith('/dashboard/admin') && role !== 'admin' && role !== 'administrador') {
            if (role === 'cliente') {
                return NextResponse.redirect(new URL('/dashboard/cliente', request.url))
            } else if (role === 'fornecedor') {
                return NextResponse.redirect(new URL('/dashboard/fornecedor', request.url))
            }
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: '/dashboard/:path*',
}

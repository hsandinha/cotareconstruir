import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body || {};

        if (!email || !password) {
            return NextResponse.json({ message: "Email e senha são obrigatórios" }, { status: 400 });
        }

        // Autenticar com Supabase
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError || !authData.user) {
            console.error('Erro de autenticação Supabase:', authError);
            return NextResponse.json({ message: "Credenciais inválidas" }, { status: 401 });
        }

        const user = authData.user;
        const session = authData.session;

        // Buscar dados do usuário no Supabase
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

        if (userError || !userData) {
            console.error('Erro ao buscar dados do usuário:', userError);
            return NextResponse.json({ message: "Dados do usuário não encontrados" }, { status: 404 });
        }

        const userRole = userData.role || userData.roles?.[0] || "cliente";
        const mustChangePassword = userData.must_change_password || false;

        // Obter token de autenticação
        const token = session?.access_token || '';

        // Criar resposta com cookies
        const response = NextResponse.json({
            token,
            user: {
                email,
                role: userRole,
                name: userData.name || userData.company_name,
                uid: user.id
            }
        });

        // Definir cookies
        response.cookies.set('authToken', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 dias
            path: '/'
        });

        response.cookies.set('userRole', userRole, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/'
        });

        response.cookies.set('mustChangePassword', mustChangePassword.toString(), {
            httpOnly: false, // Precisa ser acessível pelo client
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7,
            path: '/'
        });

        // Também definir cookie de refresh token para renovação automática
        if (session?.refresh_token) {
            response.cookies.set('refreshToken', session.refresh_token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 * 7,
                path: '/'
            });
        }

        return response;

    } catch (err: any) {
        console.error('Erro no login:', err);
        return NextResponse.json({ message: "Erro no servidor" }, { status: 500 });
    }
}

import { NextResponse } from "next/server";
import { auth as firebaseAuth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, password } = body || {};

        if (!email || !password) {
            return NextResponse.json({ message: "Email e senha são obrigatórios" }, { status: 400 });
        }

        // Autenticar com Firebase
        const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
        const user = userCredential.user;

        // Buscar dados do usuário no Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (!userDoc.exists()) {
            return NextResponse.json({ message: "Dados do usuário não encontrados" }, { status: 404 });
        }

        const userData = userDoc.data();
        const userRole = userData.role || userData.roles?.[0] || "cliente";
        const mustChangePassword = userData.mustChangePassword || false;

        // Obter token de autenticação
        const token = await user.getIdToken();

        // Criar resposta com cookies
        const response = NextResponse.json({
            token,
            user: {
                email,
                role: userRole,
                name: userData.name || userData.companyName,
                uid: user.uid
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

        return response;

    } catch (err: any) {
        console.error('Erro no login:', err);

        if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
            return NextResponse.json({ message: "Credenciais inválidas" }, { status: 401 });
        }

        return NextResponse.json({ message: "Erro no servidor" }, { status: 500 });
    }
}

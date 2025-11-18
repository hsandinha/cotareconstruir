import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {

        const body = await request.json();
        const { email, password, role } = body || {};

        // Mock validation: aceita qualquer email, senha 'password' ou qualquer senha não vazia
        if (!email || !password) {
            return NextResponse.json({ message: "Email e senha são obrigatórios" }, { status: 400 });
        }
        if (password !== "password" && password.length < 4) {
            return NextResponse.json({ message: "Credenciais inválidas" }, { status: 401 });
        }

        // validar role simples
        const allowed = ["cliente", "fornecedor", "admin", "administrador"];
        const userRole = allowed.includes(role) ? role : "cliente";

        // Retornar token mock
        const token = "mocked-jwt-token-123";
        return NextResponse.json({ token, user: { email, role: userRole } });
    } catch (err) {
        return NextResponse.json({ message: "Erro no servidor" }, { status: 500 });
    }
}

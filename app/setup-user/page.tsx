"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseAuth";

export default function SetupUserPage() {
    const [status, setStatus] = useState("");
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [currentRole, setCurrentRole] = useState<string | null>(null);

    const TEST_EMAIL = "hebertsandinha@gmail.com";
    const TEST_PASSWORD = "123456";

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);
            if (user) {
                try {
                    const { data: userProfile } = await supabase
                        .from('users')
                        .select('*')
                        .eq('id', user.id)
                        .single();

                    if (userProfile) {
                        setCurrentRole(userProfile.roles?.[0] || userProfile.role || "cliente");
                    } else {
                        setCurrentRole("Sem Perfil");
                    }
                } catch (error: any) {
                    console.error("Error fetching user role:", error);
                    setCurrentRole(`Erro: ${error.message}`);
                }
            } else {
                setCurrentRole(null);
            }
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setCurrentUser(session?.user || null);
            if (!session?.user) {
                setCurrentRole(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleGoogleLogin = async () => {
        setStatus("Processando login com Google...");
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/setup-user`
                }
            });
            if (error) throw error;
        } catch (error: any) {
            setStatus(`Erro no login com Google: ${error.message}`);
        }
    };

    const createOrLoginUser = async () => {
        setStatus("Processando...");
        try {
            // Tenta fazer login primeiro
            const { data: loginData, error } = await supabase.auth.signInWithPassword({
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
            });

            let userData = loginData?.user;
            let sessionData = loginData?.session;

            if (error && error.message.includes("Invalid login credentials")) {
                // Se não existe, cria o usuário
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: TEST_EMAIL,
                    password: TEST_PASSWORD,
                });

                if (signUpError) throw signUpError;

                userData = signUpData?.user ?? null;
                sessionData = signUpData?.session ?? null;
                setStatus("Usuário criado com sucesso!");
            } else if (error) {
                throw error;
            } else {
                setStatus("Login realizado com sucesso!");
            }

            if (userData) {
                // Garante que o perfil do usuário existe
                const { data: existingProfile } = await supabase
                    .from('users')
                    .select('*')
                    .eq('id', userData.id)
                    .single();

                if (!existingProfile) {
                    await supabase.from('users').insert({
                        id: userData.id,
                        email: TEST_EMAIL,
                        nome: "Hebert Sandinha",
                        roles: ["cliente"],
                        created_at: new Date().toISOString()
                    });
                    setStatus("Perfil de usuário criado no banco de dados.");
                    setCurrentRole("cliente");
                } else {
                    await supabase
                        .from('users')
                        .update({
                            nome: "Hebert Sandinha",
                            email: TEST_EMAIL,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', userData.id);
                    setStatus("Perfil de usuário atualizado.");
                    setCurrentRole(existingProfile.roles?.[0] || existingProfile.role || "cliente");
                }
                setCurrentUser(userData);
            }
        } catch (error: any) {
            setStatus(`Erro: ${error.message}`);
        }
    };

    const switchRole = async (newRole: string) => {
        if (!currentUser) {
            setStatus("Você precisa estar logado para alterar o perfil.");
            return;
        }

        try {
            await supabase
                .from('users')
                .upsert({
                    id: currentUser.id,
                    roles: [newRole],
                    email: currentUser.email,
                    updated_at: new Date().toISOString()
                });

            setCurrentRole(newRole);

            // Atualiza cookies e localStorage
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || "";

            localStorage.setItem("role", newRole);
            localStorage.setItem("token", token);
            document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Strict`;
            document.cookie = `role=${newRole}; path=/; max-age=86400; SameSite=Strict`;

            setStatus(`Perfil alterado para: ${newRole.toUpperCase()}`);
        } catch (error: any) {
            setStatus(`Erro ao alterar perfil: ${error.message}`);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setCurrentUser(null);
        setCurrentRole(null);
        setStatus("Deslogado com sucesso.");
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
            <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full space-y-6">
                <h1 className="text-2xl font-bold text-gray-900 text-center">Configuração de Usuário de Teste</h1>

                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                    <p className="text-sm text-blue-800 font-medium">Credenciais:</p>
                    <p className="text-sm text-blue-600">Email: {TEST_EMAIL}</p>
                    <p className="text-sm text-blue-600">Senha: {TEST_PASSWORD}</p>
                </div>

                <div className="space-y-4">
                    {!currentUser ? (
                        <div className="space-y-3">
                            <button
                                onClick={createOrLoginUser}
                                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                            >
                                Criar / Entrar com Email de Teste
                            </button>

                            <div className="relative flex items-center justify-center">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200"></div>
                                </div>
                                <div className="relative bg-white px-2 text-sm text-gray-500">ou</div>
                            </div>

                            <button
                                onClick={handleGoogleLogin}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-colors"
                            >
                                <svg className="h-5 w-5" viewBox="0 0 24 24">
                                    <path
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                        fill="#4285F4"
                                    />
                                    <path
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                        fill="#34A853"
                                    />
                                    <path
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                        fill="#FBBC05"
                                    />
                                    <path
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                        fill="#EA4335"
                                    />
                                </svg>
                                Entrar com Google
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="text-center pb-4 border-b border-gray-100">
                                <p className="text-sm text-gray-500">Logado como:</p>
                                <p className="font-medium text-gray-900">{currentUser.email}</p>
                                <p className="text-sm text-gray-500 mt-2">Perfil Atual:</p>
                                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-1
                                    ${currentRole === 'fornecedor' ? 'bg-purple-100 text-purple-800' :
                                        currentRole === 'cliente' ? 'bg-green-100 text-green-800' :
                                            currentRole === 'admin' ? 'bg-blue-100 text-blue-800' :
                                                currentRole === 'Sem Perfil' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {currentRole ? currentRole.toUpperCase() : 'Carregando...'}
                                </span>
                            </div>

                            <p className="text-sm font-medium text-gray-700">Alternar Perfil:</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => switchRole("cliente")}
                                    className={`py-2 px-4 rounded-lg font-medium transition-colors border
                                        ${currentRole === 'cliente'
                                            ? 'bg-green-50 border-green-200 text-green-700 ring-2 ring-green-500 ring-offset-1'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Cliente
                                </button>
                                <button
                                    onClick={() => switchRole("fornecedor")}
                                    className={`py-2 px-4 rounded-lg font-medium transition-colors border
                                        ${currentRole === 'fornecedor'
                                            ? 'bg-purple-50 border-purple-200 text-purple-700 ring-2 ring-purple-500 ring-offset-1'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Fornecedor
                                </button>
                                <button
                                    onClick={() => switchRole("admin")}
                                    className={`col-span-2 py-2 px-4 rounded-lg font-medium transition-colors border
                                        ${currentRole === 'admin'
                                            ? 'bg-blue-50 border-blue-200 text-blue-700 ring-2 ring-blue-500 ring-offset-1'
                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    Administrador
                                </button>
                            </div>

                            <div className="pt-4 border-t border-gray-100">
                                <a
                                    href={currentRole === 'admin' ? '/dashboard/admin' : currentRole === 'fornecedor' ? '/dashboard/fornecedor' : '/dashboard/cliente'}
                                    className="block w-full py-3 px-4 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-lg text-center transition-colors"
                                >
                                    Ir para Dashboard
                                </a>
                            </div>

                            <button
                                onClick={handleSignOut}
                                className="block w-full py-2 text-sm text-red-600 hover:text-red-800 text-center"
                            >
                                Sair
                            </button>
                        </div>
                    )}
                </div>

                {status && (
                    <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 text-center border border-gray-200">
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}
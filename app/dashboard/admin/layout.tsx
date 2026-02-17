"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

export default function AdminLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const { user, loading: authLoading, initialized } = useAuth();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        const checkAdminStatus = async () => {
            console.log('🔍 [AdminLayout] checkAdminStatus - initialized:', initialized, 'authLoading:', authLoading, 'hasUser:', !!user);
            
            // Esperar inicialização completa
            if (!initialized || authLoading) {
                console.log('⏳ [AdminLayout] Aguardando inicialização...');
                return;
            }

            if (!user) {
                console.log('❌ [AdminLayout] Sem user, redirecionando para login');
                router.push("/login");
                return;
            }

            console.log('✅ [AdminLayout] User encontrado:', user.id);

            try {
                const { data: userData, error } = await supabase
                    .from("users")
                    .select("role, roles")
                    .eq("id", user.id)
                    .single();

                console.log('📊 [AdminLayout] userData:', userData, 'error:', error);

                let isAdmin = false;

                if (userData && !error) {
                    // Check legacy 'role' field
                    if (userData.role === "admin") isAdmin = true;
                    // Check new 'roles' array
                    if (userData.roles && Array.isArray(userData.roles) && userData.roles.includes("admin")) isAdmin = true;
                }

                console.log('🔐 [AdminLayout] isAdmin:', isAdmin);

                if (!isAdmin) {
                    console.log('⛔ [AdminLayout] Não é admin, redirecionando para cliente');
                    router.push("/dashboard/cliente"); // Redirect non-admins
                } else {
                    console.log('✅ [AdminLayout] É admin! Autorizando acesso');
                    setAuthorized(true);
                }
            } catch (error) {
                console.error("[AdminLayout] Erro ao verificar status admin:", error);
                router.push("/login");
            } finally {
                setLoading(false);
            }
        };

        checkAdminStatus();
    }, [user, authLoading, initialized, router]);

    if (loading || authLoading || !initialized) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    if (!authorized) {
        return null; // Will redirect
    }

    return <>{children}</>;
}

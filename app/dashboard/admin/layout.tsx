"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/useAuth";

export default function AdminLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        const checkAdminStatus = async () => {
            if (authLoading) return;

            if (!user) {
                router.push("/login");
                return;
            }

            try {
                const { data: userData, error } = await supabase
                    .from("users")
                    .select("role, roles")
                    .eq("id", user.id)
                    .single();

                let isAdmin = false;

                if (userData && !error) {
                    // Check legacy 'role' field
                    if (userData.role === "admin") isAdmin = true;
                    // Check new 'roles' array
                    if (userData.roles && Array.isArray(userData.roles) && userData.roles.includes("admin")) isAdmin = true;
                }

                if (!isAdmin) {
                    router.push("/dashboard/cliente"); // Redirect non-admins
                } else {
                    setAuthorized(true);
                }
            } catch (error) {
                console.error("Error verifying admin status:", error);
                router.push("/login");
            } finally {
                setLoading(false);
            }
        };

        checkAdminStatus();
    }, [user, authLoading, router]);

    if (loading || authLoading) {
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

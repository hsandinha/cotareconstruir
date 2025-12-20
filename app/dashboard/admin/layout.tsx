"use client";

import { useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "../../../lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function AdminLayout({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                router.push("/login");
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                let isAdmin = false;

                if (userDoc.exists()) {
                    const data = userDoc.data();
                    // Check legacy 'role' field
                    if (data.role === "admin") isAdmin = true;
                    // Check new 'roles' array
                    if (data.roles && Array.isArray(data.roles) && data.roles.includes("admin")) isAdmin = true;
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
        });

        return () => unsubscribe();
    }, [router]);

    if (loading) {
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

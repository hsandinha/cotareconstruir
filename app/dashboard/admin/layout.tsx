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
                const role = userDoc.exists() ? userDoc.data().role : "cliente";

                if (role !== "admin") {
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

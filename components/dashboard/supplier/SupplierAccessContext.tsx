"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { getAuthHeaders } from "@/lib/authHeaders";

export interface SupplierAccessCompany {
    id: string;
    razao_social: string | null;
    nome_fantasia: string | null;
    cnpj: string | null;
    ativo: boolean;
    isPrimary: boolean;
}

interface SupplierAccessContextValue {
    suppliers: SupplierAccessCompany[];
    activeSupplierId: string | null;
    activeSupplier: SupplierAccessCompany | null;
    setActiveSupplierId: (id: string | null) => void;
    hasMultipleSuppliers: boolean;
    requiresSelection: boolean;
    loading: boolean;
    refresh: () => Promise<void>;
}

const SupplierAccessContext = createContext<SupplierAccessContextValue | null>(null);

function syncFornecedorQueryParam(
    router: ReturnType<typeof useRouter>,
    pathname: string | null,
    currentSearchParams: URLSearchParams,
    fornecedorId: string | null
) {
    const params = new URLSearchParams(currentSearchParams.toString());
    if (fornecedorId) {
        params.set("fornecedor", fornecedorId);
    } else {
        params.delete("fornecedor");
    }
    const nextQuery = params.toString();
    const basePath = pathname || "/dashboard/fornecedor";
    router.replace(nextQuery ? `${basePath}?${nextQuery}` : basePath);
}

export function SupplierAccessProvider({ children }: { children: React.ReactNode }) {
    const { user, session, initialized } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [suppliers, setSuppliers] = useState<SupplierAccessCompany[]>([]);
    const [activeSupplierId, setActiveSupplierIdState] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const applyActiveSupplier = useCallback((nextId: string | null, availableSuppliers?: SupplierAccessCompany[]) => {
        if (!nextId) {
            setActiveSupplierIdState(null);
            syncFornecedorQueryParam(router, pathname, new URLSearchParams(searchParams?.toString() || ""), null);
            return;
        }

        const source = availableSuppliers || suppliers;
        if (!source.some((s) => s.id === nextId)) return;

        setActiveSupplierIdState(nextId);
        syncFornecedorQueryParam(router, pathname, new URLSearchParams(searchParams?.toString() || ""), nextId);
    }, [pathname, router, searchParams, suppliers]);

    const loadContext = useCallback(async () => {
        if (!initialized) return;
        if (!user) {
            setSuppliers([]);
            setActiveSupplierIdState(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const headers = await getAuthHeaders(session?.access_token);
            const res = await fetch("/api/supplier/context", { headers, credentials: "include" });
            if (!res.ok) {
                setSuppliers([]);
                setActiveSupplierIdState(null);
                return;
            }

            const payload = await res.json();
            const nextSuppliers = (payload.suppliers || []) as SupplierAccessCompany[];
            const querySupplierId = String(searchParams?.get("fornecedor") || "").trim() || null;
            const defaultSupplierId = typeof payload.defaultSupplierId === "string" ? payload.defaultSupplierId : null;

            setSuppliers(nextSuppliers);

            if (nextSuppliers.length === 0) {
                setActiveSupplierIdState(null);
                return;
            }

            if (nextSuppliers.length === 1) {
                const onlyId = nextSuppliers[0].id;
                setActiveSupplierIdState(onlyId);
                syncFornecedorQueryParam(router, pathname, new URLSearchParams(searchParams?.toString() || ""), onlyId);
                return;
            }

            if (querySupplierId && nextSuppliers.some((s) => s.id === querySupplierId)) {
                setActiveSupplierIdState(querySupplierId);
                return;
            }

            // 2+ fornecedores => exige escolha ao entrar (não persistir seleção entre acessos)
            setActiveSupplierIdState(null);

            // Mantém apenas query válida explicitamente escolhida na sessão; caso contrário, limpa
            if (querySupplierId && !nextSuppliers.some((s) => s.id === querySupplierId)) {
                syncFornecedorQueryParam(router, pathname, new URLSearchParams(searchParams?.toString() || ""), null);
            }

            // defaultSupplierId fica disponível para UI (badge/ordenação), mas não auto-seleciona
            void defaultSupplierId;
        } catch (error) {
            console.error("Erro ao carregar contexto de fornecedores:", error);
            setSuppliers([]);
            setActiveSupplierIdState(null);
        } finally {
            setLoading(false);
        }
    }, [initialized, pathname, router, searchParams, session?.access_token, user]);

    useEffect(() => {
        loadContext();
    }, [loadContext]);

    const setActiveSupplierId = useCallback((id: string | null) => {
        applyActiveSupplier(id);
    }, [applyActiveSupplier]);

    const activeSupplier = useMemo(
        () => suppliers.find((s) => s.id === activeSupplierId) || null,
        [suppliers, activeSupplierId]
    );

    const value = useMemo<SupplierAccessContextValue>(() => ({
        suppliers,
        activeSupplierId,
        activeSupplier,
        setActiveSupplierId,
        hasMultipleSuppliers: suppliers.length > 1,
        requiresSelection: suppliers.length > 1 && !activeSupplierId,
        loading,
        refresh: loadContext,
    }), [suppliers, activeSupplierId, activeSupplier, setActiveSupplierId, loading, loadContext]);

    return (
        <SupplierAccessContext.Provider value={value}>
            {children}
        </SupplierAccessContext.Provider>
    );
}

export function useSupplierAccessContext() {
    const ctx = useContext(SupplierAccessContext);
    if (!ctx) {
        throw new Error("useSupplierAccessContext must be used within SupplierAccessProvider");
    }
    return ctx;
}


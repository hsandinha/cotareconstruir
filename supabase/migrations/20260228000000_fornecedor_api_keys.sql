-- =====================================================
-- API keys para integrações de fornecedores
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fornecedor_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    scopes TEXT[] NOT NULL DEFAULT ARRAY[
        'materials:read',
        'materials:write',
        'offers:read',
        'offers:write',
        'stock:read',
        'stock:write',
        'quotes:read',
        'proposals:write',
        'orders:read',
        'orders:write',
        'webhooks:read',
        'webhooks:write'
    ]::TEXT[],
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_api_keys_fornecedor
    ON public.fornecedor_api_keys(fornecedor_id);

CREATE INDEX IF NOT EXISTS idx_fornecedor_api_keys_prefix
    ON public.fornecedor_api_keys(key_prefix);

CREATE INDEX IF NOT EXISTS idx_fornecedor_api_keys_active
    ON public.fornecedor_api_keys(fornecedor_id, revoked_at, expires_at);

DROP TRIGGER IF EXISTS update_fornecedor_api_keys_updated_at ON public.fornecedor_api_keys;
CREATE TRIGGER update_fornecedor_api_keys_updated_at
    BEFORE UPDATE ON public.fornecedor_api_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.fornecedor_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fornecedor_api_keys_select ON public.fornecedor_api_keys;
CREATE POLICY fornecedor_api_keys_select
    ON public.fornecedor_api_keys
    FOR SELECT
    TO authenticated
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1
            FROM public.user_fornecedor_access ufa
            WHERE ufa.fornecedor_id = fornecedor_api_keys.fornecedor_id
              AND ufa.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1
            FROM public.fornecedores f
            WHERE f.id = fornecedor_api_keys.fornecedor_id
              AND f.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS fornecedor_api_keys_insert ON public.fornecedor_api_keys;
CREATE POLICY fornecedor_api_keys_insert
    ON public.fornecedor_api_keys
    FOR INSERT
    TO authenticated
    WITH CHECK (
        is_admin() OR
        EXISTS (
            SELECT 1
            FROM public.user_fornecedor_access ufa
            WHERE ufa.fornecedor_id = fornecedor_api_keys.fornecedor_id
              AND ufa.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1
            FROM public.fornecedores f
            WHERE f.id = fornecedor_api_keys.fornecedor_id
              AND f.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS fornecedor_api_keys_update ON public.fornecedor_api_keys;
CREATE POLICY fornecedor_api_keys_update
    ON public.fornecedor_api_keys
    FOR UPDATE
    TO authenticated
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1
            FROM public.user_fornecedor_access ufa
            WHERE ufa.fornecedor_id = fornecedor_api_keys.fornecedor_id
              AND ufa.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1
            FROM public.fornecedores f
            WHERE f.id = fornecedor_api_keys.fornecedor_id
              AND f.user_id = auth.uid()
        )
    )
    WITH CHECK (
        is_admin() OR
        EXISTS (
            SELECT 1
            FROM public.user_fornecedor_access ufa
            WHERE ufa.fornecedor_id = fornecedor_api_keys.fornecedor_id
              AND ufa.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1
            FROM public.fornecedores f
            WHERE f.id = fornecedor_api_keys.fornecedor_id
              AND f.user_id = auth.uid()
        )
    );

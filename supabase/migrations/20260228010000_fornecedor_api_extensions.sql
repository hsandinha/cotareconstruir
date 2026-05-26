-- =====================================================
-- Extensões da API de fornecedores:
-- movimentações de estoque e endpoints de webhook
-- =====================================================

CREATE TABLE IF NOT EXISTS public.fornecedor_estoque_movimentacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    material_id UUID NOT NULL REFERENCES public.materiais(id) ON DELETE CASCADE,
    fornecedor_material_id UUID REFERENCES public.fornecedor_materiais(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL CHECK (tipo IN (
        'entrada',
        'saida',
        'ajuste',
        'reserva',
        'baixa_reserva',
        'cancelamento_reserva'
    )),
    quantidade INTEGER NOT NULL CHECK (quantidade >= 0),
    estoque_anterior INTEGER NOT NULL DEFAULT 0,
    estoque_atual INTEGER NOT NULL DEFAULT 0,
    referencia_externa TEXT,
    pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL,
    observacao TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_estoque_mov_fornecedor
    ON public.fornecedor_estoque_movimentacoes(fornecedor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fornecedor_estoque_mov_material
    ON public.fornecedor_estoque_movimentacoes(material_id, created_at DESC);

ALTER TABLE public.fornecedor_estoque_movimentacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fornecedor_estoque_mov_select ON public.fornecedor_estoque_movimentacoes;
CREATE POLICY fornecedor_estoque_mov_select
    ON public.fornecedor_estoque_movimentacoes
    FOR SELECT
    TO authenticated
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1
            FROM public.user_fornecedor_access ufa
            WHERE ufa.fornecedor_id = fornecedor_estoque_movimentacoes.fornecedor_id
              AND ufa.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1
            FROM public.fornecedores f
            WHERE f.id = fornecedor_estoque_movimentacoes.fornecedor_id
              AND f.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS fornecedor_estoque_mov_insert ON public.fornecedor_estoque_movimentacoes;
CREATE POLICY fornecedor_estoque_mov_insert
    ON public.fornecedor_estoque_movimentacoes
    FOR INSERT
    TO authenticated
    WITH CHECK (
        is_admin() OR
        EXISTS (
            SELECT 1
            FROM public.user_fornecedor_access ufa
            WHERE ufa.fornecedor_id = fornecedor_estoque_movimentacoes.fornecedor_id
              AND ufa.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1
            FROM public.fornecedores f
            WHERE f.id = fornecedor_estoque_movimentacoes.fornecedor_id
              AND f.user_id = auth.uid()
        )
    );

CREATE TABLE IF NOT EXISTS public.fornecedor_webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    description TEXT,
    events TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    secret_hash TEXT NOT NULL,
    secret_prefix TEXT NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    last_delivery_at TIMESTAMPTZ,
    last_delivery_status INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fornecedor_webhook_endpoints_fornecedor
    ON public.fornecedor_webhook_endpoints(fornecedor_id);

DROP TRIGGER IF EXISTS update_fornecedor_webhook_endpoints_updated_at ON public.fornecedor_webhook_endpoints;
CREATE TRIGGER update_fornecedor_webhook_endpoints_updated_at
    BEFORE UPDATE ON public.fornecedor_webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.fornecedor_webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fornecedor_webhook_endpoints_select ON public.fornecedor_webhook_endpoints;
CREATE POLICY fornecedor_webhook_endpoints_select
    ON public.fornecedor_webhook_endpoints
    FOR SELECT
    TO authenticated
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1
            FROM public.user_fornecedor_access ufa
            WHERE ufa.fornecedor_id = fornecedor_webhook_endpoints.fornecedor_id
              AND ufa.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1
            FROM public.fornecedores f
            WHERE f.id = fornecedor_webhook_endpoints.fornecedor_id
              AND f.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS fornecedor_webhook_endpoints_insert ON public.fornecedor_webhook_endpoints;
CREATE POLICY fornecedor_webhook_endpoints_insert
    ON public.fornecedor_webhook_endpoints
    FOR INSERT
    TO authenticated
    WITH CHECK (
        is_admin() OR
        EXISTS (
            SELECT 1
            FROM public.user_fornecedor_access ufa
            WHERE ufa.fornecedor_id = fornecedor_webhook_endpoints.fornecedor_id
              AND ufa.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1
            FROM public.fornecedores f
            WHERE f.id = fornecedor_webhook_endpoints.fornecedor_id
              AND f.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS fornecedor_webhook_endpoints_update ON public.fornecedor_webhook_endpoints;
CREATE POLICY fornecedor_webhook_endpoints_update
    ON public.fornecedor_webhook_endpoints
    FOR UPDATE
    TO authenticated
    USING (
        is_admin() OR
        EXISTS (
            SELECT 1
            FROM public.user_fornecedor_access ufa
            WHERE ufa.fornecedor_id = fornecedor_webhook_endpoints.fornecedor_id
              AND ufa.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1
            FROM public.fornecedores f
            WHERE f.id = fornecedor_webhook_endpoints.fornecedor_id
              AND f.user_id = auth.uid()
        )
    )
    WITH CHECK (
        is_admin() OR
        EXISTS (
            SELECT 1
            FROM public.user_fornecedor_access ufa
            WHERE ufa.fornecedor_id = fornecedor_webhook_endpoints.fornecedor_id
              AND ufa.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1
            FROM public.fornecedores f
            WHERE f.id = fornecedor_webhook_endpoints.fornecedor_id
              AND f.user_id = auth.uid()
        )
    );

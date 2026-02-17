-- Add context columns to mensagens table
-- So we always know: who is the client, who is the supplier, and which cotação they're talking about

ALTER TABLE public.mensagens
    ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fornecedor_id UUID REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS cotacao_id UUID REFERENCES public.cotacoes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS pedido_id UUID REFERENCES public.pedidos(id) ON DELETE SET NULL;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_mensagens_cliente ON public.mensagens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_fornecedor ON public.mensagens(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_cotacao ON public.mensagens(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_pedido ON public.mensagens(pedido_id);

-- Backfill existing messages from chat_id format "cotacaoId::fornecedorId"
UPDATE public.mensagens m
SET
    cotacao_id = (split_part(m.chat_id, '::', 1))::uuid,
    fornecedor_id = (split_part(m.chat_id, '::', 2))::uuid,
    cliente_id = c.user_id
FROM public.cotacoes c
WHERE m.chat_id LIKE '%::%'
  AND c.id = (split_part(m.chat_id, '::', 1))::uuid
  AND m.cotacao_id IS NULL;

-- Backfill existing messages from chat_id format "pedidoId" (UUID)
UPDATE public.mensagens m
SET
    pedido_id = p.id,
    fornecedor_id = p.fornecedor_id,
    cliente_id = p.user_id,
    cotacao_id = p.cotacao_id
FROM public.pedidos p
WHERE m.chat_id NOT LIKE '%::%'
  AND p.id::text = m.chat_id
  AND m.pedido_id IS NULL;

-- Drop old complex RLS policies and replace with simpler ones using the new columns
DROP POLICY IF EXISTS mensagens_select_sender ON public.mensagens;
DROP POLICY IF EXISTS mensagens_select_participant ON public.mensagens;
DROP POLICY IF EXISTS mensagens_insert ON public.mensagens;

-- Users can read messages they sent
CREATE POLICY mensagens_select_sender ON public.mensagens
    FOR SELECT USING (sender_id = auth.uid());

-- Users can read messages where they are the client
CREATE POLICY mensagens_select_client ON public.mensagens
    FOR SELECT USING (cliente_id = auth.uid());

-- Users can read messages where they are the supplier (via fornecedores.user_id)
CREATE POLICY mensagens_select_supplier ON public.mensagens
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.fornecedores f
            WHERE f.id = mensagens.fornecedor_id
            AND f.user_id = auth.uid()
        )
    );

-- Users can insert messages (they must be the sender)
CREATE POLICY mensagens_insert ON public.mensagens
    FOR INSERT WITH CHECK (sender_id = auth.uid());

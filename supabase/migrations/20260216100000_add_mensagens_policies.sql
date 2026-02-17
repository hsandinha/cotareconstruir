-- Add RLS policies for mensagens table
-- Users can read messages they sent
CREATE POLICY mensagens_select_sender ON public.mensagens
    FOR SELECT USING (sender_id = auth.uid());

-- Users can read messages in rooms they participate in (pedidos or cotações)
CREATE POLICY mensagens_select_participant ON public.mensagens
    FOR SELECT USING (
        -- Room is a pedido the user owns or supplies to
        EXISTS (
            SELECT 1 FROM public.pedidos p
            LEFT JOIN public.fornecedores f ON f.id = p.fornecedor_id
            WHERE p.id::text = mensagens.chat_id
            AND (p.user_id = auth.uid() OR f.user_id = auth.uid())
        )
        OR
        -- Room is a cotação::fornecedor format
        EXISTS (
            SELECT 1 FROM public.cotacoes c
            WHERE c.id::text = split_part(mensagens.chat_id, '::', 1)
            AND c.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.fornecedores f
            WHERE f.id::text = split_part(mensagens.chat_id, '::', 2)
            AND f.user_id = auth.uid()
        )
    );

-- Users can insert messages (they must be the sender)
CREATE POLICY mensagens_insert ON public.mensagens
    FOR INSERT WITH CHECK (sender_id = auth.uid());

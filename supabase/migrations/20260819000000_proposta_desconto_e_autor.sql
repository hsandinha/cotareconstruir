-- =====================================================
-- Desconto na proposta + autor do envio
--
-- 1) Desconto: o mapa comparativo tinha a linha "Desconto à vista" fixa em
--    "—" porque o fornecedor não tinha onde informar desconto nenhum. O campo
--    passa a ser só "Desconto" (livre para negociação), e a condição à vista
--    fica em "Condições de Pagamento".
--
-- 2) Autor do envio: o cabeçalho da Ordem de Compra mostrava o e-mail da
--    empresa no lugar do contato. Agora a proposta guarda quem a enviou,
--    já que várias pessoas podem responder pelo mesmo fornecedor
--    (ver 20260225000000_add_user_fornecedor_access_multi_company).
-- =====================================================

DO $$
BEGIN
    IF to_regclass('public.propostas') IS NOT NULL THEN
        ALTER TABLE public.propostas
            ADD COLUMN IF NOT EXISTS desconto DECIMAL(12,2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS enviada_por_user_id UUID,
            ADD COLUMN IF NOT EXISTS enviada_por_nome TEXT;

        UPDATE public.propostas SET desconto = 0 WHERE desconto IS NULL;
    END IF;

    IF to_regclass('public.pedidos') IS NOT NULL THEN
        ALTER TABLE public.pedidos
            ADD COLUMN IF NOT EXISTS desconto DECIMAL(12,2) DEFAULT 0;

        UPDATE public.pedidos SET desconto = 0 WHERE desconto IS NULL;
    END IF;
END $$;

-- FK só depois da coluna existir, e sem quebrar se `users` não estiver presente
DO $$
BEGIN
    IF to_regclass('public.propostas') IS NULL OR to_regclass('public.users') IS NULL THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'propostas_enviada_por_user_id_fkey'
    ) THEN
        ALTER TABLE public.propostas
            ADD CONSTRAINT propostas_enviada_por_user_id_fkey
            FOREIGN KEY (enviada_por_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

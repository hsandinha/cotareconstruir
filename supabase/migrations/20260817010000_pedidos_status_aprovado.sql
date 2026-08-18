-- =====================================================
-- Fluxo do pedido: status "aprovado"
--
-- O fluxo exibido ao fornecedor tem 6 etapas
-- (Pendente → Aprovado → Emissão de nota → Em separação →
--  Em transporte → Entregue), mas não existia status de banco
-- correspondente a "Aprovado": o botão "Aprovar pedido" gravava
-- 'confirmado', que a tela já lê como "Emissão de nota".
-- Resultado: o pedido nunca aparecia como aprovado.
-- =====================================================

ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;

ALTER TABLE public.pedidos
    ADD CONSTRAINT pedidos_status_check
    CHECK (status IN ('pendente', 'aprovado', 'confirmado', 'em_preparacao', 'enviado', 'entregue', 'cancelado'));

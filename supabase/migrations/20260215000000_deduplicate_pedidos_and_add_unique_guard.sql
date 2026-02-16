-- Remove pedidos duplicados mantendo o mais recente por cotação + fornecedor
WITH ranked_pedidos AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY cotacao_id, fornecedor_id
            ORDER BY created_at DESC, id DESC
        ) AS rn
    FROM public.pedidos
    WHERE cotacao_id IS NOT NULL
)
DELETE FROM public.pedidos p
USING ranked_pedidos rp
WHERE p.id = rp.id
  AND rp.rn > 1;

-- Garante unicidade de pedido por cotação + fornecedor
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_unique_cotacao_fornecedor
    ON public.pedidos (cotacao_id, fornecedor_id)
    WHERE cotacao_id IS NOT NULL;

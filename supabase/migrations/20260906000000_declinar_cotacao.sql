-- =====================================================
-- Fornecedor pode declinar uma cotação
--
-- Antes, quem não ia cotar simplesmente não respondia: a cotação ficava
-- pendente na caixa dele e o cliente esperava uma proposta que não vinha.
-- O declínio fica em `cotacao_convites`, que já é o registro da relação
-- fornecedor↔cotação (notificado, visualizado).
-- =====================================================

ALTER TABLE public.cotacao_convites
    ADD COLUMN IF NOT EXISTS declinado_em TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS motivo_declinio TEXT;

CREATE INDEX IF NOT EXISTS idx_cotacao_convites_declinado
    ON public.cotacao_convites (fornecedor_id, cotacao_id)
    WHERE declinado_em IS NOT NULL;

-- O convite pode não existir ainda (fornecedor alcançado por grupo, sem
-- convite explícito), então o declínio cria a linha se preciso.
CREATE OR REPLACE FUNCTION public.declinar_cotacao(
    p_cotacao_id UUID,
    p_fornecedor_id UUID,
    p_motivo TEXT DEFAULT NULL
)
RETURNS public.cotacao_convites
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    convite public.cotacao_convites;
BEGIN
    INSERT INTO public.cotacao_convites (cotacao_id, fornecedor_id, declinado_em, motivo_declinio)
    VALUES (p_cotacao_id, p_fornecedor_id, now(), NULLIF(btrim(COALESCE(p_motivo, '')), ''))
    ON CONFLICT (cotacao_id, fornecedor_id) DO UPDATE
        SET declinado_em = now(),
            motivo_declinio = NULLIF(btrim(COALESCE(EXCLUDED.motivo_declinio, '')), '')
    RETURNING * INTO convite;

    RETURN convite;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.declinar_cotacao(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.declinar_cotacao(UUID, UUID, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.declinar_cotacao(UUID, UUID, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

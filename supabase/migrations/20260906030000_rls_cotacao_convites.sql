-- =====================================================
-- cotacao_convites sem RLS — exposição comercial
--
-- Medido contra o banco: a tabela devolvia as 362 linhas para um visitante
-- ANÔNIMO. Ela foi criada em 20260227000000 e nunca teve RLS ligado.
--
-- O que vazava: qual fornecedor foi convidado para qual cotação, quando
-- viu, e agora também quando declinou e por quê. Isso desenha a rede de
-- fornecedores da operação e quem está disputando cada cotação —
-- exatamente o que a plataforma promete manter anônimo até o fechamento.
-- =====================================================

ALTER TABLE public.cotacao_convites ENABLE ROW LEVEL SECURITY;

-- O fornecedor enxerga os próprios convites (inclusive os que declinou)
DROP POLICY IF EXISTS cotacao_convites_fornecedor ON public.cotacao_convites;
CREATE POLICY cotacao_convites_fornecedor ON public.cotacao_convites
    FOR SELECT TO authenticated
    USING (
        fornecedor_id IN (
            SELECT ufa.fornecedor_id
            FROM public.user_fornecedor_access ufa
            WHERE ufa.user_id = auth.uid()
            UNION
            SELECT u.fornecedor_id
            FROM public.users u
            WHERE u.id = auth.uid() AND u.fornecedor_id IS NOT NULL
        )
    );

-- O cliente enxerga os convites das cotações dele — é o que alimenta o
-- acompanhamento ("quantos fornecedores receberam, quantos responderam").
DROP POLICY IF EXISTS cotacao_convites_cliente ON public.cotacao_convites;
CREATE POLICY cotacao_convites_cliente ON public.cotacao_convites
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.cotacoes c
            WHERE c.id = cotacao_convites.cotacao_id
              AND c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS cotacao_convites_admin ON public.cotacao_convites;
CREATE POLICY cotacao_convites_admin ON public.cotacao_convites
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- As rotas de API que gravam convite/declínio usam a service key, que
-- passa por cima do RLS — nenhuma política de INSERT é necessária aqui.

NOTIFY pgrst, 'reload schema';

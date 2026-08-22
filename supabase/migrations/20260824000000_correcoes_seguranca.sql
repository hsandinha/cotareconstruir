-- =====================================================
-- Correções de segurança (auditoria de 21/08/2026)
--
-- 1) VAZAMENTO DE DADOS PESSOAIS — crítico
--    `clientes`, `fabricantes` e `solicitacoes_materiais` estavam com RLS
--    ligado mas com política permissiva (criada fora do repositório), então
--    QUALQUER visitante com a chave anon — que vai no bundle do navegador,
--    é pública por definição — lia a tabela inteira.
--
--    Verificado contra o banco: `clientes` devolvia as 3 linhas com
--    nome, CPF/CNPJ, e-mail, telefone e endereço completo. Dado pessoal
--    sensível exposto à internet (LGPD, art. 46).
--
--    Como as políticas antigas não estão no repositório e não sabemos os
--    nomes, este migration remove TODAS as políticas dessas tabelas antes
--    de recriar as corretas.
-- =====================================================

-- ---------- 1) Limpa políticas herdadas e reescreve ----------
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN ('clientes', 'fabricantes', 'solicitacoes_materiais')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
        RAISE NOTICE 'Política removida: %.%', pol.tablename, pol.policyname;
    END LOOP;
END $$;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fabricantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitacoes_materiais ENABLE ROW LEVEL SECURITY;

-- clientes: cada um enxerga o próprio cadastro; admin enxerga tudo.
-- As telas de fornecedor recebem esses dados pelas rotas de API, que usam
-- a service key — não precisam de acesso direto.
CREATE POLICY clientes_proprio ON public.clientes
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY clientes_atualiza_proprio ON public.clientes
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY clientes_admin ON public.clientes
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- fabricantes: catálogo de apoio; quem está logado lê, admin escreve
CREATE POLICY fabricantes_leitura ON public.fabricantes
    FOR SELECT TO authenticated USING (true);

CREATE POLICY fabricantes_admin ON public.fabricantes
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- solicitacoes_materiais: o solicitante vê as próprias; admin vê todas
CREATE POLICY solicitacoes_proprias ON public.solicitacoes_materiais
    FOR SELECT TO authenticated
    USING (solicitante_user_id = auth.uid());

CREATE POLICY solicitacoes_cria ON public.solicitacoes_materiais
    FOR INSERT TO authenticated
    WITH CHECK (solicitante_user_id = auth.uid());

CREATE POLICY solicitacoes_admin ON public.solicitacoes_materiais
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ---------- 2) Varredura: tabela com RLS ligado e sem política ----------
-- RLS sem política nenhuma nega tudo (menos para a service key), o que
-- quebra tela em silêncio. Só avisa, não altera.
DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND c.relrowsecurity
          AND NOT EXISTS (
              SELECT 1 FROM pg_policies p
              WHERE p.schemaname = 'public' AND p.tablename = c.relname
          )
    LOOP
        RAISE NOTICE 'ATENÇÃO: % tem RLS ligado e nenhuma política (nega tudo).', t.relname;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- =====================================================
-- fornecedor_fabricante sem RLS
--
-- Apontado pelo verificador ("RLS Disabled in Public") e confirmado
-- contra o banco: a tabela está exposta ao PostgREST sem RLS nenhum.
--
-- O teste de escrita retornou 23503 (violação de chave estrangeira) e NÃO
-- erro de permissão — ou seja, o INSERT era permitido, só falhou porque os
-- UUIDs de teste não existiam. Com IDs válidos, qualquer usuário
-- autenticado escreveria vínculos fornecedor↔fabricante arbitrários.
--
-- Por que isso importa: `lib/supplierMaterialsService` usa esta tabela para
-- AUTORIZAR de quais fabricantes um fornecedor pode cadastrar material.
-- Escrever nela é conceder permissão de marca a si mesmo — ou a terceiros.
--
-- A tabela está vazia hoje (0 linhas), o que mascarou o problema: uma
-- varredura que só olha "quantas linhas o anônimo lê" passa batido.
-- =====================================================

ALTER TABLE public.fornecedor_fabricante ENABLE ROW LEVEL SECURITY;

-- O fornecedor enxerga os próprios vínculos de marca
DROP POLICY IF EXISTS fornecedor_fabricante_proprio ON public.fornecedor_fabricante;
CREATE POLICY fornecedor_fabricante_proprio ON public.fornecedor_fabricante
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

-- Escrita é do admin. Nenhuma tela do fornecedor grava aqui: o vínculo é
-- concessão comercial, não autoatendimento. As rotas de servidor usam a
-- service key e passam por cima do RLS de qualquer forma.
DROP POLICY IF EXISTS fornecedor_fabricante_admin ON public.fornecedor_fabricante;
CREATE POLICY fornecedor_fabricante_admin ON public.fornecedor_fabricante
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ---------- Varredura final: sobrou alguma tabela sem RLS? ----------
DO $$
DECLARE
    t RECORD;
    achou BOOLEAN := FALSE;
BEGIN
    FOR t IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind = 'r'
          AND NOT c.relrowsecurity
        ORDER BY c.relname
    LOOP
        achou := TRUE;
        RAISE NOTICE 'ATENÇÃO: public.% está exposta sem RLS.', t.relname;
    END LOOP;

    IF NOT achou THEN
        RAISE NOTICE 'Todas as tabelas de public têm RLS ligado.';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

-- Suporte a 1 login de fornecedor para múltiplos fornecedores (CNPJs)
-- Mantém compatibilidade legada via users.fornecedor_id (primário) e fornecedores.user_id (primário)

CREATE TABLE IF NOT EXISTS public.user_fornecedor_access (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    fornecedor_id UUID NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, fornecedor_id)
);

CREATE INDEX IF NOT EXISTS idx_user_fornecedor_access_user_id
    ON public.user_fornecedor_access (user_id);

CREATE INDEX IF NOT EXISTS idx_user_fornecedor_access_fornecedor_id
    ON public.user_fornecedor_access (fornecedor_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_fornecedor_access_one_primary_per_user
    ON public.user_fornecedor_access (user_id)
    WHERE is_primary = TRUE;

DROP TRIGGER IF EXISTS update_user_fornecedor_access_updated_at ON public.user_fornecedor_access;
CREATE TRIGGER update_user_fornecedor_access_updated_at
    BEFORE UPDATE ON public.user_fornecedor_access
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Backfill a partir de users.fornecedor_id (fonte primária legada)
-- Ignora ponteiros órfãos (users.fornecedor_id apontando para fornecedor inexistente)
INSERT INTO public.user_fornecedor_access (user_id, fornecedor_id, is_primary)
SELECT u.id, u.fornecedor_id, TRUE
FROM public.users u
JOIN public.fornecedores f_existente
  ON f_existente.id = u.fornecedor_id
WHERE u.fornecedor_id IS NOT NULL
ON CONFLICT (user_id, fornecedor_id)
DO UPDATE SET
    is_primary = TRUE,
    updated_at = NOW();

-- Backfill complementar a partir de fornecedores.user_id
-- Ignora ponteiros órfãos (fornecedores.user_id apontando para usuário inexistente)
INSERT INTO public.user_fornecedor_access (user_id, fornecedor_id, is_primary)
SELECT f.user_id, f.id, FALSE
FROM public.fornecedores f
JOIN public.users u_existente
  ON u_existente.id = f.user_id
WHERE f.user_id IS NOT NULL
ON CONFLICT (user_id, fornecedor_id) DO NOTHING;

-- Garantir no máximo 1 primário por usuário (preserva o atual se existir)
WITH ranked AS (
    SELECT
        id,
        user_id,
        ROW_NUMBER() OVER (
            PARTITION BY user_id
            ORDER BY is_primary DESC, created_at ASC, id ASC
        ) AS rn
    FROM public.user_fornecedor_access
)
UPDATE public.user_fornecedor_access ufa
SET
    is_primary = (ranked.rn = 1),
    updated_at = NOW()
FROM ranked
WHERE ufa.id = ranked.id
  AND ufa.is_primary IS DISTINCT FROM (ranked.rn = 1);

-- Sincronizar ponteiro legado users.fornecedor_id (primário)
UPDATE public.users u
SET
    fornecedor_id = p.fornecedor_id,
    updated_at = NOW()
FROM (
    SELECT DISTINCT ON (user_id) user_id, fornecedor_id
    FROM public.user_fornecedor_access
    ORDER BY user_id, is_primary DESC, created_at ASC, id ASC
) p
WHERE u.id = p.user_id
  AND u.fornecedor_id IS DISTINCT FROM p.fornecedor_id;

UPDATE public.users u
SET
    fornecedor_id = NULL,
    updated_at = NOW()
WHERE u.fornecedor_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.user_fornecedor_access ufa
      WHERE ufa.user_id = u.id
  );

-- Sincronizar ponteiro legado fornecedores.user_id (somente primário)
UPDATE public.fornecedores
SET
    user_id = NULL,
    updated_at = NOW()
WHERE user_id IS NOT NULL;

UPDATE public.fornecedores f
SET
    user_id = p.user_id,
    updated_at = NOW()
FROM (
    SELECT DISTINCT ON (user_id) user_id, fornecedor_id
    FROM public.user_fornecedor_access
    ORDER BY user_id, is_primary DESC, created_at ASC, id ASC
) p
WHERE f.id = p.fornecedor_id
  AND f.user_id IS DISTINCT FROM p.user_id;

-- Policies da tabela de vínculo
ALTER TABLE public.user_fornecedor_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_fornecedor_access_select ON public.user_fornecedor_access;
CREATE POLICY user_fornecedor_access_select
    ON public.user_fornecedor_access
    FOR SELECT
    USING (is_admin() OR user_id = auth.uid());

DROP POLICY IF EXISTS user_fornecedor_access_manage ON public.user_fornecedor_access;
CREATE POLICY user_fornecedor_access_manage
    ON public.user_fornecedor_access
    FOR ALL
    USING (is_admin())
    WITH CHECK (is_admin());

-- Ajustes de policies para aceitar vínculo via tabela N:N (mantendo fallback legado)
DROP POLICY IF EXISTS fornecedor_grupo_insert ON public.fornecedor_grupo;
CREATE POLICY fornecedor_grupo_insert ON public.fornecedor_grupo FOR INSERT WITH CHECK (
    is_admin() OR
    EXISTS (
        SELECT 1
        FROM public.user_fornecedor_access ufa
        WHERE ufa.fornecedor_id = fornecedor_grupo.fornecedor_id
          AND ufa.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1
        FROM public.fornecedores f
        WHERE f.id = fornecedor_grupo.fornecedor_id
          AND f.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS fornecedor_grupo_delete ON public.fornecedor_grupo;
CREATE POLICY fornecedor_grupo_delete ON public.fornecedor_grupo FOR DELETE USING (
    is_admin() OR
    EXISTS (
        SELECT 1
        FROM public.user_fornecedor_access ufa
        WHERE ufa.fornecedor_id = fornecedor_grupo.fornecedor_id
          AND ufa.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1
        FROM public.fornecedores f
        WHERE f.id = fornecedor_grupo.fornecedor_id
          AND f.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS fornecedor_materiais_select ON public.fornecedor_materiais;
CREATE POLICY fornecedor_materiais_select ON public.fornecedor_materiais FOR SELECT TO authenticated USING (
    is_admin() OR
    EXISTS (
        SELECT 1
        FROM public.user_fornecedor_access ufa
        WHERE ufa.fornecedor_id = fornecedor_materiais.fornecedor_id
          AND ufa.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1
        FROM public.fornecedores f
        WHERE f.id = fornecedor_materiais.fornecedor_id
          AND f.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS fornecedor_materiais_insert ON public.fornecedor_materiais;
CREATE POLICY fornecedor_materiais_insert ON public.fornecedor_materiais FOR INSERT WITH CHECK (
    is_admin() OR
    EXISTS (
        SELECT 1
        FROM public.user_fornecedor_access ufa
        WHERE ufa.fornecedor_id = fornecedor_materiais.fornecedor_id
          AND ufa.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1
        FROM public.fornecedores f
        WHERE f.id = fornecedor_materiais.fornecedor_id
          AND f.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS fornecedor_materiais_update ON public.fornecedor_materiais;
CREATE POLICY fornecedor_materiais_update ON public.fornecedor_materiais FOR UPDATE USING (
    is_admin() OR
    EXISTS (
        SELECT 1
        FROM public.user_fornecedor_access ufa
        WHERE ufa.fornecedor_id = fornecedor_materiais.fornecedor_id
          AND ufa.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1
        FROM public.fornecedores f
        WHERE f.id = fornecedor_materiais.fornecedor_id
          AND f.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS fornecedor_materiais_delete ON public.fornecedor_materiais;
CREATE POLICY fornecedor_materiais_delete ON public.fornecedor_materiais FOR DELETE USING (
    is_admin() OR
    EXISTS (
        SELECT 1
        FROM public.user_fornecedor_access ufa
        WHERE ufa.fornecedor_id = fornecedor_materiais.fornecedor_id
          AND ufa.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1
        FROM public.fornecedores f
        WHERE f.id = fornecedor_materiais.fornecedor_id
          AND f.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS ofertas_manage ON public.ofertas;
CREATE POLICY ofertas_manage ON public.ofertas FOR ALL USING (
    is_admin() OR
    EXISTS (
        SELECT 1
        FROM public.user_fornecedor_access ufa
        WHERE ufa.fornecedor_id = ofertas.fornecedor_id
          AND ufa.user_id = auth.uid()
    ) OR
    EXISTS (
        SELECT 1
        FROM public.fornecedores f
        WHERE f.id = ofertas.fornecedor_id
          AND f.user_id = auth.uid()
    )
);

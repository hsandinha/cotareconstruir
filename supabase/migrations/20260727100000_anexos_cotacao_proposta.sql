-- Anexos de cotações (cliente) e propostas (fornecedor):
-- projetos, detalhes, especificações complementares etc.

-- 1) Bucket público de storage (URLs não adivinháveis; limite 20MB por arquivo)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('cotacao-anexos', 'cotacao-anexos', true, 20971520)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS cotacao_anexos_upload ON storage.objects;
CREATE POLICY cotacao_anexos_upload ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'cotacao-anexos');

DROP POLICY IF EXISTS cotacao_anexos_delete_own ON storage.objects;
CREATE POLICY cotacao_anexos_delete_own ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'cotacao-anexos' AND owner = auth.uid());

-- 2) Metadados dos anexos da cotação (enviados pelo cliente)
CREATE TABLE IF NOT EXISTS public.cotacao_anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cotacao_id UUID NOT NULL REFERENCES public.cotacoes(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    url TEXT NOT NULL,
    tipo TEXT,
    tamanho BIGINT,
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cotacao_anexos_cotacao ON public.cotacao_anexos(cotacao_id);

ALTER TABLE public.cotacao_anexos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cotacao_anexos_select ON public.cotacao_anexos;
CREATE POLICY cotacao_anexos_select ON public.cotacao_anexos
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cotacao_anexos_all ON public.cotacao_anexos;
CREATE POLICY cotacao_anexos_all ON public.cotacao_anexos
    FOR ALL USING (is_admin());

-- 3) Metadados dos anexos da proposta (enviados pelo fornecedor)
CREATE TABLE IF NOT EXISTS public.proposta_anexos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    url TEXT NOT NULL,
    tipo TEXT,
    tamanho BIGINT,
    uploaded_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proposta_anexos_proposta ON public.proposta_anexos(proposta_id);

ALTER TABLE public.proposta_anexos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proposta_anexos_select ON public.proposta_anexos;
CREATE POLICY proposta_anexos_select ON public.proposta_anexos
    FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS proposta_anexos_all ON public.proposta_anexos;
CREATE POLICY proposta_anexos_all ON public.proposta_anexos
    FOR ALL USING (is_admin());

-- =====================================================
-- Depoimentos em vídeo na página inicial
--
-- Os vídeos são carregados pelo admin (painel > Depoimentos) e vão para o
-- bucket `depoimentos` do Storage. A landing lê só os ativos, na ordem
-- definida pelo admin.
--
-- Bucket separado de `cotacao-anexos` porque vídeo pesa muito mais que
-- anexo de cotação (limite de 20MB lá, 200MB aqui) e porque o conteúdo é
-- público de verdade — vai na home, sem login.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.depoimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    nome TEXT NOT NULL,
    cargo TEXT,              -- ex.: "Engenheiro Civil"
    empresa TEXT,            -- ex.: "Construtora Palhares"
    obra TEXT,               -- ex.: "Residencial Havaí, 12 pavimentos"

    -- Frase de destaque; aparece como legenda e é o texto lido por quem
    -- não vai dar play (e por leitores de tela).
    citacao TEXT,

    video_url TEXT NOT NULL,
    poster_url TEXT,         -- capa; sem ela o navegador mostra o 1º frame
    duracao_segundos INTEGER,

    ordem INTEGER NOT NULL DEFAULT 0,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS depoimentos_vitrine_idx
    ON public.depoimentos (ordem, created_at)
    WHERE ativo;

-- ---------- RLS ----------
ALTER TABLE public.depoimentos ENABLE ROW LEVEL SECURITY;

-- A landing é pública: qualquer visitante lê os depoimentos ativos
DROP POLICY IF EXISTS depoimentos_publico ON public.depoimentos;
CREATE POLICY depoimentos_publico ON public.depoimentos
    FOR SELECT TO anon, authenticated USING (ativo);

DROP POLICY IF EXISTS depoimentos_admin ON public.depoimentos;
CREATE POLICY depoimentos_admin ON public.depoimentos
    FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- ---------- Bucket dos vídeos ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'depoimentos',
    'depoimentos',
    TRUE,
    209715200, -- 200MB
    ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
    SET public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura pública (o vídeo toca na home, sem login)
DROP POLICY IF EXISTS depoimentos_storage_leitura ON storage.objects;
CREATE POLICY depoimentos_storage_leitura ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'depoimentos');

-- Só o admin carrega, troca ou apaga vídeo
DROP POLICY IF EXISTS depoimentos_storage_admin ON storage.objects;
CREATE POLICY depoimentos_storage_admin ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'depoimentos' AND is_admin())
    WITH CHECK (bucket_id = 'depoimentos' AND is_admin());

NOTIFY pgrst, 'reload schema';

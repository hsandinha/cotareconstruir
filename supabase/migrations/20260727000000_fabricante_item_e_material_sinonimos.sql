-- 1) Fabricante escolhido pelo cliente por item da cotação
ALTER TABLE public.cotacao_itens
    ADD COLUMN IF NOT EXISTS fabricante TEXT;

-- 2) Cadastro de sinônimos de materiais/especificações
--    Cada linha é um grupo de termos equivalentes (ex.: bacia = vaso sanitário).
--    A busca de materiais expande o termo digitado para todos os termos do grupo.
CREATE TABLE IF NOT EXISTS public.material_sinonimos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    termos TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.material_sinonimos ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler (a busca do cliente usa); apenas admin escreve
DROP POLICY IF EXISTS material_sinonimos_select ON public.material_sinonimos;
CREATE POLICY material_sinonimos_select ON public.material_sinonimos
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS material_sinonimos_all ON public.material_sinonimos;
CREATE POLICY material_sinonimos_all ON public.material_sinonimos
    FOR ALL USING (is_admin());

-- Exemplo inicial
INSERT INTO public.material_sinonimos (termos)
SELECT ARRAY['bacia', 'vaso sanitário']
WHERE NOT EXISTS (
    SELECT 1 FROM public.material_sinonimos WHERE termos @> ARRAY['bacia']
);

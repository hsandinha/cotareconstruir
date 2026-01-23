-- =====================================================
-- Criar tabela obra_etapas para armazenar etapas de cada obra
-- =====================================================

-- 1. Primeiro, remover campos obsoletos da tabela obras
-- (etapa e fase_id não são mais necessários pois as etapas estão em obra_etapas)
ALTER TABLE obras DROP COLUMN IF EXISTS etapa;
ALTER TABLE obras DROP COLUMN IF EXISTS fase_id;

-- 2. Adicionar campos de horário de entrega na tabela obras
ALTER TABLE obras ADD COLUMN IF NOT EXISTS restricoes_entrega TEXT;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS horario_entrega JSONB;

-- 3. Tabela que relaciona obras com suas etapas/fases
CREATE TABLE IF NOT EXISTS obra_etapas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    fase_id UUID NOT NULL REFERENCES fases(id) ON DELETE RESTRICT,
    
    -- Dados da etapa
    nome TEXT NOT NULL,
    categoria TEXT DEFAULT 'Fase da Obra',
    
    -- Datas
    data_prevista DATE NOT NULL,
    data_fim_prevista DATE,
    data_conclusao DATE,
    
    -- Configurações
    dias_antecedencia_cotacao INTEGER DEFAULT 15,
    is_completed BOOLEAN DEFAULT false,
    
    -- Ordem/sequência
    ordem INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_obra_etapas_obra_id ON obra_etapas(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_etapas_fase_id ON obra_etapas(fase_id);
CREATE INDEX IF NOT EXISTS idx_obra_etapas_data_prevista ON obra_etapas(data_prevista);

-- RLS Policies
ALTER TABLE obra_etapas ENABLE ROW LEVEL SECURITY;

-- Política de SELECT - usuário pode ver etapas das suas obras
DROP POLICY IF EXISTS obra_etapas_select ON obra_etapas;
CREATE POLICY obra_etapas_select ON obra_etapas FOR SELECT USING (
    obra_id IN (SELECT id FROM obras WHERE user_id = auth.uid())
);

-- Política de INSERT - usuário pode criar etapas em suas obras
DROP POLICY IF EXISTS obra_etapas_insert ON obra_etapas;
CREATE POLICY obra_etapas_insert ON obra_etapas FOR INSERT WITH CHECK (
    obra_id IN (SELECT id FROM obras WHERE user_id = auth.uid())
);

-- Política de UPDATE - usuário pode atualizar etapas de suas obras  
DROP POLICY IF EXISTS obra_etapas_update ON obra_etapas;
CREATE POLICY obra_etapas_update ON obra_etapas FOR UPDATE USING (
    obra_id IN (SELECT id FROM obras WHERE user_id = auth.uid())
);

-- Política de DELETE - usuário pode deletar etapas de suas obras
DROP POLICY IF EXISTS obra_etapas_delete ON obra_etapas;
CREATE POLICY obra_etapas_delete ON obra_etapas FOR DELETE USING (
    obra_id IN (SELECT id FROM obras WHERE user_id = auth.uid())
);

-- Se der problema com RLS, use estas policies simplificadas:
-- DROP POLICY IF EXISTS obra_etapas_select ON obra_etapas;
-- DROP POLICY IF EXISTS obra_etapas_insert ON obra_etapas;
-- DROP POLICY IF EXISTS obra_etapas_update ON obra_etapas;
-- DROP POLICY IF EXISTS obra_etapas_delete ON obra_etapas;
-- CREATE POLICY obra_etapas_all ON obra_etapas USING (true);

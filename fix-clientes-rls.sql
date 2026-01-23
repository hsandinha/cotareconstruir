-- Políticas RLS para tabela clientes

-- Habilitar RLS se ainda não estiver
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "clientes_select" ON clientes;
DROP POLICY IF EXISTS "clientes_insert" ON clientes;
DROP POLICY IF EXISTS "clientes_update" ON clientes;

-- Permitir que usuários autenticados vejam seus próprios dados
CREATE POLICY "clientes_select" ON clientes
FOR SELECT USING (
  auth.uid()::text = user_id OR
  auth.uid()::text IN (SELECT id FROM users WHERE cliente_id = clientes.id)
);

-- Permitir que service role faça qualquer operação (usado pela API)
CREATE POLICY "clientes_service_role" ON clientes
FOR ALL USING (
  auth.jwt() ->> 'role' = 'service_role'
);

-- Permitir inserção para usuários autenticados
CREATE POLICY "clientes_insert" ON clientes
FOR INSERT WITH CHECK (
  auth.uid()::text = user_id
);

-- Permitir atualização para o próprio usuário
CREATE POLICY "clientes_update" ON clientes
FOR UPDATE USING (
  auth.uid()::text = user_id OR
  auth.uid()::text IN (SELECT id FROM users WHERE cliente_id = clientes.id)
);

# Migration: Adicionar Coluna Impostos

## Descrição
Esta migration adiciona o campo `impostos` (valor monetário em R$) nas tabelas `propostas` e `pedidos`.

Anteriormente, o valor de impostos era armazenado como uma tag `[IMPOSTOS=valor]` no campo `observacoes`. Agora, o valor é armazenado em uma coluna dedicada.

## Arquivo da Migration
`supabase/migrations/20260217110000_add_impostos_column.sql`

## O que a Migration Faz

1. **Adiciona coluna `impostos` em `propostas`**:
   - Tipo: `DECIMAL(12,2)`
   - Valor padrão: `0`
   - Descrição: Valor monetário de impostos (R$) informado pelo fornecedor na proposta

2. **Adiciona coluna `impostos` em `pedidos`**:
   - Tipo: `DECIMAL(12,2)`
   - Valor padrão: `0`
   - Descrição: Valor monetário de impostos (R$) do pedido confirmado

## Como Aplicar

### Opção 1: Via Supabase Dashboard (Recomendado)
1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **SQL Editor** no menu lateral
4. Clique em **New Query**
5. Copie todo o conteúdo do arquivo `supabase/migrations/20260217110000_add_impostos_column.sql`
6. Cole no editor SQL
7. Clique em **Run** para executar

### Opção 2: Via Supabase CLI (se instalado)
```bash
supabase db push
```

## Impacto nas APIs

### API de Propostas (`/api/propostas`)
- **Antes**: Impostos armazenados em `observacoes` como `[IMPOSTOS=valor]`
- **Agora**: Impostos armazenados diretamente no campo `impostos`

### API de Cotações (`/api/cotacoes/detail`)
- **Antes**: Impostos extraídos de `observacoes` via regex
- **Agora**: Impostos lidos diretamente do campo `impostos`

### API de Pedidos
- Campo `impostos` é copiado da proposta ao criar pedido
- Campo `impostos` é atualizado ao atualizar proposta vinculada

## Alterações no Código

### Backend
1. **`/app/api/propostas/route.ts`**:
   - Removida função `buildObservacoesWithTaxes()`
   - Campo `impostos` adicionado ao payload de criação/atualização
   - Campo `impostos` adicionado ao update de pedidos

2. **`/app/api/cotacoes/detail/route.ts`**:
   - Removida função `extractImpostosFromObservacoes()`
   - Campo `impostos` incluído na criação de pedidos
   - Campo `impostos` enviado no `itemsBySupplier`

### Frontend
3. **`/components/dashboard/client/ComparativeSection.tsx`**:
   - Campo `impostos` lido de `p.impostos` (não mais `p.valor_impostos`)
   - Campo `impostos` incluído no `supplierGroups` ao gerar ordem de compra
   - Exibição no mapa comparativo: "R$ XX.XX" ou "-" (se zero)

## Migração de Dados Existentes

A migration **NÃO** migra automaticamente dados antigos de `observacoes` para o campo `impostos`. Propostas e pedidos existentes terão `impostos = 0` até serem atualizados.

Se necessário migrar dados históricos, execute este script SQL manualmente:

```sql
-- Extrair impostos de observações antigas e atualizar campo impostos
-- ATENÇÃO: Executar apenas uma vez!

UPDATE public.propostas
SET impostos = (
    SELECT CAST(
        SUBSTRING(observacoes FROM '\[IMPOSTOS=([\d.]+)\]') AS DECIMAL(12,2)
    )
)
WHERE observacoes ~ '\[IMPOSTOS=[\d.]+\]'
AND impostos = 0;

UPDATE public.pedidos p
SET impostos = COALESCE(
    (SELECT pr.impostos FROM public.propostas pr WHERE pr.id = p.proposta_id LIMIT 1),
    0
)
WHERE p.impostos = 0
AND p.proposta_id IS NOT NULL;
```

## Estrutura Final

### Tabela `propostas`
```sql
-- ... outros campos ...
valor_total DECIMAL(12,2),
valor_frete DECIMAL(12,2) DEFAULT 0,
impostos DECIMAL(12,2) DEFAULT 0,  -- ← NOVO
prazo_entrega INTEGER,
-- ... outros campos ...
```

### Tabela `pedidos`
```sql
-- ... outros campos ...
valor_total DECIMAL(12,2) NOT NULL,
impostos DECIMAL(12,2) DEFAULT 0,  -- ← NOVO
forma_pagamento TEXT,
-- ... outros campos ...
```

## Validação

Após aplicar a migration, verifique:

1. **Estrutura das tabelas**:
```sql
\d public.propostas;
\d public.pedidos;
```

2. **Novas propostas salvam impostos corretamente**:
```sql
SELECT id, valor_total, valor_frete, impostos, observacoes 
FROM public.propostas 
ORDER BY created_at DESC 
LIMIT 5;
```

3. **Mapa comparativo exibe impostos**:
   - Acesse uma cotação respondida
   - Verifique a linha "Impostos" no mapa comparativo
   - Deve exibir valores em R$ ou "-"

## Rollback

Para reverter esta migration:

```sql
-- Remover coluna impostos de propostas
ALTER TABLE public.propostas DROP COLUMN IF EXISTS impostos;

-- Remover coluna impostos de pedidos
ALTER TABLE public.pedidos DROP COLUMN IF EXISTS impostos;
```

**⚠️ ATENÇÃO**: O rollback resulta em perda permanente dos valores de impostos armazenados na coluna!

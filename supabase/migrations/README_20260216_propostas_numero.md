# Migration: Adicionar Número em Propostas

## Descrição
Esta migration adiciona o campo `numero` na tabela `propostas` para identificar cada proposta com um número único e sequencial (somente números, sem caracteres especiais ou letras).

## Arquivo da Migration
`supabase/migrations/20260216000000_add_numero_propostas.sql`

## Como Aplicar

### Opção 1: Via Supabase Dashboard (Recomendado)
1. Acesse o [Supabase Dashboard](https://app.supabase.com)
2. Selecione seu projeto
3. Vá em **SQL Editor** no menu lateral
4. Clique em **New Query**
5. Copie todo o conteúdo do arquivo `supabase/migrations/20260216000000_add_numero_propostas.sql`
6. Cole no editor SQL
7. Clique em **Run** para executar

### Opção 2: Via Script Node.js
```bash
node scripts/migrate-add-numero-propostas.mjs
```

**Nota:** Certifique-se de que as variáveis de ambiente `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` estejam configuradas.

### Opção 3: Via Supabase CLI (se instalado)
```bash
supabase db push
```

## O que a Migration Faz

1. **Adiciona coluna `numero`**: Cria uma coluna TEXT UNIQUE na tabela `propostas`
2. **Cria sequence**: Cria `proposta_numero_seq` começando em 10001
3. **Cria função trigger**: Função `generate_proposta_numero()` para auto-gerar números
4. **Cria trigger**: Trigger `set_proposta_numero` que executa antes de cada INSERT
5. **Atualiza registros existentes**: Atribui números sequenciais às propostas existentes
6. **Ajusta sequence**: Sincroniza a sequence com o maior número existente

## Resultado
Após a migration, cada proposta terá um número único:
- Primeira proposta: numero = "10001"
- Segunda proposta: numero = "10002"
- E assim por diante...

## Interface Atualizada
O número da proposta agora aparece:
- Na tela de visualização de propostas respondidas
- No formulário de atualização de proposta (modo edição)
- Formato de exibição: `#10001`, `#10002`, etc.

## Rollback
Se precisar reverter esta migration:

```sql
-- Remover trigger
DROP TRIGGER IF EXISTS set_proposta_numero ON public.propostas;

-- Remover função
DROP FUNCTION IF EXISTS generate_proposta_numero();

-- Remover sequence
DROP SEQUENCE IF EXISTS proposta_numero_seq;

-- Remover coluna
ALTER TABLE public.propostas DROP COLUMN IF EXISTS numero;
```

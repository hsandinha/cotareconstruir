# API de Fornecedores

Documentação técnica para fornecedores integrarem ERP, e-commerce ou backoffice com a plataforma Comprar e Construir.

Base v1:

```text
https://SEU_DOMINIO/api/fornecedores/v1
```

Em desenvolvimento local:

```text
http://localhost:3000/api/fornecedores/v1
```

## Visão Geral

| Área | Status | Endpoints |
| --- | --- | --- |
| Catálogo | Disponível | `GET /catalogo-materiais` |
| Materiais | Disponível | `GET /materiais`, `PUT /materiais` |
| Estoque | Disponível | `GET /estoques`, `GET /estoques/{material_id}`, `PUT /estoques`, `GET/POST /estoques/movimentacoes` |
| Ofertas | Disponível | `GET/POST /ofertas`, `GET/PATCH/DELETE /ofertas/{oferta_id}`, `PATCH /ofertas/{oferta_id}/status` |
| Cotações | Disponível | `GET /cotacoes`, `GET /cotacoes/{cotacao_id}` |
| Propostas | Disponível | `POST /cotacoes/{cotacao_id}/propostas`, `PUT /cotacoes/{cotacao_id}/propostas/{proposta_id}` |
| Pedidos | Disponível | `GET /pedidos`, `GET /pedidos/{pedido_id}`, `PATCH /pedidos/{pedido_id}/status` |
| Webhooks | Disponível para cadastro | `GET/POST /webhooks`, `GET/PATCH/DELETE /webhooks/{webhook_id}`, `POST /webhooks/{webhook_id}/test` |
| Chaves de API | Disponível no dashboard | `Cadastro & Perfil > Chaves de API` |

## Autenticação

A autenticação usa API key por fornecedor. A chave completa aparece somente uma vez no dashboard.

Formato:

```text
ccfk_xxxxxx_yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy
```

Envie a chave em um dos headers:

```http
Authorization: Bearer ccfk_xxxxxx_yyyyyyyy
```

ou:

```http
X-API-Key: ccfk_xxxxxx_yyyyyyyy
```

Regras:

- `fornecedor_id` nunca deve ser enviado na API pública. Ele é inferido pela chave.
- Chaves inválidas, revogadas ou expiradas retornam `401`.
- Fornecedor inativo ou suspenso retorna `403`.
- O rate limit é aplicado por chave.
- A chave precisa conter o escopo exigido pelo endpoint.

## Escopos

| Escopo | Uso |
| --- | --- |
| `materials:read` | Ler catálogo e materiais configurados. |
| `materials:write` | Criar ou atualizar materiais. |
| `stock:read` | Ler estoque e movimentações. |
| `stock:write` | Atualizar estoque e registrar movimentações. |
| `offers:read` | Ler ofertas. |
| `offers:write` | Criar, atualizar, pausar e remover ofertas. |
| `quotes:read` | Ler cotações disponíveis ao fornecedor. |
| `proposals:write` | Enviar ou atualizar propostas. |
| `orders:read` | Ler pedidos. |
| `orders:write` | Atualizar status de pedidos. |
| `webhooks:read` | Ler webhooks cadastrados. |
| `webhooks:write` | Criar, atualizar, desativar e testar webhooks. |

## Headers

| Header | Obrigatório | Descrição |
| --- | --- | --- |
| `Authorization` | Sim, exceto se usar `X-API-Key` | `Bearer <api_key>`. |
| `X-API-Key` | Sim, exceto se usar `Authorization` | API key diretamente no header. |
| `Content-Type` | Sim em escrita | Use `application/json`. |
| `Accept` | Não | Recomenda-se `application/json`. |

## Paginação

Endpoints de listagem retornam paginação por página:

| Query | Padrão | Máximo | Descrição |
| --- | --- | --- | --- |
| `page` | `1` | - | Página inicial em `1`. |
| `page_size` | `100` | `500` | Tamanho da página. Alguns módulos limitam a `200`. |

Resposta:

```json
{
  "data": [],
  "page": 1,
  "page_size": 100,
  "total": 0,
  "total_pages": 0
}
```

## Erros

Formato padrão:

```json
{
  "error": "Mensagem do erro",
  "code": "codigo_do_erro"
}
```

Erros comuns:

| HTTP | Código | Descrição |
| --- | --- | --- |
| 400 | `invalid_json` | Payload JSON inválido. |
| 400 | `invalid_uuid` | ID em formato inválido. |
| 400 | `invalid_number` | Número inválido. |
| 400 | `invalid_integer` | Inteiro inválido. |
| 401 | `api_key_required` | API key não enviada. |
| 401 | `api_key_invalid` | API key inválida. |
| 401 | `api_key_revoked` | API key revogada. |
| 401 | `api_key_expired` | API key expirada. |
| 403 | `scope_denied` | Chave sem permissão. |
| 403 | `supplier_inactive` | Fornecedor inativo ou suspenso. |
| 404 | `*_not_found` | Registro não encontrado ou sem acesso. |
| 409 | `quote_closed` | Cotação não aceita mais proposta. |
| 429 | `rate_limit_exceeded` | Rate limit excedido. |
| 500 | `server_not_configured` | Variáveis de servidor incompletas. |

## Fluxo Recomendado

1. Gerar uma API key no dashboard do fornecedor.
2. Consultar `GET /catalogo-materiais`.
3. Mapear o `material_id` oficial no ERP.
4. Enviar `PUT /materiais` com `dry_run=true`.
5. Corrigir rejeições.
6. Enviar `PUT /materiais` com `dry_run=false`.
7. Sincronizar estoque com `PUT /estoques` ou `POST /estoques/movimentacoes`.
8. Criar ofertas, se aplicável.
9. Consultar cotações e enviar propostas.
10. Acompanhar pedidos e atualizar status.

## Catálogo

### Listar materiais oficiais

```http
GET /catalogo-materiais
```

Retorna apenas materiais dos grupos de insumo vinculados ao fornecedor.

Query:

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `q` | string | Não | Busca por nome ou descrição. |
| `grupo_id` | UUID | Não | Filtra por grupo do fornecedor. |
| `page` | integer | Não | Página. |
| `page_size` | integer | Não | Tamanho da página. |

```bash
curl "$BASE_URL/catalogo-materiais?q=cimento&page=1&page_size=100" \
  -H "Authorization: Bearer $FORNECEDOR_API_KEY"
```

Resposta:

```json
{
  "data": [
    {
      "material_id": "00000000-0000-0000-0000-000000000001",
      "nome": "Cimento Portland CP-II",
      "unidade": "saco",
      "descricao": null,
      "grupo_ids": ["00000000-0000-0000-0000-000000000101"],
      "grupo_nomes": ["Cimentos"]
    }
  ],
  "page": 1,
  "page_size": 100,
  "total": 1,
  "total_pages": 1
}
```

## Materiais

### Listar materiais configurados

```http
GET /materiais
```

Query:

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| `ativo` | boolean | Não | `true` ou `false`. |
| `updated_since` | ISO datetime | Não | Atualizados a partir da data. |
| `page` | integer | Não | Página. |
| `page_size` | integer | Não | Tamanho da página. |

```bash
curl "$BASE_URL/materiais?ativo=true&updated_since=2026-05-01T00:00:00.000Z" \
  -H "Authorization: Bearer $FORNECEDOR_API_KEY"
```

### Criar ou atualizar materiais em lote

```http
PUT /materiais
```

Limite: 3000 itens por request.

Campos omitidos preservam o valor atual. Em novos registros, defaults:

```json
{
  "preco": 0,
  "preco_promocional": null,
  "estoque": 0,
  "estoque_minimo": 0,
  "ativo": true
}
```

Payload:

```json
{
  "dry_run": false,
  "items": [
    {
      "material_id": "00000000-0000-0000-0000-000000000001",
      "preco": 123.45,
      "preco_promocional": 110.0,
      "estoque": 100,
      "estoque_minimo": 10,
      "marca": "Marca X",
      "codigo_sku": "ERP-123",
      "descricao": "Descrição interna do fornecedor",
      "fabricante_id": "00000000-0000-0000-0000-000000000201",
      "ativo": true
    }
  ]
}
```

```bash
curl -X PUT "$BASE_URL/materiais" \
  -H "Authorization: Bearer $FORNECEDOR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @materiais.json
```

Resposta:

```json
{
  "success": true,
  "dry_run": false,
  "accepted_count": 1,
  "rejected_count": 0,
  "deduplicated_count": 0,
  "updated_count": 1,
  "skipped_count": 0,
  "results": [
    {
      "index": 0,
      "material_id": "00000000-0000-0000-0000-000000000001",
      "status": "upserted",
      "operation": "insert"
    }
  ],
  "data": []
}
```

Regras:

- `material_id` precisa existir no catálogo.
- O material precisa pertencer a um grupo do fornecedor.
- `fabricante_id`, quando enviado, precisa estar vinculado ao fornecedor.
- Duplicidades no mesmo lote usam o último item enviado.
- `dry_run=true` valida sem gravar.

## Estoque

### Listar estoque

```http
GET /estoques
```

Query:

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `ativo` | boolean | Filtra materiais ativos/inativos. |
| `abaixo_minimo` | boolean | Quando `true`, retorna itens com `estoque <= estoque_minimo`. |
| `page` | integer | Página. |
| `page_size` | integer | Tamanho da página. |

```bash
curl "$BASE_URL/estoques?abaixo_minimo=true" \
  -H "Authorization: Bearer $FORNECEDOR_API_KEY"
```

### Consultar estoque de um material

```http
GET /estoques/{material_id}
```

```bash
curl "$BASE_URL/estoques/00000000-0000-0000-0000-000000000001" \
  -H "Authorization: Bearer $FORNECEDOR_API_KEY"
```

### Atualizar estoque em lote

```http
PUT /estoques
```

Usa a mesma validação de grupos de `PUT /materiais`, mas só atualiza campos de estoque e ativo.

```json
{
  "dry_run": false,
  "items": [
    {
      "material_id": "00000000-0000-0000-0000-000000000001",
      "estoque": 120,
      "estoque_minimo": 20,
      "ativo": true
    }
  ]
}
```

### Listar movimentações

```http
GET /estoques/movimentacoes
```

Query:

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `material_id` | UUID | Filtra por material. |
| `tipo` | string | `entrada`, `saida`, `ajuste`, `reserva`, `baixa_reserva`, `cancelamento_reserva`. |
| `created_since` | ISO datetime | Criadas a partir da data. |

### Criar movimentações

```http
POST /estoques/movimentacoes
```

Tipos:

- `entrada`: soma ao estoque.
- `saida`: subtrai do estoque.
- `ajuste`: define o estoque como a quantidade enviada.
- `reserva`: subtrai do estoque.
- `baixa_reserva`: subtrai do estoque.
- `cancelamento_reserva`: soma ao estoque.

Payload:

```json
{
  "dry_run": false,
  "movements": [
    {
      "material_id": "00000000-0000-0000-0000-000000000001",
      "tipo": "entrada",
      "quantidade": 50,
      "referencia": "NF-12345",
      "observacao": "Entrada por nota fiscal"
    }
  ]
}
```

Resposta:

```json
{
  "dry_run": false,
  "accepted_count": 1,
  "rejected_count": 0,
  "results": [
    {
      "index": 0,
      "status": "accepted",
      "material_id": "00000000-0000-0000-0000-000000000001",
      "estoque_anterior": 70,
      "estoque_novo": 120
    }
  ]
}
```

## Ofertas

Ofertas usam o preço base atual em `fornecedor_materiais`. A API calcula `preco_final` no servidor.

### Listar ofertas

```http
GET /ofertas
```

Query:

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `ativo` | boolean | Filtra ofertas ativas/inativas. |
| `page` | integer | Página. |
| `page_size` | integer | Tamanho da página. |

### Criar oferta

```http
POST /ofertas
```

```json
{
  "material_id": "00000000-0000-0000-0000-000000000001",
  "tipo_oferta": "percentual",
  "valor_oferta": 10,
  "quantidade_minima": 20,
  "estoque": 100,
  "data_inicio": "2026-06-01T00:00:00.000Z",
  "data_fim": "2026-06-30T23:59:59.000Z",
  "ativo": true
}
```

```bash
curl -X POST "$BASE_URL/ofertas" \
  -H "Authorization: Bearer $FORNECEDOR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @oferta.json
```

Validações:

- O material precisa estar cadastrado para o fornecedor.
- O vínculo do material precisa estar ativo.
- `tipo_oferta` deve ser `valor` ou `percentual`.
- O desconto não pode deixar o preço final menor ou igual a zero.
- `data_fim`, quando enviada, precisa ser maior que `data_inicio`.

### Consultar, atualizar, pausar ou remover oferta

```http
GET /ofertas/{oferta_id}
PATCH /ofertas/{oferta_id}
PATCH /ofertas/{oferta_id}/status
DELETE /ofertas/{oferta_id}
```

Atualização parcial:

```json
{
  "valor_oferta": 12,
  "data_fim": "2026-07-15T23:59:59.000Z"
}
```

Pausar ou reativar:

```json
{
  "ativo": false
}
```

## Cotações e Propostas

Cotações retornadas são aquelas convidadas para o fornecedor via `cotacao_convites` ou já respondidas por ele.

### Listar cotações

```http
GET /cotacoes
```

Query:

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `status` | string | Filtra por status da cotação. |
| `updated_since` | ISO datetime | Atualizadas a partir da data. |
| `page` | integer | Página. |
| `page_size` | integer | Tamanho da página. |

```bash
curl "$BASE_URL/cotacoes?status=enviada" \
  -H "Authorization: Bearer $FORNECEDOR_API_KEY"
```

### Consultar cotação

```http
GET /cotacoes/{cotacao_id}
```

Retorna dados da cotação, itens, obra e a proposta do fornecedor, se já existir.

### Enviar proposta

```http
POST /cotacoes/{cotacao_id}/propostas
```

Se já houver proposta do fornecedor para a cotação, a API atualiza a proposta existente e substitui os itens.

```json
{
  "valor_frete": 120.5,
  "valor_impostos": 35,
  "prazo_entrega": 7,
  "condicoes_pagamento": "28 dias",
  "observacoes": "Valores válidos para entrega em horário comercial.",
  "data_validade": "2026-06-30T23:59:59.000Z",
  "itens": [
    {
      "cotacao_item_id": "00000000-0000-0000-0000-000000000301",
      "preco_unitario": 123.45,
      "quantidade": 10,
      "disponibilidade": "disponivel",
      "prazo_dias": 7,
      "observacao": "Produto em estoque"
    }
  ]
}
```

O servidor calcula `subtotal` de cada item e `valor_total = subtotal + valor_frete + valor_impostos`.

### Atualizar proposta por ID

```http
PUT /cotacoes/{cotacao_id}/propostas/{proposta_id}
```

Usa o mesmo payload de criação. O `proposta_id` precisa pertencer ao fornecedor autenticado e à cotação informada.

## Pedidos

### Listar pedidos

```http
GET /pedidos
```

Query:

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `status` | string | Filtra por status do pedido. |
| `updated_since` | ISO datetime | Atualizados a partir da data. |
| `page` | integer | Página. |
| `page_size` | integer | Tamanho da página. |

Status possíveis:

- `pendente`
- `confirmado`
- `em_preparacao`
- `enviado`
- `entregue`
- `cancelado`

### Consultar pedido

```http
GET /pedidos/{pedido_id}
```

Retorna pedido, itens, cotação e obra.

### Atualizar status

```http
PATCH /pedidos/{pedido_id}/status
```

Payload:

```json
{
  "status": "enviado",
  "tracking_code": "BR123456789",
  "tracking_url": "https://transportadora.example/rastreio/BR123456789",
  "data_previsao_entrega": "2026-06-10",
  "observacoes": "Pedido coletado pela transportadora."
}
```

Campos de rastreamento são salvos no resumo do endereço de entrega.

## Webhooks

Esta v1 permite cadastrar endpoints e gerar secret. A entrega automática de eventos depende do worker de webhooks da plataforma.

Eventos disponíveis:

| Evento | Descrição |
| --- | --- |
| `quote.created` | Nova cotação disponível. |
| `quote.updated` | Cotação atualizada. |
| `proposal.accepted` | Proposta aceita. |
| `proposal.rejected` | Proposta recusada. |
| `order.created` | Pedido criado. |
| `order.status_changed` | Status de pedido alterado. |
| `stock.low` | Estoque abaixo do mínimo. |
| `stock.updated` | Estoque atualizado. |

### Listar webhooks

```http
GET /webhooks
```

### Criar webhook

```http
POST /webhooks
```

```json
{
  "url": "https://erp.example.com/webhooks/cotar-e-construir",
  "description": "ERP produção",
  "events": ["order.created", "order.status_changed"],
  "ativo": true
}
```

Resposta:

```json
{
  "data": {
    "id": "00000000-0000-0000-0000-000000000401",
    "url": "https://erp.example.com/webhooks/cotar-e-construir",
    "events": ["order.created", "order.status_changed"],
    "secret_prefix": "ccwhsec_xxxxx",
    "ativo": true
  },
  "secret": "ccwhsec_xxxxx_yyyyyyyyyyyyyyyyyyyyyyyy"
}
```

O `secret` aparece apenas na criação ou rotação. Armazene em cofre seguro.

### Atualizar, rotacionar secret ou desativar

```http
GET /webhooks/{webhook_id}
PATCH /webhooks/{webhook_id}
DELETE /webhooks/{webhook_id}
```

Atualizar eventos:

```json
{
  "events": ["quote.created", "order.created"],
  "ativo": true
}
```

Rotacionar secret:

```json
{
  "rotate_secret": true
}
```

`DELETE` desativa o webhook (`ativo=false`), mantendo histórico.

### Payload de teste

```http
POST /webhooks/{webhook_id}/test
```

Retorna um payload de exemplo e o formato esperado do header de assinatura. Esta rota não envia requisição para a URL externa.

## Auditoria

A API registra eventos relevantes em `audit_logs`:

- criação e revogação de API key;
- importação de materiais via API;
- criação, atualização, pausa e remoção de oferta;
- atualização de estoque;
- envio de proposta;
- atualização de pedido;
- criação, alteração, desativação e rotação de webhook.

## Limites Operacionais

| Operação | Limite |
| --- | --- |
| Upsert de materiais | 3000 itens por request |
| Upsert de estoque | 3000 itens por request |
| Movimentações de estoque | 3000 movimentações por request |
| Rate limit | 120 requests por minuto por API key |
| Listagem | Até 500 por página, conforme endpoint |

## Changelog

### v1

- API key por fornecedor.
- Catálogo restrito por grupos de insumo.
- Cadastro e atualização em lote de materiais.
- Atualização e movimentação de estoque.
- CRUD de ofertas promocionais.
- Consulta de cotações e envio/atualização de propostas.
- Consulta e atualização de pedidos.
- Cadastro e teste de webhooks.
- Auditoria de operações sensíveis.

# Cotação respondida por planilha no WhatsApp

O fornecedor recebe a cotação no WhatsApp **com a planilha anexada**, digita o
preço de cada item, devolve o arquivo na mesma conversa e a plataforma publica
a proposta para o cliente. Ele não precisa acessar a plataforma em nenhum
momento.

## Fluxo

```
cliente envia cotação
        │
        ▼
app/api/cotacoes/route.ts
   planilhasDeRespostaPorCotacao()       → gera 1 .xlsx por cotação
   notifySupplierNewQuotation(..., planilha)
        │  uploadWhatsAppMedia() → media_id
        │  template nova_cotacao_fornecedor_v3 (header DOCUMENT)
        ▼
   📱 fornecedor preenche preco_unitario e devolve o arquivo
        │
        ▼
app/api/webhooks/whatsapp/route.ts
   processarRespostaDeCotacao()
        ├─ pareceAnexoDeCotacao()        → descarta foto, áudio, PDF
        ├─ resolverFornecedor(telefone)  → quem é, pelo número
        ├─ downloadWhatsAppMedia()
        ├─ lerRespostaPlanilha()
        ├─ resolverCotacao()             → qual cotação é
        ├─ montarItensProposta()
        ├─ criarOuAtualizarProposta()    → publica e avisa o cliente
        └─ responde a confirmação no WhatsApp
```

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `lib/cotacaoPlanilha.ts` | Domínio puro: gera, lê e interpreta a planilha. Sem banco, sem rede. |
| `lib/cotacaoRespostaWhatsapp.ts` | Orquestração: identifica fornecedor e cotação, baixa o arquivo, publica, responde. |
| `lib/propostaService.ts` | Criação/atualização de proposta, compartilhada com `POST /api/propostas`. |
| `lib/whatsappService.ts` | `uploadWhatsAppMedia`, `downloadWhatsAppMedia`, template v3. |
| `scripts/create-whatsapp-templates.mjs` | Submete `nova_cotacao_fornecedor_v3` à Meta. |

## Formato da planilha

Mesmas colunas que o painel do fornecedor já exporta e importa — quem conhece
um conhece o outro.

```
cotacao_item_id | material | fabricante | unidade | quantidade | preco_unitario
disponibilidade | forma_pagamento | validade | prazo_entrega_dias
valor_frete | valor_impostos | valor_desconto | observacoes
```

Tudo já vai preenchido menos `preco_unitario`; `disponibilidade` sai como
`disponivel`. Item deixado sem preço entra na proposta como **indisponível**,
não some dela — item ausente no mapa comparativo é lido pelo cliente como
erro de envio.

As colunas de condição (pagamento, frete, impostos, desconto, validade,
observações) valem para a proposta inteira e são lidas da primeira linha que
tiver algo preenchido.

### Como o arquivo volta sabendo de qual cotação é

Em ordem de confiança, e toda pista é conferida no banco antes de valer:

1. **Aba oculta `_ref`** com o UUID da cotação — sobrevive ao fornecedor salvar
   por cima no Excel.
2. **Coluna `cotacao_item_id`** — é o que resta quando convertem para CSV.
3. **Nome do arquivo** (`cotacao-10070.xlsx`).
4. **Única cotação aberta** daquele fornecedor. Com duas ou mais, pedimos o
   arquivo original de volta em vez de chutar.

## Segurança

- **Quem autentica é o número de telefone.** O vínculo número → fornecedor sai
  de `whatsapp_conversas.fornecedor_id` (RPC `whatsapp_vincular_contato`, que
  casa pelos 8 últimos dígitos). Número não vinculado: nada acontece
  automaticamente, a mensagem só aparece na Central de WhatsApp.
- **Convite é obrigatório.** Sem linha em `cotacao_convites` para aquele par
  cotação/fornecedor, o arquivo é recusado com explicação.
- **Nada vindo do arquivo é usado sem conferência.** UUIDs passam por regex e
  depois por consulta ao banco.
- **Processa uma vez só.** A Meta reenvia o webhook quando não recebe 200 a
  tempo; `registrarRecebimento` devolve `true` apenas quando gravou a linha
  agora, e só nesse caso a planilha é processada — senão o cliente seria
  notificado duas vezes.

## Configuração

### Variável de ambiente nova

```
WHATSAPP_APP_ID=<ID do app na Meta>   # Configurações do app → Básico
```

Usada **só pelo script de templates**: a Meta exige um arquivo de exemplo para
aprovar cabeçalho de documento, e o exemplo sobe pela Resumable Upload API, que
é do app, não da WABA.

Esqueceu o ID? O próprio token diz qual é:

```bash
curl -s "https://graph.facebook.com/v21.0/debug_token?input_token=$WHATSAPP_TOKEN&access_token=$WHATSAPP_TOKEN"
```

### Submeter o template

```bash
node scripts/create-whatsapp-templates.mjs --list                        # status do que existe
node scripts/create-whatsapp-templates.mjs --amostra /tmp/exemplo.pdf    # confere a amostra
node scripts/create-whatsapp-templates.mjs --only nova_cotacao_fornecedor_v3
node scripts/create-whatsapp-templates.mjs                               # todos os que faltam
```

Submissão é irreversível na conta, por isso o `--only`: sem ele o script manda
de uma vez todos os templates do arquivo que ainda não existem na WABA.

O template fica `PENDING` até a Meta aprovar. **Enquanto isso o envio continua
normal**: `notifySupplierNewQuotation` cai para o `_v2` (botão sem anexo) e,
se preciso, para o `_v1`. Nenhuma cotação deixa de sair por causa disso.

### A amostra do cabeçalho é PDF, o anexo real é XLSX

A Resumable Upload API aceita o `.xlsx`, mas a criação do template devolve
`Tipo de arquivo não aceito` (code 100, subcode 2388084): a **amostra** de
cabeçalho DOCUMENT só pode ser PDF. Por isso `samplePdf()` monta um PDF de uma
página à mão — é só o que o revisor da Meta abre.

Em produção o anexo continua sendo o `.xlsx` de `gerarPlanilhaResposta()`. O
cabeçalho aprovado é do tipo DOCUMENT, genérico; o tipo do arquivo enviado em
runtime não precisa coincidir com o da amostra. Se algum dia a Meta recusar o
`.xlsx` no envio, o fallback para o `_v2` cobre e o sintoma aparece no log
como `template v3 (com planilha) falhou`.

## Templates da conta

Todos em `pt_BR`. O corpo de cada um está duplicado em
`lib/whatsappCentral.ts` (`CORPO_TEMPLATES`) para a Central mostrar na
conversa o que o contato recebeu — **template novo na Meta precisa ser
acrescentado lá também**, senão a mensagem aparece como `[template nome]`.

| Template | Categoria | Para quê |
| --- | --- | --- |
| `nova_cotacao_fornecedor_v5` | UTILITY | Cotação com **link de resposta** no botão + planilha anexada. É o preferido. |
| `nova_cotacao_fornecedor_v4` | UTILITY | Aposentado: mesmo conteúdo, link sem `www` (redireciona). Fica só para a Central renderizar mensagem antiga. |
| `nova_cotacao_fornecedor_v3` | UTILITY | Fallback: planilha anexada, botão leva ao login. |
| `nova_cotacao_fornecedor_v2` | UTILITY | Fallback: botão de deep-link, sem anexo. |
| `nova_cotacao_fornecedor` | UTILITY | Fallback final: botão fixo. |
| `nova_mensagem_chat_fornecedor` | UTILITY | Cliente abriu conversa no chat (só na 1ª mensagem da sala). |
| `pedido_aprovado_fornecedor_v2` / `_v1` | UTILITY | Pedido aprovado. |
| `nova_proposta_cliente_v3` | UTILITY | Nova resposta na cotação do cliente. |
| `nova_proposta_cliente_v2` / `_v1` | MARKETING | Fallbacks — ver abaixo. |

### Categoria quem decide é a Meta, e aprovada não muda mais

`nova_proposta_cliente` e `nova_proposta_cliente_v2` foram **submetidos como
UTILITY e aprovados como MARKETING**: o classificador sobrepõe o que o script
pede. Em notificação transacional isso é problema real — custa mais e não
entrega para quem optou por não receber promoção.

Corrigir depois não dá: a API recusa mudança de categoria em template já
aprovado (code 100, subcode 3835031). **Texto aprovado pode ser editado;
categoria não.**

O que separa UTILITY de MARKETING nesta conta é o enquadramento:

| Corpo | Veredito |
| --- | --- |
| "Você recebeu uma nova **cotação**… envie sua proposta" | UTILITY |
| "Seu **pedido** foi aprovado" | UTILITY |
| "Você recebeu uma nova **proposta**… *Fornecedor:* X" | MARKETING |
| "**Sua cotação** #X recebeu uma nova resposta" | UTILITY ✓ |

A regra se confirmou na prática: mensagem lida como atualização de algo que o
destinatário **pediu** passa como UTILITY; mensagem lida como alguém
**oferecendo** algo a ele cai em MARKETING. O v3, só reescrito nesse sentido e
sem mudar nada da mecânica, foi aprovado como UTILITY.

`notifyClientNewProposal` tenta v3 → v2 → v1. Como `loginRef` nunca vem vazio
(o papel do destinatário sempre entra no token), o v3 é sempre o primeiro.
Depois que ele estiver `APPROVED` dá para apagar o v2 e o v1 — **não antes**,
ou a notificação fica sem rede de proteção.

## O caminho curto: responder pelo link

A planilha resolve para quem usa Excel, mas no celular derruba a taxa de
resposta — baixar o arquivo, achar um app que abra, preencher e devolver é
muita etapa. Por isso o botão do `nova_cotacao_fornecedor_v5` abre
`/proposta/<token>`: um formulário onde o fornecedor digita os preços na tela,
sem login e sem arquivo. A planilha segue anexada para quem prefere.

```
disparo da cotação
   gerarTokensDeResposta()      → 1 token por convite, hash no banco
   template v5, botão → /proposta/<token>
        │
        ▼
   📱 fornecedor toca, preenche e envia
        │
        ▼
app/api/proposta-link/route.ts
   convite_por_token()          → token → (cotação, fornecedor)
   criarOuAtualizarProposta()   → origem 'link_publico'
```

### A URL do botão fica congelada no template

A base do link é parte do template aprovado — mudar exige submeter outro e
esperar a Meta de novo. Foi o que aconteceu entre o v4 e o v5: o v4 saiu com
`comprareconstruir.com`, que responde 307 para o `www`, e dentro do navegador
do WhatsApp cada redirecionamento é mais uma chance de o fornecedor ver erro.

Lição para o próximo template com link: conferir o domínio canônico **antes**
de submeter. E `NEXT_PUBLIC_APP_URL` (que gera os links do admin) precisa
apontar para a mesma base do template, senão os dois caminhos divergem.

### Por que o token é seguro o bastante para valer como senha

- 32 bytes de entropia; o banco guarda **só o SHA-256**. Ler a tabela não
  permite responder no lugar de ninguém.
- Vale para **um** par (cotação, fornecedor) e expira em 30 dias.
- O servidor nunca aceita `cotacao_id`/`fornecedor_id` do corpo da requisição:
  saem do token. Aceitá-los deixaria um fornecedor com token legítimo
  responder pelo concorrente.
- O link não mostra nome, e-mail ou telefone do cliente, endereço exato da
  obra, nem proposta de terceiros — só bairro/cidade, como a notificação.

Abrir o link marca `visualizado_em` no convite, então o Acompanhamento conta
quem abriu junto com quem entrou pela plataforma.

### Proposta lançada pelo administrador

Fornecedor manda preço por telefone, áudio e foto de papel. No Acompanhamento,
clicar no nome dele abre um modal que faz as duas coisas: lançar a proposta
(mesmo formulário, `origem = 'admin'` + `lancada_por_admin`) ou gerar e enviar
o link. A marca de origem importa — sem ela, "o fornecedor cotou errado" e
"alguém digitou errado aqui dentro" ficam indistinguíveis.

O envio automático do link só entrega dentro da janela de 24h da Meta; fora
dela o modal diz que falhou e o admin copia o link.

## Conferir a planilha sem disparar cotação

```bash
npx tsx scripts/gerar-planilha-cotacao.ts --listar     # cotações recentes e nº de itens
npx tsx scripts/gerar-planilha-cotacao.ts 10077 /tmp   # gera o .xlsx de uma delas
```

É exatamente o arquivo que o fornecedor recebe.

## Pontos de atenção

- **Latência do webhook.** O processamento (download + leitura + gravação)
  acontece dentro do POST do webhook. O caso típico é de poucos segundos, bem
  abaixo do limite da Meta, mas uma planilha muito grande ou o Supabase lento
  podem encostar nele. Se começar a aparecer reenvio no log, o caminho é jogar
  o processamento na fila (`lib/queue.ts`) e responder 200 na hora.
- **Publicação é direta.** A proposta vai para o cliente assim que o arquivo é
  lido, sem etapa de confirmação. Reenviar a planilha substitui a proposta
  anterior — é assim que o fornecedor corrige um preço errado.
- **Mídia na Meta vale ~30 dias.** O `media_id` do anexo expira; cotação
  reenviada gera planilha e upload novos.

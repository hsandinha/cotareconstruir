# Como Adicionar o Fornecedor Teste Manualmente

## Opção 1: Via Firebase Console (RECOMENDADO)

1. Acesse: https://console.firebase.google.com/project/cotareconstruir-d276d/firestore

2. Navegue até a coleção `fornecedores`

3. Clique em "Adicionar documento"

4. Use "ID automático" ou defina um ID personalizado

5. Adicione os seguintes campos:

```
razaoSocial (string): HEBERT SANDINHA CONSULTOR LTDA
cnpj (string): 59.866.904/0001-47
inscricaoEstadual (string): (deixe vazio)
endereco (string): LAURA SOARES CARNEIRO, 177 APT 301 - BURITIS, BELO HORIZONTE
cep (string): 30575-220
telefoneComercial (string): (31)9 8400-5308
nomeResponsavel (string): HEBERT SANDINHA
cargoResponsavel (string): (deixe vazio)
emailResponsavel (string): hebertsandinhacorretor@gmail.com
whatsapp (string): (deixe vazio)
grupoInsumoIds (array): [] (array vazio por enquanto)
ativo (boolean): true
dataCadastro (timestamp): (use a data atual)
```

6. Copie o ID do documento criado (ex: `ABC123...`)

7. Vá para a coleção `users`

8. Encontre o documento com `email: hebertsandinhacorretor@gmail.com`

9. Edite o documento e adicione o campo:
```
fornecedorId (string): [ID_COPIADO_DO_PASSO_6]
```

## Opção 2: Via código (depois de logar como admin)

Se você quiser, posso criar uma página admin para cadastrar fornecedores diretamente pela interface, o que seria mais prático para cadastros futuros.

## Vincular aos Grupos de Insumo

Depois de criar o fornecedor, você precisará associá-lo aos grupos relevantes:

1. No Firebase Console, edite o documento do fornecedor criado
2. Localize o campo `grupoInsumoIds` (array)
3. Adicione os IDs dos grupos de insumo relevantes

### IDs dos Grupos Disponíveis:
Execute no terminal para ver todos os grupos:
```bash
firebase firestore:get /grupos_insumo --project cotareconstruir-d276d
```

Ou consulte via script para listar os grupos com seus nomes e IDs.

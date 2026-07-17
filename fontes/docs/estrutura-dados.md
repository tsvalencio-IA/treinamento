# Estrutura de dados do sistema

## Cliente

```json
{
  "nome": "CAPITAL JOALHERIA LTDA",
  "documento": "17.855.301/0001-08",
  "telefone": "(11)11111",
  "email": "",
  "responsavel": "",
  "endereco": "RUA MARGARIDA",
  "cidade": "SÃO PAULO",
  "uf": "SP",
  "tipo": "Joalheria",
  "ativo": true
}
```

## Vendedor

```json
{
  "nome": "Nome do vendedor",
  "email": "vendedor@empresa.com.br",
  "cargo": "Vendedor",
  "percentualComissao": 3,
  "ativo": true
}
```

## Produto / Joia

```json
{
  "codigo": "ALM0027F",
  "descricao": "ALIANCA FEM/18K/1Ø MOISSANITE 1,25MM",
  "tipo": "Aliança",
  "material": "Ouro 18K",
  "medida": "18",
  "pesoMedio": 2.16,
  "estoqueDisponivel": 10,
  "estoqueConsignado": 2,
  "estoqueVendido": 8,
  "estoqueMinimo": 3,
  "fotoUrl": "",
  "ultimaMovimentacaoEm": "2026-06-15T10:00:00.000Z"
}
```

## Pedido importado

```json
{
  "numeroPedido": "25853",
  "dataPedido": "2025-11-12",
  "situacao": "PENDENTE",
  "tipoPedido": "POR PESO",
  "tipoImportacao": "consignacao",
  "clienteId": "cliente_key",
  "clienteNome": "CAPITAL JOALHERIA LTDA",
  "vendedor": "Nome do vendedor",
  "observacao": "ALIANÇAS CONSIGNADAS",
  "subtotal": 30.427,
  "frete": 3.89,
  "total": 34.322
}
```

## Movimento de estoque

```json
{
  "tipo": "entrada_producao | venda_final | saida_consignacao | devolucao_consignacao | conversao_consignacao",
  "produtoId": "ALM0027F-18-OURO_18K",
  "quantidade": 1,
  "peso": 2.16,
  "pedidoId": "registro_key",
  "origem": "pdf | manual | producao",
  "criadoEm": "2026-06-15T10:00:00.000Z"
}
```

## Comissão

```json
{
  "vendaId": "venda_key",
  "vendedor": "Nome do vendedor",
  "baseCalculo": 2494,
  "percentual": 3,
  "valor": 74.82,
  "status": "pendente"
}
```


## Peça física de estoque — V24

Cada unidade real em estoque fica em `pecasEstoque`.

```json
{
  "pecaCodigo": "PEC-MANUAL-001",
  "produtoId": "2740AGL_8_OURO_18K",
  "codigo": "2740AGL",
  "descricao": "AN.SOLITARIO/ 18K /1 ZIRC 3MM.",
  "material": "Ouro 18K",
  "medida": "08",
  "loteId": "firebase_key_lote",
  "lote": "LOTE-2026-0001",
  "status": "disponivel",
  "pesoReal": 1.48,
  "pesoPedido": 1.50,
  "diferencaPeso": -0.02,
  "pedidoProducaoId": "firebase_key_pedido",
  "producaoId": "firebase_key_producao",
  "origem": "entrada_producao_pdf",
  "criadoEm": "2026-06-18T10:00:00.000Z"
}
```

Status possíveis:
- `disponivel`;
- `consignado`;
- `vendido`;
- `substituida_por_inventario`;
- `cancelada`.


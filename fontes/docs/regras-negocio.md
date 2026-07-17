# Regras de negócio

## Cliente

Todo pedido importado pode criar ou atualizar um cliente pela razão social e documento. Vendas e consignações devem manter o nome do cliente para relatório rápido.

## Vendedor

Cada venda ou consignação pode ter um vendedor responsável. A comissão usa o percentual próprio do vendedor ou a regra padrão.

## Consignação pendente

Ao importar como consignação:

- O pedido fica com `tipoImportacao = consignacao`.
- O item sai do estoque disponível.
- O item entra em estoque consignado.
- A venda ainda não é considerada finalizada.
- A comissão só nasce quando a consignação vira venda.

## Venda final

Ao importar como venda final:

- O pedido fica com `tipoImportacao = venda_final`.
- O item sai do estoque disponível.
- O item entra em vendido.
- A venda é registrada.
- A comissão é calculada conforme percentual configurado.

## Entrada de produção

Quando a fábrica terminar uma produção:

- O gestor lança produto, quantidade, peso, material, medida, lote e responsável.
- O estoque disponível aumenta.
- O movimento fica registrado como `entrada_producao`.

## Estoque crítico

Um produto fica crítico quando:

```txt
estoqueDisponivel <= estoqueMinimo
```

## Estoque parado

Um produto fica parado quando:

```txt
dias desde a última movimentação >= diasEstoqueParado
```

O padrão inicial do sistema é 90 dias, alterável em regras da operação.

## Calculadora técnica

A calculadora usa parâmetros informados pela fábrica:

- tipo de joia;
- material;
- medida;
- quantidade;
- peso unitário estimado;
- perda de produção;
- custo por grama;
- mão de obra;
- margem.

Ela calcula peso líquido, peso com perda, custo material, custo total, custo unitário e preço sugerido. Fórmulas específicas da fábrica podem substituir essa regra operacional quando forem validadas.


## Estoque real por peça física — V24

Produto/SKU não representa estoque real. Produto é o cadastro técnico por código, medida e material.

O estoque real é calculado por `pecasEstoque`:

```txt
Disponível = peças com status disponivel
Consignado = peças com status consignado
Vendido = peças com status vendido
```

Quando um PDF de inventário é confirmado, o sistema:
- não cria pedido comercial;
- não cria venda;
- não cria consignação;
- substitui as peças disponíveis anteriores daquele SKU;
- cria uma nova peça física para cada unidade real informada no PDF.

Quando uma produção pronta é confirmada, o sistema:
- cria lote;
- cria uma peça física para cada unidade produzida;
- grava peso real por peça;
- compara peso pedido x peso real quando houver pedido de produção relacionado.

Na venda e na consignação, a baixa correta deve ocorrer em peças físicas específicas, não apenas no saldo agregado do produto.

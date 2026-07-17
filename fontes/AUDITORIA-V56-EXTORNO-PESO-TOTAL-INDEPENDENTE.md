# Auditoria V56 — Estorno e controle independente de quantidade/peso

## Base utilizada

A V56 foi construída diretamente sobre o ZIP atual enviado pelo usuário (`GlamoreJoias-main (2)(1).zip`), preservando a estrutura e os fluxos existentes da V55.

## Regra de negócio corrigida

Quantidade de peças e peso total são grandezas relacionadas, mas independentes.

- Entrada de 10 peças com peso total de 10,000 g **não** registra automaticamente dez peças reais de 1,000 g.
- As peças podem ter pesos diferentes, por exemplo 0,900 g e 1,100 g.
- Enquanto os pesos individuais não forem conhecidos, o sistema mantém:
  - quantidade física exata;
  - peso total exato do lote/SKU;
  - média apenas como referência, nunca como peso individual verdadeiro.

### Exemplo obrigatório validado

1. Entrada: 10 peças e 10,000 g.
2. Venda: 6 peças e peso total real de 7,500 g.
3. Saldo: 4 peças e 2,500 g.

A venda manual passou a solicitar **peso total real vendido**. O valor informado não é multiplicado pela quantidade.

## Estornos incluídos

### Estorno de venda

- Disponível para administrador na tela de Vendas.
- Devolve as peças baixadas ao estado anterior/disponível.
- Devolve exatamente o peso total debitado da venda ao saldo do SKU.
- Encerra alertas vinculados.
- Marca venda e movimentos como estornados.
- Mantém histórico e auditoria; não apaga silenciosamente.

### Estorno de PDF

- Disponível para administrador em Importar PDF, na lista de PDFs lançados.
- Venda por PDF: estorna as vendas vinculadas, quantidade, peso e alertas.
- Inventário/entrada por PDF: remove quantidade e peso daquela entrada.
- Proteção: inventário não pode ser estornado enquanto houver peças dele vendidas, reservadas ou consignadas; é necessário estornar primeiro a operação posterior.
- O documento permanece no histórico com status `estornado`.

## Rastreabilidade do peso

- Peças oriundas de lote/PDF sem pesagem individual exibem `Não individualizado`.
- A média do lote aparece apenas como `Média de referência`.
- Quando uma venda com várias peças informa apenas o peso total, o eventual valor por peça é identificado como `Rateio contábil`, e não como peso individual medido.

## Preservado sem remoção

- importação de inventário por PDF;
- importação de venda por PDF;
- venda manual e entrada manual;
- bloqueio de duplicidade;
- baixa por código, descrição, material e medida;
- alertas agrupados por pedido;
- produção manual;
- estoque crítico, ideal e sugestão;
- relatórios e backup/restauração JSON da V55;
- Firebase, Cloudinary, AR, login, perfis e responsividade;
- histórico e auditoria.

## Arquivos alterados

- `js/app.js`
- `package.json`
- `tests/v56-weight-reversal.test.mjs`
- `AUDITORIA-V56-EXTORNO-PESO-TOTAL-INDEPENDENTE.md`

## Validações executadas

- sintaxe de `js/app.js`;
- sintaxe de `js/pdf-importer.js`;
- sintaxe de `js/utils.js`;
- smoke test do projeto;
- regras ERP existentes;
- teste V56 de quantidade/peso independente e estorno exato.

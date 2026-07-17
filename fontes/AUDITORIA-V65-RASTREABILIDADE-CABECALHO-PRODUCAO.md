# V65 — Rastreabilidade consolidada da produção pronta

## Motivo
O teste real da V64 comprovou que a regra operacional funcionou: 20 peças produzidas, 10 destinadas à venda pendente e 10 mantidas no estoque. Porém, o cabeçalho do PDF em `producoes` não guardava os totais `quantidadeBaixadaVendas` e `quantidadeExcedenteEstoque`; eles existiam no registro técnico por item, no alerta, nas peças e no lote.

## Alteração
Sem alterar baixa, estoque, peso, alertas, lotes, estorno ou produção:

- mantém o registro técnico individual de cada item;
- acumula os resultados de todos os itens do PDF;
- grava no cabeçalho da produção pronta:
  - `quantidadeRecebidaTotal`;
  - `quantidadeBaixadaVendas`;
  - `quantidadeExcedenteEstoque`;
  - `pesoBaixadoVendas`;
  - `quantidadeSemAprovacao`;
  - `alertasAtendidos`;
  - `atendimentoVendaResumo`.

## Resultado esperado
Venda pendente 10 + produção pronta 20:

- venda finalizada com 10 peças;
- 10 peças disponíveis no estoque;
- cabeçalho da produção registra recebido 20, baixado em vendas 10 e excedente 10.

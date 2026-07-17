# Ateliê Digital de Joias — V63

Build: `v63-correcao-estorno-parcial-inventario-zero-20260714`

## Finalidade desta versão

A V63 preserva todo o fluxo validado na V62 e corrige os dois defeitos restantes identificados pelo teste real pós-publicação:

- venda parcial: o estorno devolve exatamente o peso realmente baixado, sem rateio duplicado;
- inventário integral: quando todas as peças do documento são estornadas, o SKU é persistido com quantidade e razão de peso zeradas.

## Publicação

Suba o conteúdo completo deste repositório. Depois da publicação, confirme no Console:

```javascript
window.__JOIAS_BUILD_VERSION__
```

Retorno obrigatório:

```text
v63-correcao-estorno-parcial-inventario-zero-20260714
```

Em seguida execute `scripts/TESTE-GLAMORE-V63-POS-DEPLOY-COM-LIMPEZA.txt`.

Detalhes técnicos: `AUDITORIA-V63-ESTORNO-PARCIAL-INVENTARIO-ZERO.md`.

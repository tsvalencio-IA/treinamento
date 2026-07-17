# Módulo AR separado — Joias

Build: `ar-standalone-v1-public-link-3d-camera-base-20260619`

Este pacote cria um módulo separado para o mesmo repositório, sem mexer no `index.html` principal.

## Arquivos novos

Suba estes arquivos na raiz do mesmo repositório:

```txt
ar.html
ar-publico.html
css/ar.css
js/ar.js
README-AR.md
firebase-rules-snippet-ar.json
```

O módulo usa o mesmo arquivo já existente:

```txt
js/config.js
```

Ou seja, usa o mesmo Firebase, mesma empresa e mesmas chaves públicas já configuradas no Ateliê Digital.

## Como usar

1. Suba os arquivos no GitHub.
2. Acesse:

```txt
https://SEU-DOMINIO/ar.html
```

3. Entre com o mesmo login do sistema.
4. Pesquise uma joia por código, descrição, tipo, material ou medida.
5. Configure título, descrição, foto, modelo 3D e AR.
6. Clique em `Gerar link público`.
7. Envie o link gerado ao cliente.

O cliente abre:

```txt
https://SEU-DOMINIO/ar-publico.html?id=ID_DO_LINK
```

## Privacidade

O link público mostra apenas:

```txt
foto
título
descrição pública
código
tipo
material
medida
arquivo 3D GLB/GLTF
arquivo USDZ para iPhone
provador base com câmera
```

O link público NÃO mostra:

```txt
estoque
quantidade disponível
peças físicas
lotes internos
peso real interno
clientes
vendas
custos
comissões
usuários
auditoria
```

## AR / 3D

Campos suportados:

```txt
modelGlbUrl   -> arquivo .glb ou .gltf para web/Android
modelUsdzUrl  -> arquivo .usdz para iPhone
tipoAR        -> anel, colar, brinco, pulseira, pingente ou livre
cameraPreferida -> frontal, traseira ou automática
escala
posição X/Y
rotação
```

O `ar-publico.html` usa:

```txt
<model-viewer>
```

para visualização 3D e AR nativo quando o aparelho suporta.

O provador com câmera da V1 é uma base progressiva: abre câmera, sobrepõe a joia e permite ajuste manual de escala, posição e rotação. A fixação automática perfeita no dedo/pescoço exige uma próxima versão com rastreamento de mão/rosto.

## Regras Firebase

Se suas regras já têm `catalogosPublicos` com leitura pública e escrita autenticada, não precisa mudar.

Se não tiver, use o arquivo:

```txt
firebase-rules-snippet-ar.json
```

e adicione o nó `catalogosPublicos` dentro de:

```txt
rules.empresas.$empresaId
```

Não cole o snippet sozinho como rules completas.

## Observação importante

Este módulo é separado. Ele não altera o fluxo aprovado de:

```txt
estoque por peça física
inventário 23/485
relatórios
PDF
colaboradores
comissões restritas
catálogo público existente
```

thIAguinho Soluções — tecnologia sob medida.

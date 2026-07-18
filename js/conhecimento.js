export const MANUAL_TOUR = [
  {
    "id": "intro",
    "chapter": "Começo",
    "title": "Visão geral do Ateliê Digital",
    "route": "dashboard",
    "target": {
      "text": "O que tem, o que vendeu e o que precisa de decisão."
    },
    "duration": 10,
    "body": "O Ateliê Digital reúne em um só lugar o Painel, a importação de PDFs, o estoque, as vendas, os alertas, a produção, os clientes, os relatórios, a auditoria e as regras de acesso. Comece pelo Painel para entender a situação da operação e use o menu para abrir cada rotina."
  },
  {
    "id": "login",
    "chapter": "Começo",
    "title": "Login e permissão real",
    "route": "dashboard",
    "target": {
      "text": "Acesso do sistema"
    },
    "duration": 8,
    "body": "No sistema oficial, quando não existe sessão autenticada, a tela real de login aparece. Depois do acesso, o Firebase carrega o perfil, verifica se o usuário está ativo e aplica as permissões pelo cargo. No treinamento, essa etapa é demonstrada com um login simulado e seguro. Administrador Master e Gerente têm os recursos administrativos; vendedor, atendente e entregador veem somente o que suas regras permitem."
  },
  {
    "id": "navigation",
    "chapter": "Começo",
    "title": "Navegação principal",
    "route": "dashboard",
    "target": {
      "selector": "nav.nav"
    },
    "duration": 8,
    "body": "O menu é gerado a partir das rotas liberadas para o cargo atual. No celular, o mesmo conjunto aparece no seletor “Tela do sistema”. O treinamento nunca simula um menu diferente do projeto."
  },
  {
    "id": "dashboard-summary",
    "chapter": "Painel",
    "title": "Resumo executivo",
    "route": "dashboard",
    "target": {
      "text": "O que tem, o que vendeu e o que precisa de decisão."
    },
    "duration": 8,
    "body": "O Painel concentra o estado operacional: disponível, vendido, alertas urgentes e SKUs abaixo do crítico. Os números vêm das coleções reais carregadas do Firebase e das peças físicas ativas."
  },
  {
    "id": "dashboard-kpis",
    "chapter": "Painel",
    "title": "Indicadores clicáveis",
    "route": "dashboard",
    "target": {
      "text": "Disponível"
    },
    "duration": 8,
    "body": "Os cartões de indicador também são atalhos. Disponível abre Estoque; Vendido abre Vendas; Alertas urgentes abre Alertas; Abaixo do crítico direciona à reposição preventiva."
  },
  {
    "id": "dashboard-actions",
    "chapter": "Painel",
    "title": "Rotina rápida do gestor",
    "route": "dashboard",
    "target": {
      "text": "Importar inventário"
    },
    "duration": 9,
    "body": "A sequência sugerida é: importar inventário para formar a base física, importar venda para baixar o que existe, consultar peças por código/medida/material e decidir faltas sem gerar estoque negativo."
  },
  {
    "id": "dashboard-alerts",
    "chapter": "Painel",
    "title": "Alertas e reposição preventiva",
    "route": "dashboard",
    "target": {
      "text": "Alertas do gestor"
    },
    "duration": 8,
    "body": "Falta de venda não vira estoque negativo. O sistema mantém a venda pendente e cria alerta para decisão. A reposição preventiva é calculada separadamente pelos limites mínimo, crítico, ideal e sugestão."
  },
  {
    "id": "import-intro",
    "chapter": "Importar PDF",
    "title": "Escolher a finalidade do PDF",
    "route": "importacao",
    "target": {
      "text": "Escolha se o PDF entra como inventário ou venda."
    },
    "duration": 9,
    "body": "A mesma leitura de PDF pode seguir fluxos diferentes. Catálogo cadastra referência sem estoque; inventário cria entrada física; pedido de produção registra demanda; produção pronta cria peças; venda baixa peças e abre alerta para faltas."
  },
  {
    "id": "import-file",
    "chapter": "Importar PDF",
    "title": "Arquivo, tipo e responsável",
    "route": "importacao",
    "target": {
      "text": "Arquivo PDF"
    },
    "duration": 8,
    "body": "O usuário seleciona o arquivo, o tipo da importação e o responsável. O extrator lê cabeçalho, itens, quantidades, peso total da linha, material, medida, lote e imagens quando disponíveis."
  },
  {
    "id": "import-extract",
    "chapter": "Importar PDF",
    "title": "Extrair antes de confirmar",
    "route": "importacao",
    "target": {
      "text": "Extrair PDF"
    },
    "duration": 8,
    "body": "Extrair não grava a operação final. Primeiro o sistema monta uma prévia para conferência. A confirmação posterior executa validação de duplicidade, fotos, documento, itens, estoque, auditoria e conclusão."
  },
  {
    "id": "import-progress",
    "chapter": "Importar PDF",
    "title": "Progresso rastreável da importação",
    "route": "importacao",
    "target": {
      "text": "PDFs lançados recentemente"
    },
    "duration": 8,
    "body": "Durante a confirmação, a interface mostra as etapas Preparação, Fotos e arquivos, Documento, Itens e estoque, Auditoria e Conclusão. Se houver falha, a importação não deve ser tratada como concluída."
  },
  {
    "id": "import-history",
    "chapter": "Importar PDF",
    "title": "Histórico e estornos por documento",
    "route": "importacao",
    "target": {
      "text": "PDFs lançados recentemente"
    },
    "duration": 9,
    "body": "Os PDFs recentes preservam o vínculo entre cabeçalho, itens, peças, lotes, vendas, produção e auditoria. O estorno é feito pela origem correta e não apaga o histórico técnico."
  },
  {
    "id": "import-duplicate",
    "chapter": "Importar PDF",
    "title": "Bloqueio de duplicidade",
    "route": "importacao",
    "target": {
      "text": "PDFs lançados recentemente"
    },
    "duration": 8,
    "body": "Antes de gravar, o sistema compara número do pedido, arquivo e tipo. Documentos já concluídos são bloqueados; falhas anteriores podem ser analisadas sem criar uma duplicação silenciosa."
  },
  {
    "id": "stock-intro",
    "chapter": "Estoque",
    "title": "Consulta operacional",
    "route": "estoque",
    "target": {
      "text": "Consulte peças por código, material e medida."
    },
    "duration": 8,
    "body": "O Estoque não é apenas um número agregado. A tela cruza produto, peça física, lote, estado, peso contábil e pendências para apresentar o saldo operacional."
  },
  {
    "id": "stock-kpis",
    "chapter": "Estoque",
    "title": "Quantidade e peso separados",
    "route": "estoque",
    "target": {
      "text": "Peso disponível"
    },
    "duration": 9,
    "body": "Quantidade e peso são razões independentes. Uma linha pode ter 10 peças e 8,000 g totais sem o sistema fingir que cada peça pesa 0,800 g. O peso individual só é usado quando realmente informado ou medido."
  },
  {
    "id": "stock-manual",
    "chapter": "Estoque",
    "title": "Entrada manual rápida",
    "route": "estoque",
    "target": {
      "text": "Entrada manual rápida no estoque"
    },
    "duration": 9,
    "body": "A entrada manual cria produto quando necessário, lote, peças físicas, movimento e razão de peso. Código, descrição, material, medida, quantidade, peso total, lote, responsável e observação formam a rastreabilidade da entrada."
  },
  {
    "id": "stock-filters",
    "chapter": "Estoque",
    "title": "Busca técnica por SKU",
    "route": "estoque",
    "target": {
      "text": "Busca geral"
    },
    "duration": 8,
    "body": "Os filtros trabalham com código, descrição, material, medida, lote, pedido e outros campos normalizados. O produto operacional é identificado de forma consistente para evitar misturar variantes."
  },
  {
    "id": "stock-rules",
    "chapter": "Estoque",
    "title": "Regras de mínimo e reposição",
    "route": "estoque",
    "target": {
      "text": "Aplicar aos selecionados"
    },
    "duration": 9,
    "body": "O gestor pode selecionar SKUs filtrados e aplicar mínimo, crítico, ideal e sugestão. Essas regras alimentam avisos e produção sugerida, mas não criam produção automática."
  },
  {
    "id": "stock-physical",
    "chapter": "Estoque",
    "title": "Peças físicas individuais",
    "route": "estoque",
    "target": {
      "text": "Ver peças físicas individuais"
    },
    "duration": 9,
    "body": "Cada peça física guarda estado e vínculos: disponível, vendida, reservada, consignada, estornada ou substituída por inventário; produto, lote, origem, pedido, venda, produção e peso quando conhecido."
  },
  {
    "id": "stock-reorder",
    "chapter": "Estoque",
    "title": "Reposição sugerida",
    "route": "estoque",
    "target": {
      "text": "Ver reposição sugerida"
    },
    "duration": 8,
    "body": "Reposição sugerida compara disponível com os parâmetros do produto. Ela é uma recomendação gerencial; não altera o estoque nem cria ordem sem decisão explícita."
  },
  {
    "id": "stock-operational-alerts",
    "chapter": "Estoque",
    "title": "Alertas operacionais",
    "route": "estoque",
    "target": {
      "text": "Alertas operacionais"
    },
    "duration": 8,
    "body": "A tela separa problemas de peso real, SKUs abaixo do mínimo e faltas de venda. Cada tipo de alerta leva à área correta, sem misturar produção, inventário e venda."
  },
  {
    "id": "sales-intro",
    "chapter": "Vendas",
    "title": "Venda por PDF",
    "route": "vendas",
    "target": {
      "text": "Importar venda por PDF"
    },
    "duration": 8,
    "body": "A venda por PDF extrai os itens, encontra as peças compatíveis pelo SKU operacional, baixa o que existe, calcula peso total da linha proporcional à quantidade baixada e cria alerta para o restante."
  },
  {
    "id": "sales-check",
    "chapter": "Vendas",
    "title": "Conferência pós-importação",
    "route": "vendas",
    "target": {
      "text": "O que conferir depois"
    },
    "duration": 8,
    "body": "Depois da venda, confira pedido, cliente, vendedor, quantidade solicitada, quantidade baixada, faltante, material, medida, status e origem. Uma venda incompleta permanece rastreável até ser atendida ou cancelada."
  },
  {
    "id": "sales-manual",
    "chapter": "Vendas",
    "title": "Venda manual no balcão",
    "route": "vendas",
    "target": {
      "text": "Venda manual no balcão"
    },
    "duration": 9,
    "body": "A venda manual usa carrinho. O usuário informa pedido, cliente, vendedor, pagamento, status e motivo, adiciona itens e somente então fecha a venda."
  },
  {
    "id": "sales-weight",
    "chapter": "Vendas",
    "title": "Peso total real vendido",
    "route": "vendas",
    "target": {
      "text": "Peso total real vendido"
    },
    "duration": 9,
    "body": "O campo recebe o peso total real das peças daquele item, não o peso unitário. A pré-validação impede baixar mais peso do que a razão disponível permite."
  },
  {
    "id": "sales-cart",
    "chapter": "Vendas",
    "title": "Carrinho e fechamento",
    "route": "vendas",
    "target": {
      "text": "Fechar venda"
    },
    "duration": 8,
    "body": "Adicionar inclui o item no carrinho; Limpar itens apaga apenas o carrinho ainda não fechado; Fechar venda executa a baixa real, grava histórico, movimento, usuário e auditoria."
  },
  {
    "id": "sales-list",
    "chapter": "Vendas",
    "title": "Vendas registradas e filtros",
    "route": "vendas",
    "target": {
      "text": "Vendas registradas"
    },
    "duration": 9,
    "body": "Os cards agrupam as linhas por pedido e mostram status operacional. Os filtros por pedido, código, cliente, status e busca geral atuam sobre os dados já carregados."
  },
  {
    "id": "sales-reversal",
    "chapter": "Vendas",
    "title": "Estorno seguro da venda",
    "route": "vendas",
    "target": {
      "text": "Estornar venda"
    },
    "duration": 10,
    "body": "O estorno exige justificativa, devolve somente peças e peso realmente baixados, encerra as linhas da venda e reconcilia o cabeçalho do PDF. Repetir um estorno concluído não pode devolver saldo novamente."
  },
  {
    "id": "alerts-intro",
    "chapter": "Alertas",
    "title": "Faltas por pedido",
    "route": "alertas",
    "target": {
      "text": "Faltas de venda por pedido."
    },
    "duration": 8,
    "body": "Os alertas agrupam por pedido para o gestor enxergar solicitado, baixado e faltante. O estoque permanece seguro e a venda não desaparece."
  },
  {
    "id": "alerts-approved",
    "chapter": "Alertas",
    "title": "Produção aprovada não é ordem automática",
    "route": "alertas",
    "target": {
      "text": "Produção aprovada pendente"
    },
    "duration": 10,
    "body": "Ao escolher produzir, o alerta registra a quantidade aprovada e move a pendência da venda para produção. Isso não cria ordem de produção automaticamente. A entrada de produção pronta posterior atende a venda."
  },
  {
    "id": "alerts-queue",
    "chapter": "Alertas",
    "title": "Fila de decisão do gestor",
    "route": "alertas",
    "target": {
      "text": "Fila de decisão por pedido"
    },
    "duration": 9,
    "body": "Cada pedido permite decidir conforme a operação: produzir, comprar, ajustar estoque ou cancelar. A decisão, o usuário, o cargo, a data e a hora devem permanecer na auditoria."
  },
  {
    "id": "production-intro",
    "chapter": "Produção",
    "title": "Fila e entrada de produção",
    "route": "producao",
    "target": {
      "text": "Entrada manual e fila de produção."
    },
    "duration": 8,
    "body": "Produção reúne demanda pendente e entrada pronta. A fila orienta o que falta; a entrada pronta é o evento que cria as peças físicas e o peso de produção."
  },
  {
    "id": "production-queue",
    "chapter": "Produção",
    "title": "Fila de produção pendente",
    "route": "producao",
    "target": {
      "text": "Fila de produção pendente"
    },
    "duration": 8,
    "body": "Pedidos de produção formais e pendências podem ser exibidos na fila. O botão Dar entrada preenche o formulário com a referência escolhida, sem concluir nada sozinho."
  },
  {
    "id": "production-form",
    "chapter": "Produção",
    "title": "Entrada de produção pronta",
    "route": "producao",
    "target": {
      "text": "Entrada de produção pronta"
    },
    "duration": 9,
    "body": "Produto, quantidade, peso, lote, responsável, observação e eventual pedido pendente formam a entrada. O sistema cria peças físicas e registra o vínculo com a origem."
  },
  {
    "id": "production-weights",
    "chapter": "Produção",
    "title": "Pesos reais por peça",
    "route": "producao",
    "target": {
      "text": "Pesos reais por peça"
    },
    "duration": 9,
    "body": "Quando o peso individual é conhecido, pode ser informado um por peça. Isso melhora a baixa futura sem transformar o peso total em suposição unitária."
  },
  {
    "id": "production-groups",
    "chapter": "Produção",
    "title": "Grupos de peso e lote",
    "route": "producao",
    "target": {
      "text": "Entrada por grupos de peso/lote"
    },
    "duration": 10,
    "body": "Uma mesma produção pode vir em grupos, como 28 peças de 2,000 g e 2 peças de 2,100 g. A soma dos grupos deve bater com a quantidade produzida."
  },
  {
    "id": "production-reconcile",
    "chapter": "Produção",
    "title": "Dar entrada e reconciliar",
    "route": "producao",
    "target": {
      "text": "Dar entrada e reconciliar"
    },
    "duration": 10,
    "body": "A entrada procura alertas de produção aprovados do mesmo produto. Aplica somente o necessário às vendas pendentes; qualquer excedente continua disponível no estoque e fica registrado no cabeçalho da produção."
  },
  {
    "id": "production-history",
    "chapter": "Produção",
    "title": "Histórico de produção",
    "route": "producao",
    "target": {
      "text": "Histórico de produção"
    },
    "duration": 8,
    "body": "O histórico mostra produção manual, produção pronta por PDF, lotes, peso, quantidade e atendimento de vendas. É a origem correta para investigar as seis peças que sobraram no caso auditado."
  },
  {
    "id": "production-reversal",
    "chapter": "Produção",
    "title": "Estornar entrada de produção",
    "route": "producao",
    "target": {
      "text": "Estornar entrada"
    },
    "duration": 10,
    "body": "A produção só pode ser estornada quando nenhuma de suas peças estiver vendida, reservada ou consignada. Depois, o sistema estorna peças, lote, razão de peso e cabeçalho daquela produção, sem apagar outras origens."
  },
  {
    "id": "products-register",
    "chapter": "Joias",
    "title": "Cadastro técnico do produto",
    "route": "produtos",
    "target": {
      "text": "Código"
    },
    "duration": 8,
    "body": "O cadastro técnico define código, descrição, tipo, material, medida, peso médio, estoque mínimo e foto. Ele não cria estoque físico por si só."
  },
  {
    "id": "products-catalog",
    "chapter": "Joias",
    "title": "Catálogo técnico e variantes",
    "route": "produtos",
    "target": {
      "text": "Catálogo técnico de joias"
    },
    "duration": 9,
    "body": "Código, medida e material separam variantes operacionais. A busca geral inclui descrição, lote e outros campos; os status ajudam a encontrar disponíveis, pendentes, críticos e zerados."
  },
  {
    "id": "products-types",
    "chapter": "Joias",
    "title": "Tipos personalizados",
    "route": "produtos",
    "target": {
      "text": "Novo tipo"
    },
    "duration": 8,
    "body": "O gestor pode adicionar tipos de joia sem alterar o algoritmo do produto. O tipo é um atributo técnico e de apresentação."
  },
  {
    "id": "clients-register",
    "chapter": "Clientes",
    "title": "Cadastro de clientes",
    "route": "clientes",
    "target": {
      "text": "Cadastrar cliente"
    },
    "duration": 8,
    "body": "Nome, documento, telefone, e-mail, responsável, endereço, cidade, UF e tipo alimentam venda, consignação, histórico e relatórios."
  },
  {
    "id": "clients-list",
    "chapter": "Clientes",
    "title": "Carteira de clientes",
    "route": "clientes",
    "target": {
      "text": "Carteira de clientes"
    },
    "duration": 8,
    "body": "A carteira mantém os registros comerciais utilizados na operação. Importações também podem cadastrar ou atualizar cliente a partir do cabeçalho do PDF."
  },
  {
    "id": "reports-main",
    "chapter": "Relatórios",
    "title": "Relatórios de estoque e vendas",
    "route": "relatorios",
    "target": {
      "text": "Gerar laudos e relatórios"
    },
    "duration": 9,
    "body": "O usuário escolhe o tipo, a visualização e filtros por código, medida e material. Relatório de vendas ativas não mostra vendas estornadas; estoque pode mostrar SKUs zerados para rastreabilidade."
  },
  {
    "id": "reports-print",
    "chapter": "Relatórios",
    "title": "Imprimir ou salvar PDF",
    "route": "relatorios",
    "target": {
      "text": "Imprimir / Salvar PDF"
    },
    "duration": 8,
    "body": "A impressão usa a visualização gerada na própria tela. Os números vêm dos mesmos dados carregados pelo sistema, sem criar uma segunda base paralela."
  },
  {
    "id": "reports-backup",
    "chapter": "Relatórios",
    "title": "Backup e restauração",
    "route": "relatorios",
    "target": {
      "text": "Backup do banco de dados"
    },
    "duration": 10,
    "body": "O backup JSON reúne as coleções da empresa. A restauração exige arquivo compatível e deve ser usada com cuidado. O backup diário no navegador é um recurso adicional, não substitui governança externa."
  },
  {
    "id": "audit-intro",
    "chapter": "Auditoria",
    "title": "Quem fez, quando e por quê",
    "route": "auditoria",
    "target": {
      "text": "Auditoria da operação"
    },
    "duration": 9,
    "body": "Cada registro guarda ação, coleção, documento, usuário, e-mail, cargo/função, data, hora, motivo, resumo, estado antes/depois e metadados quando aplicável."
  },
  {
    "id": "audit-search",
    "chapter": "Auditoria",
    "title": "Pesquisa e exportação",
    "route": "auditoria",
    "target": {
      "text": "Consultar auditoria"
    },
    "duration": 8,
    "body": "A busca localiza pedido, usuário, ação, coleção ou justificativa. A exportação JSON preserva os registros exibidos para análise externa."
  },
  {
    "id": "audit-details",
    "chapter": "Auditoria",
    "title": "Impacto e dados técnicos",
    "route": "auditoria",
    "target": {
      "text": "Ver impacto e dados técnicos registrados"
    },
    "duration": 9,
    "body": "Os detalhes mostram o que havia antes e depois e os metadados da operação. Dados de imagem muito grandes devem ser apresentados de forma controlada para não poluir a tela."
  },
  {
    "id": "rules-main",
    "chapter": "Regras e acesso",
    "title": "Parâmetros da operação",
    "route": "configuracoes",
    "target": {
      "text": "Regras da operação"
    },
    "duration": 9,
    "body": "Dias de estoque parado, estoque mínimo padrão e comissão padrão influenciam relatórios e alertas. Comissão é restrita ao Administrador Master."
  },
  {
    "id": "rules-save",
    "chapter": "Regras e acesso",
    "title": "Salvar regras com auditoria",
    "route": "configuracoes",
    "target": {
      "text": "Salvar regras"
    },
    "duration": 8,
    "body": "Salvar atualiza configurações no Firebase e grava auditoria com estado anterior e posterior. Não é uma alteração somente visual."
  },
  {
    "id": "roles",
    "chapter": "Regras e acesso",
    "title": "Cargos e permissões",
    "route": "configuracoes",
    "target": {
      "text": "Fluxos protegidos"
    },
    "duration": 10,
    "body": "Administrador Master tem acesso completo; Gerente administra operação; Vendedor e Atendente trabalham com cadastro e comercial; Entregador consulta fluxos permitidos. O menu e as ações são filtrados pelo cargo."
  },
  {
    "id": "assistant",
    "chapter": "Assistente interno",
    "title": "Consultas operacionais",
    "route": "assistente",
    "target": {
      "text": "Pergunte sobre a operação"
    },
    "duration": 10,
    "body": "O assistente interno consulta dados carregados da empresa: produtos, peças, vendas, clientes, produção, consignações e comissões conforme a permissão. Ele também explica fluxos cadastrados, mas não deve inventar fórmula técnica ausente."
  },
  {
    "id": "ar-admin",
    "chapter": "Realidade aumentada",
    "title": "Administração de modelos AR",
    "page": "ar.html",
    "target": {
      "selector": "body"
    },
    "duration": 9,
    "body": "A página AR é separada do painel principal. Ela administra título, descrição, foto, modelos 3D e parâmetros de visualização, com autenticação e vínculos próprios."
  },
  {
    "id": "ar-public",
    "chapter": "Realidade aumentada",
    "title": "Visualização pública AR",
    "page": "ar-publico.html",
    "target": {
      "selector": "body"
    },
    "duration": 9,
    "body": "A página pública abre o item compartilhado e usa o modelo configurado. O manual a mostra como parte real do mesmo repositório, sem reproduzir uma tela fictícia."
  },
  {
    "id": "finish",
    "chapter": "Conclusão",
    "title": "Mapa completo e perguntas",
    "route": "dashboard",
    "target": {
      "selector": "main.main"
    },
    "duration": 12,
    "body": "A apresentação terminou. Use o mapa de capítulos para voltar a qualquer função. No campo Perguntar, a resposta é buscada primeiro na base de conhecimento construída a partir do código, documentos e testes deste ZIP; quando não há evidência suficiente, o sistema informa isso em vez de inventar."
  }
];

export const MANUAL_KNOWLEDGE = [
  {
    "id": "architecture",
    "title": "Arquitetura geral",
    "keywords": [
      "arquitetura",
      "tecnologia",
      "firebase",
      "vercel",
      "como foi feito",
      "estrutura"
    ],
    "answer": "A aplicação é uma SPA em HTML, CSS e JavaScript módulos. O arquivo index.html carrega js/app.js; app.js coordena rotas, regras e telas; firebaseClient.js autentica e acessa o Realtime Database; pdf-importer.js extrai PDFs; reports.js gera relatórios; assistant.js responde consultas operacionais; cloudinary.js trata imagens; ar.html e ar-publico.html cuidam de realidade aumentada.",
    "sources": [
      "index.html",
      "js/app.js: boot, render e shell",
      "js/firebaseClient.js",
      "js/pdf-importer.js",
      "js/reports.js",
      "js/assistant.js"
    ],
    "route": "dashboard",
    "step": "intro"
  },
  {
    "id": "auth",
    "title": "Login e usuário ativo",
    "keywords": [
      "login",
      "autenticação",
      "usuario ativo",
      "acesso",
      "senha"
    ],
    "answer": "O boot inicializa o Firebase e observa a sessão. Com usuário autenticado, loadData carrega as coleções. isActiveUser aceita o gestor configurado ou exige um perfil ativo em usuarios. Sem perfil ativo, a tela informa que o acesso ainda não foi liberado.",
    "sources": [
      "js/app.js: boot, loginView, isActiveUser, currentUserProfile",
      "js/firebaseClient.js"
    ],
    "route": "dashboard",
    "step": "login"
  },
  {
    "id": "roles",
    "title": "Cargos e permissões",
    "keywords": [
      "cargo",
      "papel",
      "permissão",
      "administrador",
      "gerente",
      "vendedor",
      "atendente",
      "entregador"
    ],
    "answer": "Os cargos são dono/Administrador Master, gerente, vendedor, atendente e entregador. ROUTE_ROLES define quais rotas cada cargo pode abrir. Além disso, funções como canRegisterCommercialOperation, canRegisterProduct, canManageCollaborators e canEditRules limitam ações. O Administrador Master mantém acesso completo.",
    "sources": [
      "js/app.js: ROLE_OPTIONS, ROUTE_ROLES, canAccessRoute e funções can*"
    ],
    "route": "configuracoes",
    "step": "roles"
  },
  {
    "id": "collections",
    "title": "Coleções do banco",
    "keywords": [
      "coleção",
      "banco",
      "database",
      "dados",
      "firebase",
      "tabelas"
    ],
    "answer": "A base da empresa inclui configurações, tiposProduto, produtos, clientes, vendedores, pedidos, vendas, consignacoes, cadastrosMostruario, inventariosEstoque, pedidosProducao, lotes, pecasEstoque, movimentos, estoqueMovimentos, alertasOperacionais, usuarios, auditoria, iaConsultas, parametrosTecnicos, producoes e comissoes. Os testes pós-deploy confirmam o carregamento desse conjunto.",
    "sources": [
      "js/firebaseClient.js",
      "docs/estrutura-dados.md",
      "scripts/TESTE-GLAMORE-V67-COMPLETO-POS-DEPLOY-COM-LIMPEZA.js"
    ],
    "route": "auditoria",
    "step": "audit-intro"
  },
  {
    "id": "product-identity",
    "title": "Identidade do produto e variante",
    "keywords": [
      "sku",
      "produto id",
      "código medida material",
      "variante",
      "misturar produtos"
    ],
    "answer": "O produto operacional é separado por código, medida e material normalizados. A venda também verifica compatibilidade de descrição e variante para evitar que peças de outra medida ou material sejam baixadas. Lote e peso podem refinar critérios quando a operação exige.",
    "sources": [
      "js/utils.js: productIdFrom",
      "js/app.js: saleStockKey, technicalVariantKey, operationalSalePieceMatchesItem"
    ],
    "route": "produtos",
    "step": "products-catalog"
  },
  {
    "id": "physical-pieces",
    "title": "Modelo de peça física",
    "keywords": [
      "peça física",
      "pecas estoque",
      "unidade",
      "status peça",
      "rastrear peça"
    ],
    "answer": "pecasEstoque representa unidades físicas. Cada peça pode guardar produtoId, código, medida, material, lote, origem, pedido, inventário, produção, venda e peso quando conhecido. Estados ativos incluem disponível, vendido, reservado e consignado; estornada, cancelada, excluída e substituída por inventário não entram no saldo ativo.",
    "sources": [
      "js/app.js: createPhysicalPieces, physicalPieces, pieceIsActive, physicalPieceTable",
      "AUDITORIA-V24-PECA-FISICA.md"
    ],
    "route": "estoque",
    "step": "stock-physical"
  },
  {
    "id": "weight-ledger",
    "title": "Quantidade e peso independentes",
    "keywords": [
      "peso",
      "quantidade independente",
      "razão de peso",
      "ledger",
      "peso total",
      "peso unitário"
    ],
    "answer": "O sistema mantém entrada, saída, reservado, consignado e disponível de peso de modo independente da contagem de peças. O peso do PDF é o total da linha. Ele não deve ser tratado como peso unitário. Peso individual só é usado quando a peça possui peso real ou quando o usuário informa pesos por peça/grupo.",
    "sources": [
      "js/app.js: productWeightLedgerSnapshot, applyProductWeightLedgerDelta, lineWeightTotal, unitWeightFromLine",
      "AUDITORIA-V54-PESO-CONTABIL-REAL-74250-SEM-ASSUMIR-1G.md",
      "tests/v56-weight-reversal.test.mjs"
    ],
    "route": "estoque",
    "step": "stock-kpis"
  },
  {
    "id": "catalog-import",
    "title": "Importação de catálogo",
    "keywords": [
      "catálogo pdf",
      "catalogo peças",
      "cadastrar sem estoque"
    ],
    "answer": "A importação de catálogo atualiza ou cria referências técnicas e fotos, mas não cria peças físicas nem saldo disponível. Essa separação evita transformar catálogo em inventário.",
    "sources": [
      "js/app.js: isCatalogImport e confirmImport",
      "tests/smoke-test.mjs"
    ],
    "route": "importacao",
    "step": "import-intro"
  },
  {
    "id": "inventory-import",
    "title": "Importação de inventário",
    "keywords": [
      "inventário",
      "estoque atual",
      "entrada pdf",
      "importar estoque"
    ],
    "answer": "Inventário é entrada operacional. Para cada item válido, o sistema resolve o produto, cria lotes e peças físicas, atualiza a razão de peso e grava inventariosEstoque, movimentos e auditoria. Uma nova fotografia integral pode arquivar peças disponíveis anteriores daquela referência conforme a lógica de inventário.",
    "sources": [
      "js/app.js: isStockImport, registerLotEntry, createPhysicalPieces, archiveAvailablePiecesForInventory, confirmImport",
      "AUDITORIA-V32-VENDA-AGRUPADA-ENTRADA-POR-LOTES.md"
    ],
    "route": "importacao",
    "step": "import-history"
  },
  {
    "id": "duplicate-import",
    "title": "Duplicidade de PDF",
    "keywords": [
      "duplicidade",
      "pdf repetido",
      "pedido já importado",
      "bloquear importação"
    ],
    "answer": "findDuplicateImportDocument compara documentos já existentes pelo número e contexto da importação. Um documento concluído compatível é bloqueado para impedir estoque, venda ou produção duplicados. Registros de falha são tratados separadamente.",
    "sources": [
      "js/app.js: sameImportNumber, isFailedImportDocument, findDuplicateImportDocument, confirmImport"
    ],
    "route": "importacao",
    "step": "import-duplicate"
  },
  {
    "id": "pdf-parser",
    "title": "Leitura do PDF",
    "keywords": [
      "extrair pdf",
      "parser",
      "como lê pdf",
      "fotos pdf"
    ],
    "answer": "pdf-importer.js usa PDF.js para extrair texto e imagens. A saída normaliza cabeçalho, itens, quantidade, peso da linha, medida, material, observação e referências. app.js ainda valida os itens antes de transformá-los em operação.",
    "sources": [
      "js/pdf-importer.js",
      "js/app.js: isValidOperationalItem, attachPdfPhotosToItems"
    ],
    "route": "importacao",
    "step": "import-file"
  },
  {
    "id": "photos",
    "title": "Fotos e Cloudinary",
    "keywords": [
      "foto",
      "imagem",
      "cloudinary",
      "upload foto pdf"
    ],
    "answer": "Fotos extraídas ou selecionadas são enviadas pelo módulo cloudinary.js. app.js associa a URL ao item/produto e tenta novamente em falhas transitórias. A foto é suporte visual; não substitui código, medida e material na identificação operacional.",
    "sources": [
      "js/cloudinary.js",
      "js/app.js: uploadImageWithRetry, attachPdfPhotosToItems"
    ],
    "route": "produtos",
    "step": "products-register"
  },
  {
    "id": "sale-preflight",
    "title": "Pré-validação da venda",
    "keywords": [
      "pré validação venda",
      "vender sem peso",
      "bloqueio venda",
      "preflight"
    ],
    "answer": "Antes da baixa, salePreflightForItems calcula disponibilidade física, peso necessário e faltas. assertSaleWeightAvailable impede saída de peso superior ao disponível. O usuário confirma venda parcial ou venda sem estoque conforme o cenário; a plataforma não deve ocultar a divergência.",
    "sources": [
      "js/app.js: salePreflightForItems, assertSaleWeightAvailable, confirmSalePreflight"
    ],
    "route": "vendas",
    "step": "sales-check"
  },
  {
    "id": "sale-matching",
    "title": "Como a venda escolhe peças",
    "keywords": [
      "qual peça vende",
      "baixa por sku",
      "critério venda",
      "selecionar peças"
    ],
    "answer": "A baixa procura peças disponíveis compatíveis com o item pelo produto preferido e pelo conjunto código, descrição, material e medida. Critérios técnicos adicionais podem incluir lote e peso. A quantidade solicitada é separada da quantidade realmente baixada.",
    "sources": [
      "js/app.js: operationalSalePieceMatchesItem, availablePiecesForSaleOperationalItem, moveSpecificPhysicalPiecesToSold"
    ],
    "route": "vendas",
    "step": "sales-intro"
  },
  {
    "id": "partial-sale",
    "title": "Venda parcial e falta",
    "keywords": [
      "venda parcial",
      "faltou estoque",
      "quantidade baixada",
      "quantidade faltante"
    ],
    "answer": "processSaleStockAndShortage baixa o que existe e calcula o faltante. O registro da venda mantém quantidade solicitada, baixada, pendente de análise e pendente de produção. O cabeçalho do pedido resume o estado das linhas.",
    "sources": [
      "js/app.js: processSaleStockAndShortage, stockStatusFromQuantities, syncCommercialOrderFromSales"
    ],
    "route": "vendas",
    "step": "sales-check"
  },
  {
    "id": "manager-alert",
    "title": "Alerta de falta para o gestor",
    "keywords": [
      "alerta gestor",
      "falta venda",
      "sem estoque",
      "decisão produzir"
    ],
    "answer": "createManagerShortageAlertFromSale grava um alerta venda_sem_estoque com pedido, item, solicitado, baixado, faltante, peso de referência e vínculo da venda. O alerta exige decisão gerencial e não cria estoque negativo.",
    "sources": [
      "js/app.js: createManagerShortageAlertFromSale, pendingManagerStockAlerts, managerAlertCards"
    ],
    "route": "alertas",
    "step": "alerts-intro"
  },
  {
    "id": "approved-production",
    "title": "Aprovação de produção no alerta",
    "keywords": [
      "aprovar produção",
      "produzir 20",
      "não ordem de produção",
      "alerta produção aprovada"
    ],
    "answer": "approveManagerAlertProduction registra a quantidade aprovada no alerta e atualiza a venda para pendente de produção. A regra validada é explícita: essa aprovação não cria pedidosProducao. A produção só existe quando uma entrada pronta é lançada.",
    "sources": [
      "js/app.js: approveManagerAlertProduction, patchSaleProductionApprovalFromAlert",
      "AUDITORIA-V64-ALERTA-PRODUCAO-ATENDE-VENDA-EXCEDENTE-ESTOQUE.md",
      "tests/v64-approved-alert-production-flow.test.mjs"
    ],
    "route": "alertas",
    "step": "alerts-approved"
  },
  {
    "id": "production-fulfillment",
    "title": "Produção pronta atendendo venda",
    "keywords": [
      "produção pronta atende venda",
      "excedente estoque",
      "20 produzidas 10 venda"
    ],
    "answer": "applyProductionToApprovedAlerts recebe as peças recém-criadas, atende alertas aprovados do produto até o limite pendente, marca as peças aplicadas como vendidas, atualiza venda e alerta e mantém o excedente disponível. Exemplo validado: 20 recebidas, 10 aplicadas na venda e 10 disponíveis.",
    "sources": [
      "js/app.js: applyProductionToApprovedAlerts, updateSaleAfterApprovedAlertFulfillment",
      "AUDITORIA-V64-ALERTA-PRODUCAO-ATENDE-VENDA-EXCEDENTE-ESTOQUE.md",
      "tests/v65-production-header-summary.test.mjs"
    ],
    "route": "producao",
    "step": "production-reconcile"
  },
  {
    "id": "production-groups",
    "title": "Entrada por grupos de peso/lote",
    "keywords": [
      "grupos peso lote",
      "lotes produção",
      "pesos diferentes"
    ],
    "answer": "parseProductionLotGroups interpreta grupos de quantidade, peso e lote. productionGroupsTotals exige que a soma de quantidades seja coerente. Cada grupo gera peças físicas com o peso informado, preservando a heterogeneidade real da produção.",
    "sources": [
      "js/app.js: parseProductionLotGroups, productionLotSummary, productionGroupsTotals"
    ],
    "route": "producao",
    "step": "production-groups"
  },
  {
    "id": "sale-reversal",
    "title": "Estorno de venda",
    "keywords": [
      "estornar venda",
      "devolver peça",
      "devolver peso",
      "venda já estornada"
    ],
    "answer": "reverseSaleRecords exige motivo, identifica as peças vinculadas, devolve apenas as baixas válidas, reverte a saída de peso, atualiza a venda e reconcilia os cabeçalhos de PDF. O registro estornado impede repetição da devolução. A auditoria permanece.",
    "sources": [
      "js/app.js: reverseSaleRecords, reconcileSalePdfHeaders, requestReverseSale",
      "tests/v56-weight-reversal.test.mjs",
      "tests/v63-reversal-final-balance.test.mjs"
    ],
    "route": "vendas",
    "step": "sales-reversal"
  },
  {
    "id": "pdf-status",
    "title": "Corrigir status do PDF",
    "keywords": [
      "corrigir status pdf",
      "reconciliar estorno",
      "pdf continua aparecendo"
    ],
    "answer": "Quando linhas de venda antigas já estão estornadas, mas o cabeçalho do PDF ficou ativo, reconcilePreviouslyReversedSalePdf apenas marca o documento como estornado. A confirmação informa que nenhuma peça, quantidade, peso, lote ou saldo será movimentado novamente.",
    "sources": [
      "js/app.js: salePdfHeaderReversalState, reconcilePreviouslyReversedSalePdf, requirePdfStatusCorrectionReason",
      "AUDITORIA-V66-1-CORRECAO-NOME-STATUS-PDF.md"
    ],
    "route": "importacao",
    "step": "import-history"
  },
  {
    "id": "inventory-reversal",
    "title": "Estorno de inventário",
    "keywords": [
      "estornar inventário",
      "zerar estoque pdf",
      "inventario bloqueado"
    ],
    "answer": "reverseInventoryDocument calcula a cobertura do documento e bloqueia se houver peças vinculadas a saída. Após o estorno das vendas/consignações, marca as peças do inventário como estornadas, zera lotes e remove da razão de peso somente a entrada daquele documento. Outros inventários ou produções permanecem.",
    "sources": [
      "js/app.js: inventoryDocumentReversalCoverage, reverseInventoryDocument",
      "tests/v60-multiitem-reversal-reconciliation.test.mjs",
      "tests/v63-reversal-final-balance.test.mjs"
    ],
    "route": "importacao",
    "step": "import-history"
  },
  {
    "id": "production-reversal",
    "title": "Estorno de produção",
    "keywords": [
      "estornar produção",
      "estornar entrada produção",
      "produção bloqueada"
    ],
    "answer": "reverseProductionDocument resolve o cabeçalho e os registros técnicos da produção, valida todos os IDs antes de mutações e bloqueia se houver peças vendidas, reservadas ou consignadas. Quando liberado, estorna peças, lotes, peso e documentos daquela produção e grava auditoria sanitizada.",
    "sources": [
      "js/app.js: productionReversalContext, productionReversalCoverage, reverseProductionDocument",
      "AUDITORIA-V67-ESTORNO-PRODUCAO-ID-AUDITORIA-SEGURA.md",
      "tests/v67-production-reversal-integrity.test.mjs"
    ],
    "route": "producao",
    "step": "production-reversal"
  },
  {
    "id": "audit",
    "title": "Registro de auditoria",
    "keywords": [
      "auditoria",
      "quem fez",
      "data hora cargo",
      "antes depois",
      "metadados"
    ],
    "answer": "buildAuditRecord combina ação, coleção, documento, resumo, motivo e estado antes/depois com currentUserAuditInfo. O registro inclui UID, nome, e-mail, papel e cargo, além de data/hora. Operações de estorno usam auditoria de solicitação, conclusão ou falha. firebaseSafeAuditValue remove undefined antes de gravar.",
    "sources": [
      "js/app.js: currentUserAuditInfo, buildAuditRecord, auditLogStrict, startReversalAudit, completeReversalAudit, failReversalAudit, firebaseSafeAuditValue"
    ],
    "route": "auditoria",
    "step": "audit-intro"
  },
  {
    "id": "reports",
    "title": "Relatórios",
    "keywords": [
      "relatório estoque",
      "relatório vendas",
      "pdf relatório",
      "laudo"
    ],
    "answer": "buildInventoryReport gera a posição do estoque conforme filtros; buildSalesReport trabalha com vendas ativas e não deve reapresentar vendas estornadas. A tela permite impressão/salvamento em PDF e mantém backup separado do relatório.",
    "sources": [
      "js/reports.js: buildInventoryReport e buildSalesReport",
      "js/app.js: relatoriosView",
      "tests/v62-production-reports.test.mjs"
    ],
    "route": "relatorios",
    "step": "reports-main"
  },
  {
    "id": "backup",
    "title": "Backup e restauração",
    "keywords": [
      "backup",
      "restaurar",
      "json",
      "segurança banco"
    ],
    "answer": "backupPayload reúne as coleções carregadas e metadados. downloadBackupJson gera o arquivo. restoreBackupFromPayload valida a estrutura e regrava as coleções da empresa. Existe opção de download diário local às 17h, condicionada à página estar aberta.",
    "sources": [
      "js/app.js: backupPayload, downloadBackupJson, restoreBackupFromPayload, scheduleDailyBackupDownload"
    ],
    "route": "relatorios",
    "step": "reports-backup"
  },
  {
    "id": "filters",
    "title": "Filtros das telas",
    "keywords": [
      "filtro",
      "pesquisa",
      "buscar código",
      "busca geral"
    ],
    "answer": "Filtros de produto, estoque e vendas normalizam texto e aplicam os critérios no DOM sobre os registros carregados. Eles não modificam o Firebase. Botões Limpar removem os critérios atuais.",
    "sources": [
      "js/app.js: setupProductFilters, setupStockFilters, setupSalesFilters"
    ],
    "route": "estoque",
    "step": "stock-filters"
  },
  {
    "id": "stock-rules",
    "title": "Mínimo, crítico, ideal e sugestão",
    "keywords": [
      "estoque mínimo",
      "estoque crítico",
      "ideal",
      "sugestão reposição"
    ],
    "answer": "Cada produto pode ter limites próprios. O editor em massa aplica regras aos SKUs selecionados. criticalProducts compara disponível com o limite crítico/mínimo; a sugestão orienta o gestor, mas não cria entrada ou produção.",
    "sources": [
      "js/app.js: setupStockRulesEditor, criticalSummaryCards, productionNeededTable",
      "js/reports.js: criticalProducts"
    ],
    "route": "estoque",
    "step": "stock-rules"
  },
  {
    "id": "stopped-stock",
    "title": "Estoque parado",
    "keywords": [
      "estoque parado",
      "sem movimento",
      "dias parado"
    ],
    "answer": "stoppedProducts usa a última movimentação e o parâmetro diasEstoqueParado para identificar itens sem atividade. É um relatório gerencial e não altera o estado das peças.",
    "sources": [
      "js/reports.js: stoppedProducts",
      "js/app.js: configuracoesView e relatoriosView"
    ],
    "route": "relatorios",
    "step": "reports-main"
  },
  {
    "id": "commissions",
    "title": "Comissão",
    "keywords": [
      "comissão",
      "vendedor",
      "percentual"
    ],
    "answer": "Comissão nasce em venda final conforme vendedor e percentual configurado. A comissão padrão é restrita ao Administrador Master. Consignação pendente não deve ser tratada como venda concluída.",
    "sources": [
      "js/app.js: comissoesView, commissionTable, configuracoesView",
      "js/assistant.js: conhecimentoDoSistema"
    ],
    "route": "configuracoes",
    "step": "rules-main"
  },
  {
    "id": "consignment",
    "title": "Consignação",
    "keywords": [
      "consignação",
      "consignado",
      "devolver consignação",
      "converter venda"
    ],
    "answer": "Consignação move peças para consignado sem finalizar venda. convertConsignment transforma a saída pendente em venda; returnConsignment devolve as peças ao disponível. O histórico e o responsável permanecem registrados.",
    "sources": [
      "js/app.js: consignacoesView, consignmentTable, convertConsignment, returnConsignment",
      "js/assistant.js: conhecimentoDoSistema"
    ],
    "route": "consignacoes",
    "step": "assistant"
  },
  {
    "id": "clients",
    "title": "Clientes",
    "keywords": [
      "cliente",
      "carteira",
      "cadastro cliente",
      "histórico cliente"
    ],
    "answer": "Clientes podem ser cadastrados manualmente ou atualizados a partir do cabeçalho de pedido. O cliente é referenciado em vendas e relatórios, evitando repetir dados soltos em cada operação.",
    "sources": [
      "js/app.js: clientesView, upsertClienteFromPedido, clienteField"
    ],
    "route": "clientes",
    "step": "clients-register"
  },
  {
    "id": "assistant",
    "title": "Assistente operacional existente",
    "keywords": [
      "assistente",
      "ia",
      "perguntar operação",
      "consultar fábrica"
    ],
    "answer": "assistant.js interpreta perguntas sobre estoque, peças, lotes, vendas, clientes, produção, consignação e comissões usando os dados já carregados. Ele também possui explicações fixas de fluxo. Quando uma fórmula técnica não existe, a resposta explícita é não inventar o fator.",
    "sources": [
      "js/assistant.js",
      "js/app.js: assistenteView"
    ],
    "route": "assistente",
    "step": "assistant"
  },
  {
    "id": "ar",
    "title": "Realidade aumentada",
    "keywords": [
      "realidade aumentada",
      "ar",
      "glb",
      "usdz",
      "modelo 3d"
    ],
    "answer": "ar.html e js/ar.js administram itens de AR, upload de modelos e geração de link. ar-publico.html exibe o item compartilhado. O fluxo é separado do estoque/venda principal, embora pertença ao mesmo repositório.",
    "sources": [
      "ar.html",
      "ar-publico.html",
      "js/ar.js",
      "README-AR.md"
    ],
    "page": "ar.html",
    "step": "ar-admin"
  },
  {
    "id": "mobile",
    "title": "Responsividade móvel",
    "keywords": [
      "celular",
      "mobile",
      "responsivo",
      "menu celular"
    ],
    "answer": "O app injeta regras móveis e usa mobile-hardfix-v12.js. Em telas menores, a navegação lateral é substituída por um seletor de tela, grids viram uma coluna e tabelas recebem rótulos por célula. O manual usa o próprio iframe e, portanto, demonstra essa mesma responsividade.",
    "sources": [
      "index.html",
      "js/app.js: installMobileHardFixCss, enhanceResponsiveTables, enforceMobileDomState",
      "js/mobile-hardfix-v12.js"
    ],
    "route": "dashboard",
    "step": "navigation"
  },
  {
    "id": "truth",
    "title": "Como o manual evita respostas inventadas",
    "keywords": [
      "verdade",
      "não inventar",
      "100%",
      "fonte",
      "conhecimento"
    ],
    "answer": "A Central de treinamento usa respostas curadas com referência de arquivo/função e ainda pesquisa os arquivos reais do projeto. Quando a pergunta não encontra evidência suficiente, a resposta declara que não há base segura e mostra os trechos mais próximos. Não existe promessa técnica honesta de adivinhar qualquer pergunta fora do código e dos documentos.",
    "sources": [
      "js/manual-conhecimento.js",
      "js/manual-interativo.js"
    ],
    "route": "dashboard",
    "step": "finish"
  }
];

export const MANUAL_SOURCE_FILES = [
  "README.md",
  "README-AR.md",
  "docs/regras-negocio.md",
  "docs/estrutura-dados.md",
  "js/app.js",
  "js/assistant.js",
  "js/pdf-importer.js",
  "js/reports.js",
  "js/firebaseClient.js",
  "js/utils.js",
  "js/ar.js",
  "AUDITORIA-V24-PECA-FISICA.md",
  "AUDITORIA-V31-VENDA-INTELIGENTE-RESERVA-REPOSICAO.md",
  "AUDITORIA-V32-VENDA-AGRUPADA-ENTRADA-POR-LOTES.md",
  "AUDITORIA-V54-PESO-CONTABIL-REAL-74250-SEM-ASSUMIR-1G.md",
  "AUDITORIA-V56-EXTORNO-PESO-TOTAL-INDEPENDENTE.md",
  "AUDITORIA-V57-ESTORNO-JUSTIFICADO-AUDITORIA-VISIVEL.md",
  "AUDITORIA-V60-ESTORNO-PDF-MULTIITEM-RECONCILIACAO.md",
  "AUDITORIA-V62-PRODUCAO-PESO-RELATORIOS.md",
  "AUDITORIA-V63-ESTORNO-PARCIAL-INVENTARIO-ZERO.md",
  "AUDITORIA-V64-ALERTA-PRODUCAO-ATENDE-VENDA-EXCEDENTE-ESTOQUE.md",
  "AUDITORIA-V65-RASTREABILIDADE-CABECALHO-PRODUCAO.md",
  "AUDITORIA-V66-1-CORRECAO-NOME-STATUS-PDF.md",
  "AUDITORIA-V66-RECONCILIACAO-ESTORNO-VENDA-PRODUCAO.md",
  "AUDITORIA-V67-ESTORNO-PRODUCAO-ID-AUDITORIA-SEGURA.md",
  "tests/erp-business-rules.test.mjs",
  "tests/v56-weight-reversal.test.mjs",
  "tests/v57-reversal-audit.test.mjs",
  "tests/v59-pdf-reversal-stock-weight.test.mjs",
  "tests/v60-multiitem-reversal-reconciliation.test.mjs",
  "tests/v62-production-reports.test.mjs",
  "tests/v63-reversal-final-balance.test.mjs",
  "tests/v64-approved-alert-production-flow.test.mjs",
  "tests/v65-production-header-summary.test.mjs",
  "tests/v66-reversal-reconciliation-production.test.mjs",
  "tests/v67-production-reversal-integrity.test.mjs"
];


export const TRAINING_TRACKS = [
  { id:"rapido", title:"Início rápido", subtitle:"Visão geral em cerca de 12 minutos", icon:"▶", role:"dono", steps:["intro","login","navigation","dashboard-summary","import-intro","stock-kpis","sales-intro","alerts-approved","production-reconcile","sales-reversal","reports-main","audit-intro","finish"] },
  { id:"dono", title:"Administrador Master", subtitle:"Operação, regras, auditoria e segurança", icon:"◆", role:"dono", steps:"ALL" },
  { id:"gerente", title:"Gerente", subtitle:"Estoque, alertas, produção e relatórios", icon:"⚙", role:"gerente", chapters:["Começo","Painel","Importar PDF","Estoque","Vendas","Alertas","Produção","Joias","Clientes","Relatórios","Auditoria","Regras e acesso","Assistente interno","Conclusão"] },
  { id:"vendas", title:"Vendas e atendimento", subtitle:"Cliente, PDF, baixa e consulta comercial", icon:"✓", role:"vendedor", chapters:["Começo","Painel","Importar PDF","Vendas","Joias","Clientes","Relatórios","Assistente interno","Conclusão"] },
  { id:"estoque-producao", title:"Estoque e produção", subtitle:"Peças físicas, peso, lotes, faltas e produção", icon:"✦", role:"gerente", chapters:["Começo","Painel","Importar PDF","Estoque","Alertas","Produção","Relatórios","Auditoria","Conclusão"] },
  { id:"estornos", title:"Estornos e auditoria", subtitle:"Travas, justificativa, devolução e rastreabilidade", icon:"☷", role:"dono", steps:["intro","import-history","sales-reversal","production-reversal","audit-intro","audit-search","audit-details","finish"] },
  { id:"ar", title:"Realidade aumentada", subtitle:"Cadastro interno e visualização pública", icon:"◎", role:"dono", steps:["intro","ar-admin","ar-public","finish"] },
  { id:"completo", title:"Manual completo", subtitle:"Todas as 57 etapas do sistema", icon:"▤", role:"dono", steps:"ALL" }
];

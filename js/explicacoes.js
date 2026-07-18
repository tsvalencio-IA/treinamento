export const LESSON_DETAILS = {
  "intro": {
    "simple": "O Ateliê Digital organiza toda a operação de joias em áreas separadas e conectadas.",
    "user": "Use o menu para abrir Painel, Importar PDF, Estoque, Vendas, Alertas, Produção, Joias, Clientes, Relatórios, Auditoria e Regras.",
    "system": "Cada área mostra somente as informações e ações relacionadas àquela rotina.",
    "result": "Você consegue localizar rapidamente onde registrar uma entrada, uma venda, uma produção ou uma consulta.",
    "attention": "Antes de executar uma operação, confirme que está na área e no documento corretos.",
    "audit": "As operações que alteram dados registram o usuário, a data, a hora e o cargo responsável."
  },
  "login": {
    "simple": "Cada pessoa entra com seu próprio usuário. O cargo define quais telas e ações ela pode acessar.",
    "user": "No sistema oficial, informe e-mail e senha. Depois, confira o nome e o cargo exibidos no topo.",
    "system": "Valida a sessão, verifica se o usuário está ativo e aplica as permissões cadastradas para o cargo.",
    "result": "O usuário vê somente as funções permitidas para ele.",
    "attention": "Nunca compartilhe usuário e senha. A rastreabilidade depende de cada pessoa usar o próprio acesso.",
    "audit": "As ações posteriores ficam ligadas ao UID, nome, e-mail e cargo do usuário autenticado."
  },
  "navigation": {
    "simple": "O menu leva às áreas do sistema. Ele muda conforme o cargo do usuário.",
    "user": "Clique na área desejada: Painel, Importar PDF, Estoque, Vendas, Alertas, Produção, Relatórios ou Auditoria.",
    "system": "Abre a rota escolhida sem misturar dados de outras telas.",
    "result": "A pessoa chega direto à função que precisa executar.",
    "attention": "Quando uma opção não aparece, normalmente o cargo não possui permissão para ela.",
    "audit": "Apenas navegar não altera dados e não cria registro operacional."
  },
  "dashboard-summary": {
    "simple": "O Painel mostra a situação geral da operação naquele momento.",
    "user": "Leia os cartões de disponível, vendido, alertas e produtos abaixo do nível crítico.",
    "system": "Resume os registros carregados de produtos, peças físicas, vendas e alertas.",
    "result": "O gestor identifica rapidamente o que está normal e o que precisa de decisão.",
    "attention": "O Painel é um resumo. Para conferir um item específico, abra a tela correspondente.",
    "audit": "A consulta do Painel não modifica o banco."
  },
  "dashboard-kpis": {
    "simple": "Os cartões do Painel também funcionam como atalhos.",
    "user": "Clique no cartão relacionado ao assunto que deseja consultar.",
    "system": "Abre a tela correspondente já focada no tipo de informação escolhido.",
    "result": "Você economiza tempo e chega mais rápido ao detalhe.",
    "attention": "O número do cartão é um resumo; o detalhe completo fica na tela aberta.",
    "audit": "O clique de consulta não movimenta estoque."
  },
  "dashboard-actions": {
    "simple": "A rotina correta começa formando o estoque e depois registrando as saídas.",
    "user": "Primeiro importe o inventário. Depois importe vendas e trate as faltas nos Alertas.",
    "system": "Cria as peças do inventário, baixa somente o que existe e separa o que ficou pendente.",
    "result": "O fluxo mantém o estoque coerente e evita saldos negativos.",
    "attention": "Não inverta o fluxo tentando vender peças que ainda não foram registradas.",
    "audit": "Cada importação e cada baixa ficam registradas com usuário, data e hora."
  },
  "dashboard-alerts": {
    "simple": "Quando uma venda pede mais peças do que existem, o sistema cria uma pendência para o gestor.",
    "user": "Abra o alerta, confira o pedido e escolha a decisão adequada.",
    "system": "Mantém a parte faltante da venda pendente sem inventar estoque.",
    "result": "O gestor decide produzir, comprar, ajustar ou cancelar a necessidade.",
    "attention": "Alerta não é entrada de estoque e não é produção pronta.",
    "audit": "A criação e a decisão do alerta ficam registradas."
  },
  "import-intro": {
    "simple": "Antes de ler o PDF, diga ao sistema qual é a finalidade do documento.",
    "user": "Escolha Catálogo, Inventário, Pedido de produção, Produção pronta ou Venda.",
    "system": "Aplica uma lógica diferente conforme o tipo selecionado.",
    "result": "O mesmo PDF entra no fluxo correto e não movimenta a área errada.",
    "attention": "Escolher o tipo errado pode gerar uma operação diferente da pretendida.",
    "audit": "A importação registra o tipo escolhido e o responsável."
  },
  "import-file": {
    "simple": "Nesta etapa você escolhe o arquivo e identifica quem está realizando a operação.",
    "user": "Selecione o PDF, confira o tipo e o responsável antes de continuar.",
    "system": "Prepara o arquivo para leitura e tenta identificar cabeçalho, itens, quantidades, peso, material e medida.",
    "result": "Os dados extraídos ficam prontos para conferência.",
    "attention": "Ainda não confirme sem revisar os itens apresentados.",
    "audit": "O nome do arquivo e o usuário ficam ligados ao documento importado."
  },
  "import-extract": {
    "simple": "Extrair significa ler o PDF; ainda não significa gravar a operação.",
    "user": "Clique em Extrair PDF e confira a prévia linha por linha.",
    "system": "Interpreta o documento e mostra o que entendeu antes da confirmação.",
    "result": "Você consegue corrigir um problema antes de afetar estoque ou venda.",
    "attention": "Confirme código, medida, material, quantidade e peso total da linha.",
    "audit": "A gravação final ocorre somente na confirmação."
  },
  "import-progress": {
    "simple": "A barra de progresso mostra em qual parte da importação o sistema está.",
    "user": "Aguarde até a conclusão e observe se alguma etapa apresenta erro.",
    "system": "Processa documento, itens, fotos, estoque e auditoria em etapas.",
    "result": "Uma importação concluída aparece no histórico com seus vínculos.",
    "attention": "Não feche a página enquanto a operação estiver em andamento.",
    "audit": "Falhas e conclusões ficam identificadas no histórico."
  },
  "import-history": {
    "simple": "O histórico mostra cada PDF lançado e o estado atual dele.",
    "user": "Localize o documento pelo pedido ou nome do arquivo e abra seus detalhes.",
    "system": "Exibe o cabeçalho e os vínculos com itens, peças, vendas, lotes ou produção.",
    "result": "Você encontra a origem exata de uma movimentação.",
    "attention": "Estornar um documento não apaga o histórico; muda o estado e registra o motivo.",
    "audit": "Usuário, data, hora, cargo, motivo e impacto permanecem consultáveis."
  },
  "import-duplicate": {
    "simple": "O sistema evita que o mesmo documento seja lançado duas vezes.",
    "user": "Antes de confirmar, verifique se o pedido já aparece no histórico.",
    "system": "Compara pedido, arquivo e tipo da importação com registros existentes.",
    "result": "Uma duplicidade concluída é bloqueada.",
    "attention": "Não altere o número do pedido apenas para forçar uma nova importação.",
    "audit": "Tentativas e falhas podem ser analisadas sem criar saldo duplicado."
  },
  "stock-intro": {
    "simple": "A tela Estoque mostra o saldo por produto e também as peças físicas que formam esse saldo.",
    "user": "Pesquise pelo código, material ou medida do item.",
    "system": "Cruza produto, peça física, lote, estado e razão de peso.",
    "result": "Você vê o que realmente está disponível para uso ou venda.",
    "attention": "Não confunda produto cadastrado com peça disponível.",
    "audit": "Consultar estoque não altera nenhum registro."
  },
  "stock-kpis": {
    "simple": "Quantidade de peças e peso total são controles separados.",
    "user": "Confira os dois valores: quantidade disponível e peso disponível.",
    "system": "Mantém uma razão de quantidade e outra de peso, sem inventar peso individual.",
    "result": "Uma linha com várias peças pode ter um único peso total real.",
    "attention": "Peso total da linha não deve ser dividido automaticamente como se todas as peças fossem iguais.",
    "audit": "Entradas, saídas e estornos atualizam cada razão conforme a operação."
  },
  "stock-manual": {
    "simple": "Entrada manual serve para registrar peças que chegaram fora de um PDF de inventário.",
    "user": "Preencha código, descrição, material, medida, quantidade, peso total, lote e observação.",
    "system": "Cria ou atualiza o produto, cria lote, peças físicas e movimento de entrada.",
    "result": "As peças passam a aparecer como disponíveis no estoque.",
    "attention": "Informe o peso total real da entrada; não use um peso estimado como se fosse medido.",
    "audit": "A entrada guarda usuário, data, hora, cargo, origem e observação."
  },
  "stock-filters": {
    "simple": "Os filtros ajudam a localizar exatamente a variante correta do produto.",
    "user": "Digite código, descrição, material, medida, lote ou pedido.",
    "system": "Filtra somente os registros já carregados na tela.",
    "result": "Você reduz a lista até encontrar o SKU correto.",
    "attention": "Limpar filtros não apaga registros; apenas volta a mostrar todos.",
    "audit": "A pesquisa não gera movimentação."
  },
  "stock-rules": {
    "simple": "Cada produto pode ter limites para avisar quando o saldo está baixo.",
    "user": "Selecione os SKUs e informe mínimo, crítico, ideal e sugestão.",
    "system": "Salva os parâmetros e passa a usá-los nos alertas e relatórios.",
    "result": "O gestor recebe avisos antes de faltar mercadoria.",
    "attention": "Esses números não criam produção nem entrada automaticamente.",
    "audit": "A alteração das regras fica ligada ao usuário responsável."
  },
  "stock-physical": {
    "simple": "Cada unidade do estoque é uma peça física com estado próprio.",
    "user": "Abra Ver peças físicas e confira lote, origem e situação de cada unidade.",
    "system": "Mostra se a peça está disponível, vendida, reservada, consignada ou estornada.",
    "result": "Você consegue rastrear de onde veio e para onde foi cada peça.",
    "attention": "Não altere o estado de uma peça manualmente fora do fluxo correto.",
    "audit": "Os vínculos com venda, inventário e produção permanecem registrados."
  },
  "stock-reorder": {
    "simple": "Reposição sugerida é uma recomendação, não uma ordem automática.",
    "user": "Abra a lista e compare o saldo atual com o nível ideal.",
    "system": "Calcula a diferença usando os parâmetros do produto.",
    "result": "O gestor sabe quanto pode precisar repor.",
    "attention": "A recomendação deve ser analisada antes de qualquer decisão.",
    "audit": "Consultar a sugestão não muda o estoque."
  },
  "stock-operational-alerts": {
    "simple": "Os alertas do Estoque separam problemas diferentes para evitar decisões erradas.",
    "user": "Identifique se o aviso é de peso, saldo baixo ou falta de venda.",
    "system": "Direciona cada problema para a área correta.",
    "result": "O usuário trata a causa real sem misturar inventário, venda e produção.",
    "attention": "Leia o tipo do alerta antes de agir.",
    "audit": "A decisão tomada na área de destino fica registrada."
  },
  "sales-intro": {
    "simple": "Venda por PDF baixa somente as peças que realmente existem.",
    "user": "Importe o PDF de venda e confira os itens extraídos.",
    "system": "Procura peças compatíveis por código, descrição, material e medida.",
    "result": "O que existe é baixado; o que falta fica pendente e gera alerta.",
    "attention": "O sistema não deve criar estoque negativo para completar a venda.",
    "audit": "A venda registra pedido, cliente, vendedor, itens, usuário e origem."
  },
  "sales-check": {
    "simple": "Depois da importação, confirme se a venda ficou completa ou parcial.",
    "user": "Abra o card do pedido e confira solicitado, baixado, faltante e status.",
    "system": "Mantém cada linha com seus valores e vínculos.",
    "result": "Você sabe exatamente o que saiu e o que ainda falta atender.",
    "attention": "Uma venda parcial não deve ser tratada como totalmente concluída.",
    "audit": "O card preserva a origem do PDF e o histórico da operação."
  },
  "sales-manual": {
    "simple": "Venda manual é usada quando a operação não vem de um PDF.",
    "user": "Informe pedido, cliente, vendedor, pagamento e adicione os itens ao carrinho.",
    "system": "Valida disponibilidade antes de permitir o fechamento.",
    "result": "A venda baixa as peças selecionadas e cria o histórico.",
    "attention": "Revise o carrinho antes de fechar; depois do fechamento, correções exigem estorno.",
    "audit": "O fechamento registra usuário, data, hora, cargo e motivo quando exigido."
  },
  "sales-weight": {
    "simple": "O peso informado na venda é o peso total real daquele item vendido.",
    "user": "Digite o peso total medido para as peças daquela linha.",
    "system": "Compara o peso solicitado com a razão disponível.",
    "result": "A baixa de peso acompanha a operação sem inventar peso por unidade.",
    "attention": "Não informe peso unitário no campo destinado ao peso total.",
    "audit": "O peso debitado fica associado à venda e ao movimento."
  },
  "sales-cart": {
    "simple": "O carrinho é uma preparação; a baixa só acontece ao fechar a venda.",
    "user": "Adicione os itens, confira quantidades e clique em Fechar venda.",
    "system": "Valida as peças e grava a saída somente na confirmação final.",
    "result": "O estoque e o histórico são atualizados juntos pelo fluxo da venda.",
    "attention": "Limpar o carrinho antes de fechar não estorna nada porque ainda não houve baixa.",
    "audit": "O fechamento, não a simples inclusão no carrinho, cria a rastreabilidade operacional."
  },
  "sales-list": {
    "simple": "A lista de vendas reúne os pedidos já registrados.",
    "user": "Use os filtros e abra o card do pedido desejado.",
    "system": "Agrupa as linhas pelo pedido e mostra o status atual.",
    "result": "Você consulta cliente, itens, quantidade, peso e situação da venda.",
    "attention": "Vendas estornadas não devem aparecer como vendas ativas.",
    "audit": "O card permite chegar ao documento e aos registros relacionados."
  },
  "sales-reversal": {
    "simple": "Estornar venda devolve somente o que aquela venda realmente retirou.",
    "user": "Abra a venda, informe uma justificativa válida e confirme a frase de segurança.",
    "system": "Devolve peças e peso, marca as linhas como estornadas e corrige o cabeçalho do PDF.",
    "result": "O saldo retorna sem duplicar a devolução.",
    "attention": "Uma venda já estornada não pode ser estornada novamente.",
    "audit": "Ficam registrados usuário, data, hora, cargo, motivo e impacto."
  },
  "alerts-intro": {
    "simple": "Alertas mostram as peças que uma venda pediu, mas o estoque não tinha.",
    "user": "Abra o pedido e confira solicitado, baixado e faltante.",
    "system": "Agrupa a pendência sem apagar a venda.",
    "result": "O gestor enxerga exatamente o que precisa decidir.",
    "attention": "Não confunda a quantidade faltante com quantidade já produzida.",
    "audit": "O alerta guarda o vínculo com a venda e o PDF de origem."
  },
  "alerts-approved": {
    "simple": "Aprovar produção significa autorizar uma quantidade. Não cria uma ordem automática de produção.",
    "user": "No alerta, informe quanto foi autorizado para produzir.",
    "system": "Registra a decisão e mantém a venda aguardando a entrada da produção pronta.",
    "result": "A pendência fica pronta para ser atendida quando as peças chegarem.",
    "attention": "A autorização não aumenta o estoque naquele momento.",
    "audit": "A decisão do gestor, quantidade e usuário ficam registrados."
  },
  "alerts-queue": {
    "simple": "A fila de decisão reúne os alertas que ainda precisam de ação.",
    "user": "Analise um alerta por vez e escolha a decisão correta.",
    "system": "Atualiza o estado do alerta sem misturar pedidos diferentes.",
    "result": "A fila diminui conforme as decisões são concluídas.",
    "attention": "Evite aprovar uma quantidade sem conferir a necessidade real do pedido.",
    "audit": "Cada decisão permanece vinculada ao alerta original."
  },
  "production-intro": {
    "simple": "A tela Produção separa o que está pendente do que já ficou pronto.",
    "user": "Consulte a fila e use a entrada de produção somente quando as peças realmente chegarem.",
    "system": "Mantém demanda e entrada física como etapas diferentes.",
    "result": "O estoque só aumenta quando existe produção pronta registrada.",
    "attention": "Aprovação do gestor não é entrada de produção.",
    "audit": "Fila, entrada e atendimento da venda ficam rastreados separadamente."
  },
  "production-queue": {
    "simple": "A fila mostra necessidades pendentes que aguardam produção ou recebimento.",
    "user": "Confira produto, medida, quantidade e pedido relacionado.",
    "system": "Calcula a pendência com base nos alertas e vendas ainda não atendidas.",
    "result": "A equipe sabe o que precisa ser produzido.",
    "attention": "A fila não deve ser usada como prova de que a peça já existe.",
    "audit": "O vínculo com o alerta e a venda permanece disponível."
  },
  "production-form": {
    "simple": "Entrada de produção pronta registra peças que realmente ficaram disponíveis.",
    "user": "Informe produto, quantidade, peso total, lote e dados exigidos.",
    "system": "Cria peças físicas, lote e movimento de entrada.",
    "result": "As peças entram no estoque e podem atender vendas pendentes.",
    "attention": "Só dê entrada na quantidade realmente recebida.",
    "audit": "A entrada guarda responsável, data, hora, cargo e origem."
  },
  "production-weights": {
    "simple": "Quando existem pesos reais por peça, eles podem ser registrados individualmente.",
    "user": "Informe os pesos medidos conforme a produção recebida.",
    "system": "Valida a soma e relaciona os pesos às peças criadas.",
    "result": "O controle fica mais preciso quando a medição individual existe.",
    "attention": "Não invente pesos individuais apenas para preencher o formulário.",
    "audit": "Os valores ficam ligados à entrada e às peças correspondentes."
  },
  "production-groups": {
    "simple": "Grupos de peso ajudam quando várias peças do mesmo lote têm características semelhantes.",
    "user": "Organize as peças pelo lote ou grupo realmente recebido.",
    "system": "Mantém a quantidade física e o peso total do grupo.",
    "result": "A entrada fica organizada sem perder a origem.",
    "attention": "Agrupar não autoriza misturar medidas ou materiais diferentes.",
    "audit": "Lote e grupo permanecem ligados às peças."
  },
  "production-reconcile": {
    "simple": "Ao dar entrada, o sistema primeiro atende vendas pendentes e deixa o excedente no estoque.",
    "user": "Confirme a entrada da produção pronta.",
    "system": "Compara o recebido com as aprovações: usa o necessário na venda e mantém o restante disponível.",
    "result": "Exemplo: recebeu 20, a venda precisava de 10; 10 atendem a venda e 10 ficam no estoque.",
    "attention": "Isso não cria ordem de produção e não apaga o histórico da venda.",
    "audit": "O cabeçalho registra recebido, aplicado em vendas e excedente."
  },
  "production-history": {
    "simple": "O histórico mostra todas as entradas de produção já registradas.",
    "user": "Pesquise e abra a entrada que deseja conferir.",
    "system": "Exibe produto, quantidade, peso, lote, usuário e vínculos.",
    "result": "Você encontra a origem das peças produzidas.",
    "attention": "Abrir detalhes não altera a produção.",
    "audit": "O card permite consultar os registros relacionados."
  },
  "production-reversal": {
    "simple": "Estornar produção remove somente a entrada de produção escolhida.",
    "user": "Antes, estorne qualquer venda ou saída que use aquelas peças. Depois informe o motivo e confirme.",
    "system": "Bloqueia o estorno se houver peça vendida, reservada ou consignada; quando seguro, remove quantidade e peso daquela entrada.",
    "result": "Peças, lote e razão de peso voltam ao estado anterior.",
    "attention": "Não é permitido apagar produção que ainda sustenta uma saída ativa.",
    "audit": "O estorno registra cobertura, peso removido, usuário, cargo e justificativa."
  },
  "products-register": {
    "simple": "Cadastro técnico define como o produto será identificado no sistema.",
    "user": "Preencha código, descrição, tipo, material, medida e demais dados necessários.",
    "system": "Cria o SKU usado por estoque, venda, produção e relatórios.",
    "result": "As operações passam a reconhecer a variante correta.",
    "attention": "Medidas ou materiais diferentes devem permanecer em SKUs distintos.",
    "audit": "Alterações cadastrais podem ser identificadas pelo responsável."
  },
  "products-catalog": {
    "simple": "O catálogo reúne as referências de joias, mesmo quando ainda não existe estoque.",
    "user": "Pesquise pelo código e abra a variante desejada.",
    "system": "Mostra cadastro técnico, imagem e dados do produto.",
    "result": "Você consulta a referência sem confundir cadastro com saldo disponível.",
    "attention": "Produto no catálogo não significa peça física em estoque.",
    "audit": "A consulta não movimenta saldo."
  },
  "products-types": {
    "simple": "Tipos personalizados permitem organizar categorias de joias.",
    "user": "Cadastre ou edite um tipo quando a categoria realmente precisar existir.",
    "system": "Usa o tipo nos cadastros e filtros.",
    "result": "O catálogo fica padronizado.",
    "attention": "Evite criar nomes duplicados ou quase iguais.",
    "audit": "Mudanças de configuração devem ficar ligadas ao usuário."
  },
  "clients-register": {
    "simple": "O cadastro de cliente evita repetir dados soltos em cada venda.",
    "user": "Informe os dados do cliente e salve.",
    "system": "Cria ou atualiza a ficha usada nas operações comerciais.",
    "result": "Vendas e relatórios passam a referenciar o cliente correto.",
    "attention": "Revise documento e contato para não criar duplicidades.",
    "audit": "A ficha registra criação e atualizações."
  },
  "clients-list": {
    "simple": "A carteira reúne todos os clientes cadastrados.",
    "user": "Pesquise pelo nome, documento ou contato e abra a ficha.",
    "system": "Mostra os dados e vínculos disponíveis.",
    "result": "Você encontra rapidamente o cliente certo.",
    "attention": "Consultar a ficha não altera vendas.",
    "audit": "Operações comerciais continuam registradas nas áreas correspondentes."
  },
  "reports-main": {
    "simple": "Relatórios transformam os registros do sistema em uma visão para conferência e gestão.",
    "user": "Escolha o relatório, aplique os filtros e confira o período.",
    "system": "Monta o resultado usando os dados carregados de estoque e vendas.",
    "result": "Você obtém um resumo coerente com os registros ativos.",
    "attention": "Venda estornada não deve ser tratada como venda ativa.",
    "audit": "Gerar um relatório não movimenta estoque."
  },
  "reports-print": {
    "simple": "A opção de impressão permite salvar o relatório em PDF.",
    "user": "Abra o relatório, clique em imprimir e escolha Salvar como PDF no navegador.",
    "system": "Prepara a versão de impressão.",
    "result": "Você obtém um arquivo para compartilhar ou arquivar.",
    "attention": "Confira filtros e período antes de salvar.",
    "audit": "O PDF representa o estado consultado naquele momento."
  },
  "reports-backup": {
    "simple": "Backup é uma cópia dos dados para segurança; restauração é uma ação administrativa sensível.",
    "user": "Gere backup antes de mudanças importantes e guarde o arquivo em local seguro.",
    "system": "Exporta as coleções permitidas em um arquivo estruturado.",
    "result": "Existe uma cópia para conferência ou recuperação autorizada.",
    "attention": "Restaurar dados pode substituir informações. Só Administrador Master deve executar essa ação.",
    "audit": "A restauração deve ficar registrada com responsável e data."
  },
  "audit-intro": {
    "simple": "Auditoria responde: quem fez, quando fez, qual ação realizou e por quê.",
    "user": "Abra a Auditoria e localize o registro da operação.",
    "system": "Lista ações com usuário, e-mail, cargo, data, hora, coleção, documento e motivo.",
    "result": "Você consegue provar a origem de uma alteração.",
    "attention": "Auditoria não deve ser apagada junto com um estorno.",
    "audit": "O próprio registro é a trilha permanente da operação."
  },
  "audit-search": {
    "simple": "A busca da Auditoria ajuda a encontrar um evento específico.",
    "user": "Pesquise por pedido, usuário, ação, coleção ou justificativa.",
    "system": "Filtra os registros sem alterá-los.",
    "result": "Você chega ao evento correto com mais rapidez.",
    "attention": "Use termos objetivos, como número do pedido ou nome da ação.",
    "audit": "Exportar JSON cria uma cópia dos registros exibidos."
  },
  "audit-details": {
    "simple": "Ver detalhes mostra o impacto técnico e o documento relacionado.",
    "user": "Clique em Ver detalhes ou Abrir documento relacionado.",
    "system": "Abre um card na tela atual, com opção de fechar, sem levar o usuário ao topo da página.",
    "result": "Você confere antes, depois, motivo e vínculos da ação.",
    "attention": "Dados técnicos podem ser extensos; use o resumo para entender primeiro.",
    "audit": "O card não altera o registro; apenas apresenta a evidência."
  },
  "rules-main": {
    "simple": "Regras definem parâmetros usados pelo sistema para avisos e cálculos.",
    "user": "Revise os valores antes de editar.",
    "system": "Aplica as configurações nas telas e relatórios relacionados.",
    "result": "A operação passa a seguir os parâmetros definidos pela gestão.",
    "attention": "Uma regra incorreta pode afetar alertas e recomendações.",
    "audit": "Mudanças importantes devem identificar o responsável."
  },
  "rules-save": {
    "simple": "Salvar regras confirma que os novos parâmetros passam a valer.",
    "user": "Confira todos os campos e clique em salvar.",
    "system": "Grava as configurações e atualiza as telas que dependem delas.",
    "result": "Os novos limites ficam ativos.",
    "attention": "Não altere parâmetros apenas para esconder um alerta.",
    "audit": "A alteração deve registrar usuário, data e hora."
  },
  "roles": {
    "simple": "Cargos controlam o que cada pessoa pode ver e fazer.",
    "user": "Cadastre o usuário com o cargo correto e mantenha o acesso ativo somente enquanto necessário.",
    "system": "Libera ou bloqueia rotas e ações conforme as regras.",
    "result": "Cada colaborador trabalha somente nas áreas autorizadas.",
    "attention": "Não use cargo de Administrador Master para tarefas comuns.",
    "audit": "Ações ficam vinculadas ao cargo usado naquele momento."
  },
  "assistant": {
    "simple": "O assistente interno ajuda a consultar dados e entender algumas regras da operação.",
    "user": "Faça uma pergunta objetiva, citando produto, pedido, cliente ou função.",
    "system": "Procura nos dados carregados e nas explicações disponíveis.",
    "result": "Você recebe uma resposta de apoio para a consulta.",
    "attention": "O assistente não deve inventar fórmula ou dado que não existe.",
    "audit": "Consultas podem ser registradas conforme a configuração do sistema."
  },
  "ar-admin": {
    "simple": "A área de realidade aumentada cadastra os modelos 3D que serão compartilhados.",
    "user": "Cadastre o item, envie os arquivos compatíveis e ajuste apresentação e escala.",
    "system": "Salva os dados do modelo e gera um link público.",
    "result": "A joia pode ser aberta em uma visualização AR separada.",
    "attention": "Esse fluxo não altera o estoque nem a venda principal.",
    "audit": "O cadastro do modelo possui sua própria origem e responsável."
  },
  "ar-public": {
    "simple": "A página pública mostra o modelo 3D para o cliente.",
    "user": "Abra o link gerado em um aparelho compatível.",
    "system": "Carrega o modelo e oferece a visualização disponível no dispositivo.",
    "result": "O cliente visualiza a joia em 3D ou AR.",
    "attention": "A qualidade depende do modelo e dos recursos do aparelho.",
    "audit": "A visualização pública não movimenta estoque."
  },
  "finish": {
    "simple": "Você concluiu a trilha. Agora pode revisar uma etapa ou fazer uma pergunta.",
    "user": "Abra o Mapa completo para voltar a qualquer assunto.",
    "system": "Salva o ponto alcançado neste navegador.",
    "result": "O treinamento pode ser retomado sem começar do zero.",
    "attention": "Use o sistema oficial somente quando estiver seguro sobre a ação.",
    "audit": "O progresso do treinamento fica apenas neste navegador."
  }
};

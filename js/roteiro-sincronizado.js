/*
 * Roteiro audiovisual sincronizado do treinamento Glamore.
 * Cada cena liga uma frase curta a um único elemento real da tela.
 * O motor só muda o destaque depois que a frase anterior termina.
 */

export const SYNC_TARGETS = {
  intro: [
    { text: "O que tem, o que vendeu e o que precisa de decisão.", say: "Esta é a tela real de demonstração do Ateliê Digital. Durante o treinamento, somente o item citado pela narração ficará destacado." }
  ],
  login: [
    { text: "Acesso do sistema", say: "O acesso começa nesta área de login." },
    { text: "E-mail", say: "Primeiro, o usuário informa o próprio e-mail neste campo." },
    { text: "Senha", say: "Depois, informa a senha pessoal neste campo." },
    { text: "Entrar", say: "Por último, pressiona Entrar. O sistema valida o usuário e carrega somente as permissões do cargo dele.", click: true }
  ],
  navigation: [
    { selector: "nav.nav", label: "menu principal", say: "Este é o menu principal do sistema." },
    { text: "Painel", say: "Painel abre o resumo operacional." },
    { text: "Importar PDF", say: "Importar PDF abre os fluxos de catálogo, inventário, produção e venda." },
    { text: "Estoque", say: "Estoque abre a consulta de quantidades, peso, lotes e peças físicas." },
    { text: "Vendas", say: "Vendas abre pedidos, baixas e estornos." }
  ],
  "dashboard-summary": [
    { text: "O que tem, o que vendeu e o que precisa de decisão.", say: "O Painel reúne o estado atual da operação." },
    { text: "Disponível", say: "Disponível mostra quantas peças físicas estão livres para venda." },
    { text: "Vendido", say: "Vendido mostra as peças já baixadas em vendas ativas." },
    { text: "Alertas urgentes", say: "Alertas urgentes mostram faltas que precisam de decisão do gestor." },
    { text: "Abaixo do crítico", say: "Abaixo do crítico mostra produtos que chegaram ao limite de reposição." }
  ],
  "dashboard-kpis": [
    { text: "Disponível", say: "Clique em Disponível para ir diretamente ao estoque.", click: true },
    { text: "Vendido", say: "Clique em Vendido para consultar as vendas registradas.", click: true },
    { text: "Alertas urgentes", say: "Clique em Alertas urgentes para abrir as faltas pendentes.", click: true },
    { text: "Abaixo do crítico", say: "Clique em Abaixo do crítico para consultar a reposição preventiva.", click: true }
  ],
  "dashboard-actions": [
    { text: "Importar inventário", say: "Importar inventário é o primeiro passo para formar o estoque físico.", click: true },
    { text: "Importar venda", say: "Importar venda baixa somente as peças realmente disponíveis.", click: true },
    { text: "Consultar estoque", say: "Consultar estoque permite conferir código, material, medida, quantidade e peso.", click: true }
  ],
  "dashboard-alerts": [
    { text: "Alertas do gestor", say: "Aqui aparecem as faltas que aguardam uma decisão do gestor." },
    { text: "Reposição preventiva", say: "Reposição preventiva é uma sugestão baseada nos limites cadastrados. Ela não cria produção automaticamente." }
  ],
  "import-intro": [
    { text: "Escolha se o PDF entra como inventário ou venda.", say: "Antes de selecionar o arquivo, defina qual é a finalidade real do PDF." },
    { text: "Inventário / entrada de estoque", say: "Escolha Inventário quando o documento representa peças entrando no estoque." },
    { text: "Venda / baixa de estoque", say: "Escolha Venda quando o documento representa peças saindo do estoque." },
    { text: "Catálogo técnico / somente cadastro", say: "Escolha Catálogo quando deseja cadastrar referências sem criar saldo físico." },
    { text: "Produção pronta", say: "Escolha Produção pronta somente quando as peças produzidas realmente chegaram." }
  ],
  "import-file": [
    { text: "Arquivo PDF", say: "Selecione o arquivo PDF neste campo." },
    { text: "Tipo de importação", say: "Depois, confira o tipo da operação. Esse campo define toda a lógica que será executada." },
    { text: "Responsável", say: "Confira também o responsável. Esse dado fará parte da rastreabilidade da operação." }
  ],
  "import-extract": [
    { text: "Extrair PDF", say: "Pressione Extrair PDF para gerar a prévia. Nesta fase, a operação final ainda não foi confirmada.", click: true },
    { text: "Prévia da importação", say: "Na prévia, confira cabeçalho, itens, quantidades, peso, material, medida, lote e imagens antes de confirmar." }
  ],
  "import-progress": [
    { text: "PDFs lançados recentemente", say: "Depois da confirmação, o documento aparece nesta lista de lançamentos recentes." },
    { text: "Status", say: "O status informa se a importação foi concluída, falhou ou foi estornada." },
    { text: "Ver detalhes", say: "Ver detalhes abre o documento relacionado sem retirar o usuário da tela atual.", click: true }
  ],
  "import-history": [
    { text: "PDFs lançados recentemente", say: "O histórico preserva o vínculo do PDF com itens, peças, lotes, vendas, produção e auditoria." },
    { text: "Abrir documento", say: "Use Abrir documento para consultar o card completo daquela origem.", click: true },
    { text: "Estornar", say: "O botão de estorno usa a origem correta e nunca deve apagar o histórico técnico.", click: true }
  ],
  "import-duplicate": [
    { text: "PDFs lançados recentemente", say: "Antes de gravar, o sistema pesquisa documentos já existentes." },
    { text: "Número do pedido", say: "O número do pedido participa da verificação de duplicidade." },
    { text: "Arquivo", say: "O nome do arquivo e o tipo da importação também são comparados." }
  ],
  "stock-intro": [
    { text: "Consulte peças por código, material e medida.", say: "A tela Estoque reúne o saldo operacional por produto e por peça física." },
    { text: "Estoque disponível", say: "Este indicador mostra a quantidade de peças físicas livres." },
    { text: "Peso disponível", say: "Este indicador mostra o saldo de peso contábil disponível." }
  ],
  "stock-kpis": [
    { text: "Estoque disponível", say: "Quantidade disponível conta peças físicas." },
    { text: "Peso disponível", say: "Peso disponível controla gramas de forma independente da quantidade." },
    { text: "Peso vendido", say: "Peso vendido mostra o que já foi debitado pelas vendas." }
  ],
  "stock-manual": [
    { text: "Entrada manual rápida no estoque", say: "Esta área registra uma entrada manual no estoque." },
    { text: "Código", say: "Informe o código exato do produto neste campo." },
    { text: "Descrição", say: "Informe a descrição para identificar a joia." },
    { text: "Material", say: "Selecione o material correto. Produtos de materiais diferentes não podem ser misturados." },
    { text: "Medida", say: "Informe a medida correta. Cada medida forma uma variante operacional própria." },
    { text: "Quantidade", say: "Informe quantas peças físicas realmente entraram." },
    { text: "Peso total", say: "Informe o peso total da entrada. Não transforme esse valor em peso unitário sem medição real." },
    { text: "Lote", say: "Informe o lote para manter a origem das peças." },
    { text: "Responsável", say: "Confirme o responsável pela entrada." },
    { text: "Observação", say: "Use a observação para registrar uma informação operacional relevante." },
    { text: "Dar entrada", say: "Depois de conferir tudo, pressione Dar entrada. O sistema criará produto, lote, peças, movimento, peso e auditoria.", click: true }
  ],
  "stock-filters": [
    { text: "Busca geral", say: "A Busca geral pesquisa código, descrição, material, medida, lote e pedido." },
    { text: "Material", say: "Use o filtro Material para separar, por exemplo, Ouro dezoito quilates e Ouro dez quilates." },
    { text: "Medida", say: "Use o filtro Medida para localizar a variante correta." }
  ],
  "stock-rules": [
    { text: "Selecionar", say: "Primeiro, selecione os produtos que receberão a regra." },
    { text: "Estoque mínimo", say: "Mínimo é o nível que inicia o acompanhamento de reposição." },
    { text: "Estoque crítico", say: "Crítico indica que a situação exige atenção imediata." },
    { text: "Estoque ideal", say: "Ideal é o saldo desejado para aquele produto." },
    { text: "Aplicar aos selecionados", say: "Pressione Aplicar aos selecionados para salvar os parâmetros nos produtos escolhidos.", click: true }
  ],
  "stock-physical": [
    { text: "Ver peças físicas individuais", say: "Abra esta seção para consultar cada peça separadamente.", click: true },
    { text: "Status", say: "Cada peça possui um status próprio, como disponível, vendida, reservada, consignada ou estornada." },
    { text: "Abrir peça", say: "Abrir peça mostra o card completo e os vínculos daquela unidade.", click: true }
  ],
  "stock-reorder": [
    { text: "Ver reposição sugerida", say: "Abra a reposição sugerida para comparar o saldo atual com os parâmetros do produto.", click: true },
    { text: "Sugestão", say: "A quantidade sugerida é uma recomendação. Ela não altera o estoque e não cria produção sozinha." }
  ],
  "stock-operational-alerts": [
    { text: "Alertas operacionais", say: "Esta área reúne avisos que exigem conferência." },
    { text: "Peso", say: "Alertas de peso indicam diferença ou ausência de informação necessária." },
    { text: "Estoque mínimo", say: "Alertas de estoque mínimo indicam necessidade de reposição preventiva." },
    { text: "Falta em venda", say: "Alertas de falta em venda devem ser decididos pelo gestor." }
  ],
  "sales-intro": [
    { text: "Importar venda por PDF", say: "Use esta opção quando a venda chegou em um arquivo PDF.", click: true },
    { text: "Quantidade solicitada", say: "O sistema lê a quantidade solicitada pelo pedido." },
    { text: "Quantidade baixada", say: "Depois, baixa somente a quantidade que existe fisicamente." },
    { text: "Faltante", say: "A diferença fica registrada como faltante e gera alerta para o gestor." }
  ],
  "sales-check": [
    { text: "O que conferir depois", say: "Depois da importação, confira esta lista antes de considerar a venda correta." },
    { text: "Pedido", say: "Confira o número do pedido." },
    { text: "Cliente", say: "Confira o cliente vinculado." },
    { text: "Vendedor", say: "Confira o vendedor responsável." },
    { text: "Status", say: "Confira o status final da venda e as quantidades baixadas ou pendentes." }
  ],
  "sales-manual": [
    { text: "Venda manual no balcão", say: "Esta área cria uma venda manual usando um carrinho." },
    { text: "Pedido", say: "Informe o número ou a referência do pedido." },
    { text: "Cliente", say: "Selecione o cliente correto." },
    { text: "Vendedor", say: "Selecione o vendedor responsável." },
    { text: "Pagamento", say: "Informe a condição de pagamento quando aplicável." },
    { text: "Código", say: "Localize o produto pelo código." },
    { text: "Medida", say: "Confira a medida para não baixar outra variante." },
    { text: "Quantidade", say: "Informe quantas peças serão vendidas." },
    { text: "Adicionar", say: "Pressione Adicionar para colocar o item no carrinho. Isso ainda não fecha a venda.", click: true }
  ],
  "sales-weight": [
    { text: "Peso total real vendido", say: "Neste campo, informe o peso total real das peças vendidas neste item." },
    { text: "Peso disponível", say: "Antes da baixa, o sistema compara o peso informado com o saldo disponível." },
    { text: "Quantidade", say: "Quantidade e peso são validados separadamente." }
  ],
  "sales-cart": [
    { text: "Carrinho", say: "O carrinho reúne os itens ainda não fechados." },
    { text: "Limpar itens", say: "Limpar itens remove somente o carrinho ainda não finalizado.", click: true },
    { text: "Fechar venda", say: "Fechar venda executa a baixa real, grava os vínculos e cria a auditoria.", click: true }
  ],
  "sales-list": [
    { text: "Vendas registradas", say: "Nesta área, as linhas são agrupadas por pedido." },
    { text: "Busca geral", say: "Use a busca para localizar pedido, código ou cliente." },
    { text: "Status", say: "Use o filtro de status para separar vendas ativas, pendentes, finalizadas ou estornadas." },
    { text: "Ver detalhes", say: "Ver detalhes abre o card completo na tela atual.", click: true }
  ],
  "sales-reversal": [
    { text: "Estornar venda", say: "Use Estornar venda somente quando a operação realmente precisa ser desfeita.", click: true },
    { text: "Justificativa", say: "O sistema exige uma justificativa válida e identifica o usuário que solicitou o estorno." },
    { text: "Confirmar", say: "A confirmação final impede um estorno por clique acidental." },
    { text: "Auditoria", say: "Depois da conclusão, ficam registrados usuário, data, hora, cargo, motivo, peças e peso devolvidos." }
  ],
  "alerts-intro": [
    { text: "Faltas de venda por pedido.", say: "A tela Alertas organiza as faltas por pedido." },
    { text: "Solicitado", say: "Solicitado mostra o total pedido pelo cliente." },
    { text: "Baixado", say: "Baixado mostra o que o estoque conseguiu atender." },
    { text: "Faltante", say: "Faltante mostra o que ainda depende de decisão." }
  ],
  "alerts-approved": [
    { text: "Produção aprovada pendente", say: "Este campo mostra quanto o gestor autorizou produzir." },
    { text: "Produzir", say: "Ao escolher Produzir, o sistema registra uma decisão. Ele não cria uma ordem automática.", click: true },
    { text: "Quantidade aprovada", say: "Informe a quantidade realmente autorizada." },
    { text: "Confirmar decisão", say: "Confirme a decisão para mover a falta da análise do gestor para a espera de produção.", click: true }
  ],
  "alerts-queue": [
    { text: "Fila de decisão por pedido", say: "Cada card desta fila representa um pedido que precisa de decisão." },
    { text: "Produzir", say: "Produzir registra uma autorização." },
    { text: "Comprar", say: "Comprar registra que a reposição será adquirida." },
    { text: "Ajustar estoque", say: "Ajustar estoque indica que o saldo precisa ser conferido." },
    { text: "Cancelar", say: "Cancelar encerra a pendência conforme a justificativa informada." }
  ],
  "production-intro": [
    { text: "Entrada manual e fila de produção.", say: "A tela Produção separa o que está pendente do que realmente ficou pronto." },
    { text: "Fila de produção pendente", say: "A fila mostra demandas que ainda aguardam entrada." },
    { text: "Entrada de produção pronta", say: "A entrada pronta é o evento que cria as peças físicas e o peso no estoque." }
  ],
  "production-queue": [
    { text: "Fila de produção pendente", say: "Consulte aqui os itens que ainda aguardam produção." },
    { text: "Quantidade pendente", say: "Quantidade pendente mostra o que falta receber." },
    { text: "Pedido", say: "O vínculo com o pedido mantém a rastreabilidade da demanda." }
  ],
  "production-form": [
    { text: "Entrada de produção pronta", say: "Use este formulário somente quando as peças produzidas realmente estiverem prontas." },
    { text: "Código", say: "Informe o código do produto." },
    { text: "Material", say: "Selecione o material correto." },
    { text: "Medida", say: "Informe a medida correta." },
    { text: "Quantidade", say: "Informe a quantidade total recebida." },
    { text: "Peso total", say: "Informe o peso total real da produção recebida." },
    { text: "Lote", say: "Informe o lote da produção." },
    { text: "Pedido vinculado", say: "Vincule o pedido somente quando essa produção pertence a uma demanda específica." }
  ],
  "production-weights": [
    { text: "Pesos reais por peça", say: "Abra esta área quando existirem pesos individuais realmente medidos.", click: true },
    { text: "Peso individual", say: "Informe o peso individual apenas quando ele for conhecido de verdade." },
    { text: "Peso total", say: "Se não houver peso individual, mantenha somente o peso total da entrada." }
  ],
  "production-groups": [
    { text: "Entrada por grupos de peso/lote", say: "Use grupos quando uma mesma entrada possui lotes ou pesos diferentes." },
    { text: "Adicionar grupo", say: "Adicione um grupo para cada conjunto que precisa permanecer separado.", click: true },
    { text: "Quantidade", say: "Cada grupo registra sua própria quantidade." },
    { text: "Peso", say: "Cada grupo registra seu próprio peso total ou peso real conhecido." }
  ],
  "production-reconcile": [
    { text: "Dar entrada e reconciliar", say: "Este botão grava a produção pronta e procura vendas aprovadas que aguardam essas peças.", click: true },
    { text: "Baixada em vendas", say: "A quantidade necessária é aplicada às vendas pendentes." },
    { text: "Excedente em estoque", say: "O que exceder a necessidade das vendas permanece disponível no estoque." }
  ],
  "production-history": [
    { text: "Histórico de produção", say: "O histórico mostra cada entrada de produção." },
    { text: "Usuário", say: "Aqui aparece o usuário responsável pela ação." },
    { text: "Data", say: "Aqui aparece a data da entrada." },
    { text: "Hora", say: "Aqui aparece a hora da entrada." },
    { text: "Cargo", say: "Aqui aparece o cargo do usuário." },
    { text: "Ver detalhes", say: "Ver detalhes abre o card relacionado na tela atual.", click: true }
  ],
  "production-reversal": [
    { text: "Estornar entrada", say: "Use Estornar entrada para retirar uma produção que foi lançada incorretamente.", click: true },
    { text: "Peças vinculadas", say: "O sistema bloqueia o estorno enquanto existirem peças vendidas, reservadas ou consignadas." },
    { text: "Justificativa", say: "Depois de liberar os vínculos, informe a justificativa do estorno." },
    { text: "Confirmar", say: "Ao confirmar, o sistema estorna peças, lote, quantidade, peso, movimento e auditoria daquela produção." }
  ],
  "products-register": [
    { text: "Código", say: "O cadastro técnico começa pelo código." },
    { text: "Descrição", say: "A descrição identifica o modelo da joia." },
    { text: "Material", say: "Material separa as variantes por composição." },
    { text: "Medida", say: "Medida separa os tamanhos do mesmo modelo." },
    { text: "Tipo", say: "Tipo classifica o produto, por exemplo, anel, brinco ou corrente." },
    { text: "Salvar", say: "Pressione Salvar para registrar a referência técnica.", click: true }
  ],
  "products-catalog": [
    { text: "Catálogo técnico de joias", say: "O catálogo reúne as referências cadastradas." },
    { text: "Busca geral", say: "Use a busca para localizar código, descrição, material ou medida." },
    { text: "Abrir SKU", say: "Abrir SKU mostra o card técnico da variante escolhida.", click: true }
  ],
  "products-types": [
    { text: "Novo tipo", say: "Use Novo tipo para cadastrar uma categoria de joia que ainda não existe.", click: true },
    { text: "Nome", say: "Informe o nome do tipo." },
    { text: "Salvar tipo", say: "Salve o tipo para disponibilizá-lo nos cadastros técnicos.", click: true }
  ],
  "clients-register": [
    { text: "Cadastrar cliente", say: "Use esta área para incluir um cliente.", click: true },
    { text: "Nome", say: "Informe o nome ou a razão social." },
    { text: "CPF / CNPJ", say: "Informe o documento quando disponível." },
    { text: "Telefone", say: "Informe o telefone de contato." },
    { text: "Salvar cliente", say: "Depois da conferência, salve o cadastro.", click: true }
  ],
  "clients-list": [
    { text: "Carteira de clientes", say: "A carteira reúne todos os clientes cadastrados." },
    { text: "Busca geral", say: "Use a busca para localizar nome, documento ou telefone." },
    { text: "Ver detalhes", say: "Ver detalhes abre o card completo do cliente na tela atual.", click: true }
  ],
  "reports-main": [
    { text: "Gerar laudos e relatórios", say: "Nesta tela, escolha o relatório necessário." },
    { text: "Relatório de estoque", say: "Relatório de estoque mostra quantidades, peso e situação dos produtos." },
    { text: "Relatório de vendas", say: "Relatório de vendas mostra somente as vendas incluídas pelo filtro escolhido." },
    { text: "Gerar relatório", say: "Depois de configurar os filtros, gere o relatório.", click: true }
  ],
  "reports-print": [
    { text: "Imprimir / Salvar PDF", say: "Use este botão para abrir a impressão do navegador e salvar o relatório em PDF.", click: true },
    { text: "Usuário", say: "O relatório deve exibir o usuário responsável quando houver rastreabilidade." },
    { text: "Data", say: "O relatório deve exibir a data da ação relacionada." },
    { text: "Hora", say: "O relatório deve exibir a hora da ação relacionada." },
    { text: "Cargo", say: "O relatório deve exibir o cargo do usuário responsável." }
  ],
  "reports-backup": [
    { text: "Backup do banco de dados", say: "Use esta área para exportar uma cópia dos dados permitidos.", click: true },
    { text: "Baixar backup", say: "Baixar backup gera um arquivo para guarda segura.", click: true },
    { text: "Restaurar backup", say: "Restaurar backup é uma ação administrativa crítica e exige conferência completa antes da confirmação.", click: true }
  ],
  "audit-intro": [
    { text: "Auditoria da operação", say: "A Auditoria responde quem fez, quando fez, qual cargo possuía e qual documento foi afetado." },
    { text: "Usuário", say: "Usuário mostra o nome de quem executou a ação." },
    { text: "Data", say: "Data mostra o dia da operação." },
    { text: "Hora", say: "Hora mostra o horário da operação." },
    { text: "Função", say: "Função mostra o cargo do usuário naquele registro." },
    { text: "Documento/Pedido", say: "Documento ou pedido mantém o vínculo com o card original." }
  ],
  "audit-search": [
    { text: "Consultar auditoria", say: "Use esta área para pesquisar os registros." },
    { text: "Busca geral", say: "Pesquise por pedido, usuário, ação, coleção ou justificativa." },
    { text: "Exportar auditoria JSON", say: "Use Exportar auditoria JSON para gerar um arquivo técnico da consulta.", click: true }
  ],
  "audit-details": [
    { text: "Ver impacto e dados técnicos registrados", say: "Este botão abre o impacto técnico daquele registro.", click: true },
    { text: "Abrir documento relacionado", say: "Abrir documento relacionado leva ao card original sem sair da tela atual.", click: true },
    { text: "Fechar", say: "Use Fechar, o botão X, o fundo escuro ou a tecla Escape para encerrar o card.", click: true }
  ],
  "rules-main": [
    { text: "Regras da operação", say: "Esta área define parâmetros gerais do sistema." },
    { text: "Estoque mínimo", say: "Estoque mínimo inicia o acompanhamento de reposição." },
    { text: "Estoque crítico", say: "Estoque crítico indica urgência." },
    { text: "Estoque ideal", say: "Estoque ideal indica o saldo desejado." }
  ],
  "rules-save": [
    { text: "Salvar regras", say: "Depois da conferência, pressione Salvar regras.", click: true },
    { text: "Auditoria", say: "A alteração deve registrar usuário, data, hora, cargo e os valores anteriores e posteriores." }
  ],
  roles: [
    { text: "Fluxos protegidos", say: "As permissões protegem funções administrativas e operacionais." },
    { text: "Administrador Master", say: "Administrador Master possui acesso amplo à configuração e auditoria." },
    { text: "Gerente", say: "Gerente executa os fluxos administrativos autorizados." },
    { text: "Vendedor", say: "Vendedor visualiza e executa somente as rotinas comerciais permitidas." },
    { text: "Atendente", say: "Atendente recebe somente as funções liberadas para atendimento." },
    { text: "Entregador", say: "Entregador vê somente o fluxo destinado à entrega, quando habilitado." }
  ],
  assistant: [
    { text: "Pergunte sobre a operação", say: "Digite uma dúvida operacional neste campo." },
    { text: "Perguntar", say: "Pressione Perguntar para pesquisar a base de conhecimento do treinamento.", click: true },
    { text: "Fontes", say: "A resposta mostra as fontes técnicas utilizadas. Quando não houver evidência suficiente, o treinamento informa em vez de inventar." }
  ],
  "ar-admin": [
    { selector: "body", label: "administração de realidade aumentada", say: "Esta é a área administrativa dos modelos de realidade aumentada." },
    { text: "Upload", say: "O administrador envia os arquivos de modelo e a imagem de referência." },
    { text: "Link público", say: "Depois do cadastro, o sistema gera um link público para visualização." }
  ],
  "ar-public": [
    { selector: "body", label: "visualização pública em realidade aumentada", say: "Esta é a página pública de visualização da joia." },
    { text: "Ver em seu espaço", say: "Em aparelhos compatíveis, este botão inicia a experiência em realidade aumentada.", click: true },
    { text: "Modelo 3D", say: "O usuário também pode girar e aproximar o modelo tridimensional na própria página." }
  ],
  finish: [
    { selector: "main.main", label: "sistema completo", say: "Você concluiu esta trilha. Use o mapa para rever uma função específica ou a área Perguntar para consultar uma dúvida." }
  ]
};

export function synchronizedTargetsFor(step) {
  const configured = SYNC_TARGETS[step.id];
  if (Array.isArray(configured) && configured.length) return configured;
  return [{ ...(step.target || { selector: "main.main" }), say: "Observe o item destacado enquanto a explicação é narrada." }];
}

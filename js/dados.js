export const MENU = [
  {id:"dashboard",icon:"⌂",label:"Painel",sub:"Resumo do dia"},
  {id:"importacao",icon:"⇪",label:"Importar PDF",sub:"Inventário ou venda"},
  {id:"estoque",icon:"▦",label:"Estoque",sub:"Consulta operacional"},
  {id:"vendas",icon:"✓",label:"Vendas",sub:"Pedidos e baixas"},
  {id:"alertas",icon:"!",label:"Alertas",sub:"Decisões do gestor"},
  {id:"producao",icon:"✦",label:"Produção",sub:"Entrada manual"},
  {id:"joias",icon:"◇",label:"Joias",sub:"Catálogo técnico"},
  {id:"clientes",icon:"◎",label:"Clientes",sub:"Carteira"},
  {id:"relatorios",icon:"▤",label:"Relatórios",sub:"Resumo e PDF"},
  {id:"auditoria",icon:"☷",label:"Auditoria",sub:"Quem fez, quando e por quê"},
  {id:"regras",icon:"⚙",label:"Regras",sub:"Parâmetros"}
];

export const INITIAL_STATE = {
  stockA:{code:"2740AGL",measure:"18",material:"Ouro 18K",qty:3,weight:2.4},
  stockB:{code:"2740AGL",measure:"22",material:"Ouro 10K",qty:2,weight:1.5},
  normalSale:{active:false,reversed:false,qty:0,weight:0},
  partialSale:{active:false,reversed:false,requested:5,sold:0,missing:0},
  alert:{created:false,approved:false,approvedQty:0,resolved:false},
  production:{entered:false,reversed:false,qty:0,weightIn:0,weightOut:0,available:0,sold:0},
  inventory:{entered:false,reversed:false,status:"concluída"},
  pdfStatus:{pending:false,corrected:false},
  audit:[],
  screen:"dashboard"
};

export const LESSONS = [
  {
    id:"overview",chapter:"COMEÇANDO",icon:"1",title:"Conhecendo o sistema",
    description:"Entenda o menu, os perfis e onde cada rotina fica.",
    objective:"Saber onde abrir cada função antes de fazer qualquer lançamento.",
    scenes:[
      {screen:"dashboard",target:"screen-dashboard-title",text:"Este é o Painel. Ele resume estoque, vendas, alertas e produção pendente."},
      {screen:"dashboard",target:"menu-importacao",text:"Use Importar PDF para lançar inventário, catálogo, venda ou produção pronta."},
      {screen:"dashboard",target:"menu-estoque",text:"Use Estoque para consultar peças físicas, quantidades, pesos, lotes, entradas e baixas."},
      {screen:"dashboard",target:"menu-vendas",text:"Use Vendas para acompanhar pedidos, baixas, faltas e estornos."},
      {screen:"dashboard",target:"menu-alertas",text:"Use Alertas quando uma venda não encontra estoque suficiente e precisa de decisão do gestor."},
      {screen:"dashboard",target:"menu-producao",text:"Use Produção para lançar peças realmente prontas e consultar o histórico."},
      {screen:"dashboard",target:"menu-auditoria",text:"Use Auditoria para saber quem fez, quando fez, qual cargo executou e qual documento foi afetado."},
      {screen:"regras",target:"roles-card",text:"Administrador Master possui acesso completo. Gerente administra a operação. Vendedor e Atendente trabalham com clientes e vendas. Entregador possui consulta operacional."}
    ]
  },
  {
    id:"inventory",chapter:"ESTOQUE INICIAL",icon:"2",title:"Importando o inventário",
    description:"Cadastre as peças existentes sem inventar peso individual.",
    objective:"Registrar o estoque inicial e conferir peças, peso, lote e responsável.",
    reset:true,
    scenes:[
      {screen:"importacao",target:"import-file",text:"Em Arquivo PDF, escolha o documento de inventário que representa as peças existentes."},
      {screen:"importacao",target:"import-type",text:"Em Tipo de importação, selecione Estoque atual ou inventário."},
      {screen:"importacao",target:"import-owner",text:"Confira o responsável pelo lançamento. Essa informação ficará na rastreabilidade."},
      {screen:"importacao",target:"extract-button",text:"Clique em Extrair PDF para visualizar os itens antes de gravar.",click:true,action:"showInventoryPreview"},
      {screen:"importacao",target:"preview-table",text:"Confira código, descrição, material, medida, quantidade e peso total de cada linha."},
      {screen:"importacao",target:"weight-rule",text:"O peso do PDF é o peso total da linha. Quantidade e peso são controlados separadamente; o sistema não inventa um peso por peça."},
      {screen:"importacao",target:"confirm-import",text:"Depois da conferência, confirme a importação.",click:true,action:"confirmInventory"},
      {screen:"estoque",target:"stock-kpis",text:"O estoque agora mostra cinco peças físicas e peso total de três vírgula nove gramas."},
      {screen:"estoque",target:"stock-row-a",text:"Abra o item de medida dezoito para conferir quantidade, peso, lote, usuário, data, hora e cargo.",click:true,action:"openStockA"},
      {screen:"estoque",target:"stock-detail",text:"O card mostra a entrada original e permite abrir o documento relacionado sem perder a posição da tela."}
    ]
  },
  {
    id:"manual-stock",chapter:"ENTRADA MANUAL",icon:"3",title:"Entrada rápida no estoque",
    description:"Lance uma entrada autorizada quando não houver PDF.",
    objective:"Registrar quantidade e peso total com lote e justificativa.",
    scenes:[
      {screen:"estoque",target:"manual-entry-summary",text:"Abra Entrada manual rápida no estoque."},
      {screen:"estoque",target:"manual-code",text:"Informe o código da joia."},
      {screen:"estoque",target:"manual-material",text:"Selecione o material correto."},
      {screen:"estoque",target:"manual-measure",text:"Informe a medida."},
      {screen:"estoque",target:"manual-qty",text:"Digite a quantidade real de peças recebidas."},
      {screen:"estoque",target:"manual-weight",text:"Informe o peso total da entrada, sem dividir automaticamente por peça."},
      {screen:"estoque",target:"manual-lot",text:"Preencha o lote para manter a rastreabilidade."},
      {screen:"estoque",target:"manual-save",text:"Confira os dados e confirme a entrada. O movimento ficará ligado ao usuário, data, hora e cargo.",click:true,action:"manualEntryDemo"}
    ]
  },
  {
    id:"normal-sale",chapter:"VENDA",icon:"4",title:"Importando uma venda",
    description:"Baixe somente as peças físicas disponíveis e confira o resultado.",
    objective:"Registrar uma venda por PDF e conferir a baixa no estoque.",
    scenes:[
      {screen:"importacao",target:"import-file",text:"Escolha o PDF da venda."},
      {screen:"importacao",target:"import-type",text:"Selecione Venda inteligente."},
      {screen:"importacao",target:"import-owner",text:"Confira vendedor ou responsável."},
      {screen:"importacao",target:"extract-button",text:"Extraia o PDF para revisar o pedido.",click:true,action:"showSalePreview"},
      {screen:"importacao",target:"sale-preview",text:"Confira cliente, código, material, medida, quantidade solicitada e peso de referência."},
      {screen:"importacao",target:"confirm-import",text:"Confirme a venda.",click:true,action:"confirmNormalSale"},
      {screen:"vendas",target:"normal-sale-card",text:"A venda aparece no histórico com cliente, vendedor, quantidade, status e ações."},
      {screen:"estoque",target:"stock-movement-sale",text:"Em Estoque, a baixa mostra quantidade, peso, usuário, data, hora, cargo e o documento da venda."},
      {screen:"auditoria",target:"audit-sale",text:"Na Auditoria, abra o registro da venda para conferir o impacto e o documento relacionado."}
    ]
  },
  {
    id:"partial-sale",chapter:"FALTA DE ESTOQUE",icon:"5",title:"Venda parcial e alerta",
    description:"Veja o que acontece quando o pedido é maior que o saldo real.",
    objective:"Evitar estoque negativo e encaminhar a falta para decisão do gestor.",
    reset:true,
    scenes:[
      {screen:"estoque",target:"stock-kpis",text:"Antes da venda, existem cinco peças físicas disponíveis."},
      {screen:"importacao",target:"partial-preview",text:"O novo pedido solicita cinco peças, mas uma delas não está disponível no SKU correto."},
      {screen:"importacao",target:"confirm-import",text:"Confirme a venda. O sistema baixará somente o que realmente existe.",click:true,action:"confirmPartialSale"},
      {screen:"vendas",target:"partial-sale-card",text:"A venda mostra quatro peças baixadas e uma peça faltante."},
      {screen:"vendas",target:"partial-status",text:"O status permanece parcial. O estoque não fica negativo."},
      {screen:"alertas",target:"alert-card",text:"A peça faltante cria um alerta para o gestor decidir o que fazer."},
      {screen:"alertas",target:"alert-decisions",text:"O gestor pode aprovar produção, comprar, ajustar ou cancelar. A decisão deve ser real e rastreável."},
      {screen:"alertas",target:"approve-production",text:"Aprovar produção não coloca peças no estoque. Apenas registra a quantidade autorizada.",click:true,action:"approveOneProduction"}
    ]
  },
  {
    id:"production-flow",chapter:"PRODUÇÃO",icon:"6",title:"Produção aprovada e produção pronta",
    description:"Acompanhe o caso real: vender 10, produzir 20, atender 10 e manter 10 no estoque.",
    objective:"Entender aprovação, recebimento, atendimento da venda e excedente.",
    resetProduction:true,
    scenes:[
      {screen:"vendas",target:"production-sale-pending",text:"Esta venda precisa de dez peças e permanece pendente porque não havia estoque."},
      {screen:"alertas",target:"production-alert",text:"O alerta mostra a falta de dez peças e aguarda decisão do gestor."},
      {screen:"alertas",target:"approve-20",text:"O gestor informa que serão produzidas vinte peças.",click:true,action:"approveTwenty"},
      {screen:"alertas",target:"approved-not-order",text:"A aprovação registra a decisão. Ela não cria estoque e não é uma ordem automática de produção."},
      {screen:"producao",target:"prod-code",text:"Quando as peças estiverem realmente prontas, abra Produção e informe o produto."},
      {screen:"producao",target:"prod-qty",text:"Informe as vinte peças realmente recebidas."},
      {screen:"producao",target:"prod-weight",text:"Informe o peso total real da produção: dezesseis vírgula quatro gramas."},
      {screen:"producao",target:"prod-lot",text:"Informe o lote recebido."},
      {screen:"producao",target:"prod-submit",text:"Confirme Dar entrada e reconciliar.",click:true,action:"receiveTwenty"},
      {screen:"producao",target:"production-result",text:"O resultado mostra vinte recebidas, dez aplicadas à venda e dez disponíveis no estoque."},
      {screen:"vendas",target:"production-sale-final",text:"A venda foi completada com dez peças e não possui mais quantidade pendente."},
      {screen:"estoque",target:"production-stock-result",text:"As dez peças excedentes permanecem disponíveis no estoque. O peso de entrada é dezesseis vírgula quatro; oito vírgula dois foram para a venda e oito vírgula dois permanecem disponíveis."},
      {screen:"auditoria",target:"audit-production",text:"A Auditoria liga aprovação, entrada de produção, atendimento da venda e excedente ao usuário, data, hora, cargo e documentos."}
    ]
  },
  {
    id:"catalog-clients",chapter:"CADASTROS",icon:"7",title:"Joias, clientes e realidade aumentada",
    description:"Consulte o catálogo técnico e a carteira de clientes.",
    objective:"Saber onde cadastrar e consultar informações comerciais sem misturar com o estoque.",
    scenes:[
      {screen:"joias",target:"jewel-search",text:"Em Joias, pesquise pelo código para consultar descrição, material, medida, imagem e dados técnicos."},
      {screen:"joias",target:"catalog-rule",text:"Cadastrar uma joia no catálogo não cria peça física no estoque."},
      {screen:"joias",target:"ar-button",text:"Quando houver modelo compatível, use Realidade aumentada para abrir a visualização pública da joia."},
      {screen:"clientes",target:"client-search",text:"Em Clientes, pesquise por nome, documento ou telefone."},
      {screen:"clientes",target:"client-card",text:"O card reúne dados do cliente e o histórico comercial permitido ao perfil."},
      {screen:"regras",target:"roles-card",text:"As funções controlam o que cada usuário pode consultar ou alterar."}
    ]
  },
  {
    id:"reports-audit",chapter:"CONFERÊNCIA",icon:"8",title:"Relatórios, backup e Auditoria",
    description:"Confira saldos, vendas ativas, rastreabilidade e documentos.",
    objective:"Saber provar o que aconteceu em cada operação.",
    scenes:[
      {screen:"relatorios",target:"stock-report-button",text:"Gere o relatório de estoque para conferir produtos, quantidades, pesos e lotes."},
      {screen:"relatorios",target:"sales-report-button",text:"Gere o relatório de vendas para consultar somente as vendas ativas."},
      {screen:"relatorios",target:"report-mode",text:"Use Resumo para impressão compacta ou Detalhado para visualizar peça física por peça física."},
      {screen:"relatorios",target:"backup-button",text:"Use Backup para exportar uma cópia da operação. O arquivo não contém senha de usuário."},
      {screen:"auditoria",target:"audit-search",text:"Na Auditoria, pesquise por pedido, usuário, ação, coleção ou justificativa."},
      {screen:"auditoria",target:"audit-user-fields",text:"Cada registro mostra usuário, e-mail, função ou cargo, data, hora, status, coleção e documento."},
      {screen:"auditoria",target:"audit-open-document",text:"Clique em Abrir documento relacionado para visualizar o card original na tela atual.",click:true,action:"openAuditDocument"}
    ]
  },
  {
    id:"reversals",chapter:"ESTORNOS",icon:"9",title:"Estornos na ordem correta",
    description:"Venda, inventário, status do PDF e produção sem duplicar movimentações.",
    objective:"Corrigir operações mantendo quantidade, peso, documentos e Auditoria coerentes.",
    reset:true,
    resetProduction:true,
    scenes:[
      {screen:"estoque",target:"inventory-reverse-button",text:"Um inventário não pode ser estornado enquanto suas peças estiverem ligadas a vendas ou consignações.",click:true,action:"tryInventoryReverseBlocked"},
      {screen:"estoque",target:"blocked-message",text:"A mensagem orienta estornar primeiro as saídas vinculadas. Nenhuma peça é alterada por essa tentativa."},
      {screen:"vendas",target:"reverse-sale-button",text:"Abra a venda e clique em Estornar venda.",click:true,action:"reverseSale"},
      {screen:"vendas",target:"reverse-reason",text:"Informe uma justificativa verdadeira. O usuário, a data, a hora, o cargo e o impacto ficam registrados."},
      {screen:"estoque",target:"returned-stock",text:"As peças e o peso baixados pela venda voltam ao estoque."},
      {screen:"estoque",target:"inventory-reverse-button",text:"Agora o inventário pode ser estornado porque não existem saídas ativas ligadas a ele.",click:true,action:"reverseInventory"},
      {screen:"estoque",target:"inventory-zero",text:"As cinco peças e o peso do inventário foram removidos. O saldo daquele inventário ficou zero."},
      {screen:"importacao",target:"fix-pdf-status",text:"Corrigir status do PDF é usado somente quando a venda já foi estornada, mas o documento antigo permaneceu ativo.",click:true,action:"fixPdfStatus"},
      {screen:"importacao",target:"fix-status-result",text:"Essa correção altera apenas o status do documento. Não movimenta peças, quantidade, peso, lote ou saldo."},
      {screen:"producao",target:"production-reverse-button",text:"A entrada de produção não pode ser estornada enquanto existirem peças vendidas ligadas a ela.",click:true,action:"tryProductionReverseBlocked"},
      {screen:"vendas",target:"reverse-production-sale",text:"Estorne primeiro a venda atendida pela produção.",click:true,action:"reverseProductionSale"},
      {screen:"producao",target:"production-reverse-button",text:"Depois que as peças voltarem, estorne a entrada de produção.",click:true,action:"reverseProduction"},
      {screen:"producao",target:"production-zero",text:"As vinte peças, o lote e o peso daquela produção foram zerados, sem afetar outras origens."},
      {screen:"auditoria",target:"audit-reversals",text:"A Auditoria preserva todos os estornos, justificativas, usuários, datas, horas, cargos e documentos relacionados."}
    ]
  },
  {
    id:"rules-users",chapter:"ADMINISTRAÇÃO",icon:"10",title:"Usuários, cargos e regras",
    description:"Configure acessos sem entregar permissões indevidas.",
    objective:"Entender o papel de cada perfil e os parâmetros administrativos.",
    scenes:[
      {screen:"regras",target:"roles-card",text:"Administrador Master possui acesso administrativo completo."},
      {screen:"regras",target:"manager-role",text:"Gerente administra operação, colaboradores, relatórios e regras."},
      {screen:"regras",target:"seller-role",text:"Vendedor trabalha com joias, clientes, vendas, consignações e relatórios comerciais."},
      {screen:"regras",target:"attendant-role",text:"Atendente trabalha com atendimento, clientes, vendas e consignações."},
      {screen:"regras",target:"delivery-role",text:"Entregador possui consulta operacional e acompanhamento de entregas ou consignações."},
      {screen:"regras",target:"user-form",text:"Ao cadastrar um colaborador, informe nome, e-mail, função, cargo interno e se o usuário está ativo."},
      {screen:"regras",target:"owner-restriction",text:"Somente o Administrador Master atual pode cadastrar outro Administrador Master."}
    ]
  }
];

export const FAQ = [
  {id:"weight",question:"Quantidade e peso são independentes?",keywords:["quantidade peso","peso independente","peso total","peso por peça"],answer:"Sim. A quantidade física e o peso são controlados em razões separadas. No PDF, o campo Peso representa o peso total da linha. O sistema não deve inventar peso individual quando ele não foi informado."},
  {id:"negative",question:"O estoque pode ficar negativo?",keywords:["estoque negativo","falta estoque","sem saldo"],answer:"Não. Uma venda baixa somente as peças físicas realmente disponíveis. O que faltar permanece pendente e cria um alerta para decisão do gestor."},
  {id:"alert",question:"O que acontece quando falta peça em uma venda?",keywords:["falta peça","venda parcial","alerta gestor"],answer:"A parte disponível é baixada. A quantidade faltante fica registrada na venda e cria um alerta. O gestor decide produzir, comprar, ajustar ou cancelar."},
  {id:"approval",question:"Aprovar produção cria uma ordem de produção?",keywords:["aprovar produção","ordem produção","produção aprovada"],answer:"Não. A aprovação registra a decisão e a quantidade autorizada. Ela não cria estoque e não é uma ordem automática de produção. O estoque aumenta somente quando a produção pronta é realmente lançada."},
  {id:"20-10",question:"Como funciona produzir 20 para uma venda de 10?",keywords:["produzir 20","venda 10","excedente estoque"],answer:"Quando as 20 peças prontas são lançadas, 10 atendem a venda pendente e as outras 10 permanecem disponíveis no estoque. Quantidade e peso são reconciliados separadamente."},
  {id:"inventory-block",question:"Por que não consigo estornar um inventário?",keywords:["estornar inventário","inventário bloqueado","saídas vinculadas"],answer:"Porque existem peças daquele inventário ligadas a vendas ou consignações ativas. Primeiro estorne as saídas vinculadas. Depois o inventário poderá ser estornado."},
  {id:"sale-reversal",question:"O que o estorno de venda devolve?",keywords:["estorno venda","devolve peças","devolve peso"],answer:"Ele devolve ao estoque as peças e o peso efetivamente baixados pela venda, marca a venda e o PDF como estornados quando aplicável e registra a justificativa na Auditoria."},
  {id:"pdf-status",question:"O que faz Corrigir status do PDF?",keywords:["corrigir status pdf","reconciliar estorno","pdf pendente"],answer:"Corrige somente um documento antigo cuja venda já foi estornada. Não movimenta peças, quantidade, peso, lote ou saldo novamente."},
  {id:"prod-reversal",question:"Como estornar uma produção?",keywords:["estornar produção","produção bloqueada","entrada produção"],answer:"Primeiro estorne as vendas ligadas àquela produção. Depois estorne a entrada da produção. O sistema remove somente as peças, o lote e o peso daquela origem."},
  {id:"audit",question:"Onde vejo quem fez cada ação?",keywords:["quem fez","usuário data hora cargo","auditoria"],answer:"Na Auditoria e nos cards rastreáveis. O registro mostra usuário, e-mail, função ou cargo, data, hora, status, coleção, documento, justificativa e impacto."},
  {id:"reports",question:"Venda estornada aparece no relatório de vendas ativas?",keywords:["relatório vendas","venda estornada relatório","vendas ativas"],answer:"Não. O relatório de vendas ativas exclui vendas estornadas. O histórico e a Auditoria preservam o registro da operação e do estorno."},
  {id:"catalog",question:"Cadastrar uma joia cria estoque?",keywords:["catálogo cria estoque","cadastrar joia","joias estoque"],answer:"Não. O cadastro técnico da joia não cria peça física. O estoque nasce por inventário, entrada manual ou produção pronta."},
  {id:"roles",question:"O que cada perfil pode fazer?",keywords:["perfis","cargos","administrador gerente vendedor atendente entregador"],answer:"Administrador Master tem acesso completo. Gerente administra a operação. Vendedor atua em joias, clientes e vendas. Atendente atua em atendimento e vendas. Entregador possui consulta operacional e acompanhamento de entregas."}
];
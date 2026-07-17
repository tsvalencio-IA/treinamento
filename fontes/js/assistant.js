import { criticalProducts, stoppedProducts } from "./reports.js";
import { escapeHtml, formatCurrency, formatDate, formatNumber, objectToArray, sum } from "./utils.js";

const CODE_REGEX = /\b((?:[A-Z]{2,6}\d{3,}[A-Z0-9]*|\d{3,}\s*[A-Z]{2,6}[A-Z0-9]*))\b/i;

function normalizar(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function extractCode(question = "") {
  const match = String(question).toUpperCase().match(CODE_REGEX);
  return match ? String(match[1]).replace(/\s+/g, "").toUpperCase() : "";
}

function extractMedida(question = "") {
  const text = normalizar(question);
  const medida =
    text.match(/\bMEDIDA\s*(\d{1,2})\b/) ||
    text.match(/\bTAMANHO\s*(\d{1,2})\b/) ||
    text.match(/\bN[°ºO]?\s*(\d{1,2})\b/) ||
    text.match(/\bNUMERO\s*(\d{1,2})\b/);
  return medida ? medida[1] : "";
}

function sameMedida(value = "", query = "") {
  const a = String(value || "").replace(/^0+(?=\d)/, "");
  const b = String(query || "").replace(/^0+(?=\d)/, "");
  return a === b;
}

function extractSearchAfter(words, question = "") {
  const text = String(question);
  for (const word of words) {
    const rx = new RegExp(`${word}\\s+([\\wÀ-ÿ .'-]{2,70})`, "i");
    const match = text.match(rx);
    if (match) return match[1].replace(/[?.!,;:]+$/g, "").trim();
  }
  return "";
}

function containsAny(text, words = []) {
  const t = normalizar(text);
  return words.some((word) => t.includes(normalizar(word)));
}

function includesNormalized(value = "", query = "") {
  if (!query) return true;
  return normalizar(value).includes(normalizar(query));
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item) || "Não informado";
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

function limitRows(rows = [], max = 30) {
  return rows.slice(0, max);
}

function formatLotLine(item) {
  return `• Lote ${item.lote || item.id || "-"} · ${item.codigo || ""} · medida ${item.medida || "-"} · ${item.material || "-"} — disponível no lote: ${formatNumber(item.quantidadeDisponivel ?? item.quantidadeEntrada ?? 0, 0)} peça(s), peso unitário: ${formatNumber(item.pesoUnitario || 0, 3)} g.`;
}

function formatProductLine(item) {
  const estoqueMinimo = Number(item.estoqueMinimo || 0);
  const disponivel = Number(item.estoqueDisponivel || 0);
  const falta = Math.max(0, estoqueMinimo - disponivel);
  const alerta = falta > 0 ? ` · falta produzir: ${formatNumber(falta, 0)}` : "";
  return `• ${item.codigo || ""} · ${item.tipo || "Joia"} · medida ${item.medida || "-"} · ${item.material || "-"} — disponível: ${formatNumber(disponivel, 0)}, consignado: ${formatNumber(item.estoqueConsignado || 0, 0)}, vendido: ${formatNumber(item.estoqueVendido || 0, 0)}${alerta}.`;
}


function formatPhysicalPieceLine(item) {
  const peso = Number(item.pesoReal || item.pesoUnitario || 0);
  const pesoPedido = Number(item.pesoPedido || item.pesoPrevisto || 0);
  const diff = pesoPedido ? ` · diferença: ${formatNumber((item.diferencaPeso ?? (peso - pesoPedido)), 3)} g` : "";
  return `• ${item.pecaCodigo || item.id || "Peça"} · ${item.codigo || ""} · medida ${item.medida || "-"} · ${item.material || "-"} · lote ${item.lote || item.loteCodigo || "-"} — status: ${item.status || "disponivel"} · peso real: ${formatNumber(peso, 3)} g${diff}.`;
}

function filterPhysicalPieces(data, question) {
  const codigo = extractCode(question);
  const medida = extractMedida(question);
  const text = normalizar(question);

  let pecas = objectToArray(data.pecasEstoque).filter((item) => !["SUBSTITUIDA_POR_INVENTARIO", "CANCELADA", "EXCLUIDA"].includes(normalizar(item.status)));
  if (codigo) pecas = pecas.filter((item) => String(item.codigo || "").toUpperCase() === codigo);
  if (medida) pecas = pecas.filter((item) => sameMedida(item.medida, medida));
  if (text.includes("PRATA")) pecas = pecas.filter((item) => normalizar(item.material).includes("PRATA"));
  if (text.includes("10K")) pecas = pecas.filter((item) => normalizar(item.material).includes("10K") || normalizar(item.descricao).includes("10K"));
  if (text.includes("18K")) pecas = pecas.filter((item) => normalizar(item.material).includes("18K") || normalizar(item.descricao).includes("18K"));
  if (text.includes("OURO")) pecas = pecas.filter((item) => normalizar(item.material).includes("OURO") || normalizar(item.descricao).includes("OURO"));
  return pecas;
}

function physicalPieceSummary(pecas = []) {
  const disponiveis = pecas.filter((item) => normalizar(item.status || "disponivel") === "DISPONIVEL");
  const consignadas = pecas.filter((item) => normalizar(item.status) === "CONSIGNADO");
  const vendidas = pecas.filter((item) => normalizar(item.status) === "VENDIDO");
  return {
    disponivel: disponiveis.length,
    consignado: consignadas.length,
    vendido: vendidas.length,
    pesoDisponivel: sum(disponiveis, (item) => item.pesoReal || item.pesoUnitario || 0),
    lotes: [...new Set(pecas.map((item) => item.lote || item.loteCodigo).filter(Boolean))]
  };
}

function salesSummary(vendas = []) {
  return {
    quantidade: sum(vendas, (item) => item.quantidade),
    peso: sum(vendas, (item) => item.pesoTotal || item.peso),
    valor: sum(vendas, (item) => item.valorTotal),
    clientes: [...new Set(vendas.map((item) => item.cliente).filter(Boolean))],
    vendedores: [...new Set(vendas.map((item) => item.vendedor).filter(Boolean))]
  };
}

function filterProducts(data, question) {
  const codigo = extractCode(question);
  const medida = extractMedida(question);
  const text = normalizar(question);

  let produtos = objectToArray(data.produtos);
  if (codigo) produtos = produtos.filter((item) => String(item.codigo || "").toUpperCase() === codigo);
  if (medida) produtos = produtos.filter((item) => sameMedida(item.medida, medida));
  if (text.includes("ANEL")) produtos = produtos.filter((item) => normalizar(`${item.tipo} ${item.descricao}`).includes("ANEL"));
  if (text.includes("ALIANCA")) produtos = produtos.filter((item) => normalizar(`${item.tipo} ${item.descricao}`).includes("ALIANCA"));
  if (text.includes("BRINCO")) produtos = produtos.filter((item) => normalizar(`${item.tipo} ${item.descricao}`).includes("BRINCO"));
  if (text.includes("CORRENTE")) produtos = produtos.filter((item) => normalizar(`${item.tipo} ${item.descricao}`).includes("CORRENTE"));
  if (text.includes("PRATA")) produtos = produtos.filter((item) => normalizar(item.material).includes("PRATA"));
  if (text.includes("OURO")) produtos = produtos.filter((item) => normalizar(item.material).includes("OURO") || normalizar(item.descricao).includes("OURO"));
  if (text.includes("10K")) produtos = produtos.filter((item) => normalizar(item.material).includes("10K") || normalizar(item.descricao).includes("10K"));
  if (text.includes("18K")) produtos = produtos.filter((item) => normalizar(item.material).includes("18K") || normalizar(item.descricao).includes("18K"));
  return produtos;
}

function filterSales(data, question) {
  const codigo = extractCode(question);
  const medida = extractMedida(question);
  const cliente = normalizar(extractSearchAfter(["cliente", "do cliente", "da cliente"], question));
  const vendedor = normalizar(extractSearchAfter(["vendedor", "vendedora", "do vendedor", "da vendedora"], question));

  let vendas = objectToArray(data.vendas);
  if (codigo) vendas = vendas.filter((item) => String(item.codigo || "").toUpperCase() === codigo);
  if (medida) vendas = vendas.filter((item) => sameMedida(item.medida, medida));
  if (cliente) vendas = vendas.filter((item) => normalizar(item.cliente || "").includes(cliente));
  if (vendedor) vendas = vendas.filter((item) => normalizar(item.vendedor || "").includes(vendedor));
  return vendas;
}

function conhecimentoDoSistema(question = "") {
  const t = normalizar(question);

  if (t.includes("CONSIGN")) {
    return {
      title: "Fluxo de consignação",
      text:
        "Consignação é uma saída pendente. A joia sai do disponível, entra em consignado e ainda não vira venda. Se o cliente comprar, o lançamento é convertido para venda final e gera comissão. Se voltar, a peça retorna para disponível e fica registrada como devolvida.",
      rows: []
    };
  }

  if (t.includes("VENDA")) {
    return {
      title: "Fluxo de venda final",
      text:
        "Venda final baixa o estoque disponível, registra cliente, vendedor, quantidade, peso, valor e origem. Quando existe vendedor vinculado, a comissão é calculada pela regra do vendedor ou pela regra padrão da fábrica.",
      rows: []
    };
  }

  if (t.includes("PRODUCAO") || t.includes("PRODUZIR") || t.includes("BANCADA")) {
    return {
      title: "Fluxo de produção",
      text:
        "Produção pronta é uma entrada de estoque. A fábrica lança produto, medida, material, quantidade, peso unitário, lote e responsável. O sistema soma no disponível, atualiza a última movimentação e ajuda a decidir o que precisa ir para bancada.",
      rows: []
    };
  }

  if (t.includes("COMISSAO")) {
    return {
      title: "Regra de comissão",
      text:
        "A comissão nasce na venda final. Consignação pendente não gera comissão até virar venda. O sistema calcula com o percentual do vendedor quando existir; caso contrário, usa o percentual padrão configurado nas regras da operação.",
      rows: []
    };
  }

  if (t.includes("ESTOQUE CRITICO") || t.includes("CRITICO")) {
    return {
      title: "Estoque crítico",
      text:
        "Estoque crítico é quando o disponível está igual ou abaixo do mínimo definido para a joia. Esse alerta alimenta a lista de produção sugerida.",
      rows: []
    };
  }

  if (t.includes("ESTOQUE PARADO") || t.includes("PARADO")) {
    return {
      title: "Estoque parado",
      text:
        "Estoque parado é a joia sem movimentação por mais dias que a regra da fábrica. Esse relatório ajuda o gestor a decidir promoção, mostruário, remarcação ou pausa de produção.",
      rows: []
    };
  }

  if (t.includes("PRATA") || t.includes("OURO") || t.includes("10K") || t.includes("18K") || t.includes("925")) {
    return {
      title: "Conhecimento técnico de materiais",
      text:
        "O sistema separa as joias por material, medida, peso, pedra, tipo e código. Para prata, a calculadora técnica deve usar fórmula validada pela fábrica: peso base, quantidade, perda de produção, custo por grama, mão de obra e margem. Enquanto a fórmula oficial não for cadastrada, o sistema não inventa fator técnico.",
      rows: []
    };
  }

  if (t.includes("PDF") || t.includes("IMPORT")) {
    return {
      title: "Importação de pedidos",
      text:
        "Na importação, o usuário envia o relatório, escolhe se é consignação pendente ou venda final, confere os itens extraídos e confirma. O sistema grava pedido, itens, cliente, vendedor, estoque e histórico de movimentação.",
      rows: []
    };
  }

  return null;
}

function buildRowsText(items, emptyText, formatter) {
  return items.length ? limitRows(items, 40).map(formatter).join("\n") : emptyText;
}

function buildHelp(canSeeCommissions = true) {
  return {
    title: "IA Real da fábrica",
    text:
      "Eu consulto os dados reais do sistema e conheço os fluxos da operação. Posso responder sobre estoque, joias, clientes, vendedores, vendas, consignações, comissões, produção, estoque crítico, estoque parado e regras internas.\n\nExemplos úteis:\n" +
      "• Quantos anéis 2740AGL medida 8 tem?\n" +
      "• Relatório de venda do código 2740AGL medida 8\n" +
      "• Vendas do cliente Capital Joalheria\n" +
      (canSeeCommissions ? "• Comissão do vendedor João\n" : "") +
      "• Clientes com histórico de vendas\n" +
      "• Mostrar consignações pendentes\n" +
      "• O que precisa produzir?\n" +
      "• Explique o fluxo de consignação",
    rows: []
  };
}

function vendasPorGrupo(vendas, label, keyFn) {
  const grouped = groupBy(vendas, keyFn);
  return Object.entries(grouped)
    .map(([nome, lista]) => {
      const resumo = salesSummary(lista);
      return {
        nome,
        descricao: label,
        quantidade: resumo.quantidade,
        pesoTotal: resumo.peso,
        valorTotal: resumo.valor,
        cliente: label === "Cliente" ? nome : "",
        vendedor: label === "Vendedor" ? nome : ""
      };
    })
    .sort((a, b) => Number(b.valorTotal || 0) - Number(a.valorTotal || 0));
}

export function assistantAnswer(input, question = "") {
  const hasContext = Boolean(input && typeof input === "object" && Object.prototype.hasOwnProperty.call(input, "data"));
  const safeData = hasContext ? (input.data || {}) : (input || {});
  const text = String(hasContext ? (input.question || "") : (question || "")).trim();
  const permissions = hasContext ? (input.permissions || {}) : {};
  const role = String(permissions.role || "").toLowerCase();
  const canSeeCommissions = Boolean(permissions.canSeeCommissions || permissions.isOwner || role === "dono");
  const upper = normalizar(text);
  const codigo = extractCode(text);
  const medida = extractMedida(text);

  const produtos = objectToArray(safeData.produtos);
  const vendas = objectToArray(safeData.vendas);
  const clientes = objectToArray(safeData.clientes);
  const vendedores = objectToArray(safeData.vendedores);
  const consignacoes = objectToArray(safeData.consignacoes);
  const comissoes = canSeeCommissions ? objectToArray(safeData.comissoes) : [];
  const producoes = objectToArray(safeData.producoes);
  const lotes = objectToArray(safeData.lotes);
  const pecasEstoque = objectToArray(safeData.pecasEstoque);

  if (!text) {
    return {
      title: "Digite uma pergunta",
      text: "Pergunte sobre estoque real por peça física, lote, peso real, venda, cliente, vendedor, consignação, produção, comissão ou fluxo operacional.",
      rows: []
    };
  }

  if (containsAny(upper, ["AJUDA", "O QUE VOCE SABE", "O QUE VOCE FAZ", "COMO USAR", "PERGUNTAR"])) {
    return buildHelp(canSeeCommissions);
  }

  if (containsAny(upper, ["RESUMO DAS VENDAS", "RESUMO DE VENDAS", "VENDAS GERAIS", "TOTAL DE VENDAS"]) && !codigo) {
    const resumo = salesSummary(vendas);
    const porVendedor = vendasPorGrupo(vendas, "Vendedor", (item) => item.vendedor);
    return {
      title: "Resumo geral de vendas",
      text:
        `Vendas registradas: ${formatNumber(vendas.length, 0)}\n` +
        `Quantidade vendida: ${formatNumber(resumo.quantidade, 0)} peça(s)\n` +
        `Peso vendido: ${formatNumber(resumo.peso, 3)} g\n` +
        `Valor vendido: ${formatCurrency(resumo.valor)}\n` +
        `Clientes atendidos: ${formatNumber(resumo.clientes.length, 0)}\n` +
        `Vendedores com venda: ${formatNumber(resumo.vendedores.length, 0)}`,
      rows: porVendedor.length ? porVendedor : vendas
    };
  }

  if (containsAny(upper, ["CRITICO", "CRÍTICO", "ABAIXO DO MINIMO", "BAIXO ESTOQUE"])) {
    const criticos = criticalProducts(safeData);
    return {
      title: "Estoque crítico",
      text: buildRowsText(criticos, "Nenhuma joia em estoque crítico no momento.", formatProductLine),
      rows: criticos
    };
  }

  if (containsAny(upper, ["PARADO", "SEM GIRO", "ENCALHADO"])) {
    const parados = stoppedProducts(safeData);
    return {
      title: "Estoque parado",
      text: buildRowsText(parados, "Nenhuma joia classificada como estoque parado no momento.", (item) => `${formatProductLine(item)} Parado há ${item.diasParado} dia(s).`),
      rows: parados
    };
  }

  if (containsAny(upper, ["PRECISA PRODUZIR", "O QUE PRODUZIR", "PRODUCAO SUGERIDA", "PRODUÇÃO SUGERIDA", "MANDAR PARA BANCADA", "FALTA PRODUZIR"])) {
    const criticos = criticalProducts(safeData);
    return {
      title: "Produção sugerida",
      text: buildRowsText(criticos, "Nenhuma produção urgente encontrada pela regra de estoque mínimo.", (p) => {
        const qtd = Math.max(0, Number(p.estoqueMinimo || 0) - Number(p.estoqueDisponivel || 0));
        return `• ${p.codigo || ""} · ${p.tipo || "Joia"} · medida ${p.medida || "-"} · ${p.material || "-"} — produzir ${formatNumber(qtd, 0)} peça(s). Disponível: ${formatNumber(p.estoqueDisponivel || 0, 0)} · mínimo: ${formatNumber(p.estoqueMinimo || 0, 0)}.`;
      }),
      rows: criticos
    };
  }

  if (containsAny(upper, ["CONSIGNACOES PENDENTES", "CONSIGNAÇÕES PENDENTES", "CONSIGNACAO PENDENTE", "CONSIGNAÇÃO PENDENTE", "PENDENTES EM CONSIGNACAO", "PENDENTES EM CONSIGNAÇÃO"])) {
    const pendentes = consignacoes.filter((item) => normalizar(item.status || "") === "PENDENTE");
    return {
      title: "Consignações pendentes",
      text: buildRowsText(pendentes, "Nenhuma consignação pendente encontrada.", (item) => `• ${item.codigo || ""} medida ${item.medida || "-"} · cliente ${item.cliente || "-"} · vendedor ${item.vendedor || "-"} · qtd ${formatNumber(item.quantidade || 0, 0)}.`),
      rows: pendentes
    };
  }

  if (containsAny(upper, ["CLIENTES COM HISTORICO", "CLIENTES COM HISTÓRICO", "CARTEIRA DE CLIENTES", "LISTA DE CLIENTES"]) && !extractSearchAfter(["cliente", "clientes"], text)) {
    const clientesComVenda = vendasPorGrupo(vendas, "Cliente", (item) => item.cliente);
    return {
      title: "Clientes com histórico de vendas",
      text: clientesComVenda.length
        ? `Encontrei ${formatNumber(clientesComVenda.length, 0)} cliente(s) com vendas registradas.`
        : "Ainda não há vendas vinculadas a clientes.",
      rows: clientesComVenda.length ? clientesComVenda : clientes
    };
  }

  const isCommissionQuestion = containsAny(upper, ["COMISSAO", "COMISSÃO", "COMISSOES", "COMISSÕES", "REPASS", "RECEBER COMISSAO", "VALOR DE COMISSAO"]);
  if (isCommissionQuestion && !canSeeCommissions) {
    return {
      title: "Acesso restrito",
      text: "Comissões são informação restrita ao Vitor / Dono. Eu não consultei nem mostrei dados de comissão para este perfil.",
      rows: []
    };
  }

  if (containsAny(upper, ["CLIENTE"])) {
    const busca = normalizar(extractSearchAfter(["cliente", "clientes", "do cliente", "da cliente"], text));
    let filtrados = clientes;
    if (busca) filtrados = filtrados.filter((c) => normalizar(`${c.nome} ${c.documento} ${c.cidade} ${c.telefone}`).includes(busca));

    const vendasCliente = vendas.filter((v) => !busca || normalizar(v.cliente || "").includes(busca));
    const resumo = salesSummary(vendasCliente);
    return {
      title: "Consulta de cliente",
      text:
        `Clientes encontrados: ${formatNumber(filtrados.length, 0)}\n` +
        `Vendas vinculadas: ${formatNumber(vendasCliente.length, 0)}\n` +
        `Quantidade comprada: ${formatNumber(resumo.quantidade, 0)} peça(s)\n` +
        `Peso comprado: ${formatNumber(resumo.peso, 3)} g\n` +
        `Valor vendido: ${formatCurrency(resumo.valor)}`,
      rows: vendasCliente.length ? vendasCliente : filtrados
    };
  }

  if (containsAny(upper, ["COMISSOES POR VENDEDOR", "COMISSÕES POR VENDEDOR", "COMISSAO POR VENDEDOR", "COMISSÃO POR VENDEDOR"])) {
    const agrupado = groupBy(comissoes, (item) => item.vendedor);
    const rows = Object.entries(agrupado)
      .map(([vendedor, lista]) => ({
        nome: vendedor,
        descricao: "Comissão",
        quantidade: lista.length,
        valor: sum(lista, (item) => item.valor),
        vendedor
      }))
      .sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0));

    return {
      title: "Comissões por vendedor",
      text: rows.length
        ? `Total de comissões previstas: ${formatCurrency(sum(rows, (item) => item.valor))}`
        : "Nenhuma comissão registrada ainda.",
      rows
    };
  }

  if (containsAny(upper, ["VENDEDOR", "VENDEDORA", "COMISSAO", "COMISSÃO"])) {
    const busca = normalizar(extractSearchAfter(["vendedor", "vendedora", "comissao de", "comissão de", "do vendedor", "da vendedora"], text));
    let vend = vendedores;
    if (busca) vend = vend.filter((v) => normalizar(`${v.nome} ${v.email} ${v.cargo}`).includes(busca));

    let vendasVend = vendas;
    let comissoesVend = canSeeCommissions ? comissoes : [];
    if (busca) {
      vendasVend = vendasVend.filter((v) => normalizar(v.vendedor || "").includes(busca));
      comissoesVend = comissoesVend.filter((c) => normalizar(c.vendedor || "").includes(busca));
    }

    const commissionText = canSeeCommissions
      ? `\nComissões previstas: ${formatCurrency(sum(comissoesVend, (item) => item.valor))}`
      : "";

    return {
      title: "Consulta comercial",
      text:
        `Vendedores encontrados: ${formatNumber(vend.length, 0)}\n` +
        `Vendas vinculadas: ${formatNumber(vendasVend.length, 0)}\n` +
        `Valor vendido: ${formatCurrency(sum(vendasVend, (item) => item.valorTotal))}` +
        commissionText,
      rows: vendasVend.length ? vendasVend : (canSeeCommissions && comissoesVend.length ? comissoesVend : vend)
    };
  }

  if (containsAny(upper, ["RELATORIO", "RELATÓRIO", "VENDA", "VENDIDO", "QUANTO VENDEU", "SAIDA", "SAÍDA"])) {
    const filtradas = filterSales(safeData, text);
    const resumo = salesSummary(filtradas);
    const vendedoresTxt = resumo.vendedores.join(", ") || "-";
    const clientesTxt = resumo.clientes.join(", ") || "-";

    return {
      title: "Relatório rápido de vendas",
      text:
        `Filtro: ${codigo || "todos os códigos"}${medida ? ` · medida ${medida}` : ""}\n` +
        `Vendas encontradas: ${formatNumber(filtradas.length, 0)}\n` +
        `Quantidade vendida: ${formatNumber(resumo.quantidade, 0)} peça(s)\n` +
        `Peso total: ${formatNumber(resumo.peso, 3)} g\n` +
        `Valor total: ${formatCurrency(resumo.valor)}\n` +
        `Vendedores: ${vendedoresTxt}\n` +
        `Clientes: ${clientesTxt}`,
      rows: filtradas
    };
  }

  if (containsAny(upper, ["QUANTOS", "TEM", "ESTOQUE", "SALDO", "DISPONIVEL", "DISPONÍVEL", "PECA", "PEÇA", "PESO"]) || codigo) {
    const pecasFiltradas = filterPhysicalPieces(safeData, text);

    if (pecasFiltradas.length) {
      const resumo = physicalPieceSummary(pecasFiltradas);
      const disponiveis = pecasFiltradas.filter((item) => normalizar(item.status || "disponivel") === "DISPONIVEL");
      return {
        title: "Estoque real por peça física",
        text:
          `Peças físicas encontradas: ${formatNumber(pecasFiltradas.length, 0)}\n` +
          `Disponíveis: ${formatNumber(resumo.disponivel, 0)} peça(s)\n` +
          `Consignadas: ${formatNumber(resumo.consignado, 0)} peça(s)\n` +
          `Vendidas: ${formatNumber(resumo.vendido, 0)} peça(s)\n` +
          `Peso disponível: ${formatNumber(resumo.pesoDisponivel, 3)} g\n` +
          `Lotes: ${resumo.lotes.length ? resumo.lotes.slice(0, 10).join(", ") : "-"}\n\n` +
          disponiveis.slice(0, 40).map(formatPhysicalPieceLine).join("\n"),
        rows: pecasFiltradas
      };
    }

    const encontrados = filterProducts(safeData, text);

    if (!encontrados.length) {
      return {
        title: "Consulta de estoque",
        text: `Não encontrei joia ${codigo || ""}${medida ? ` medida ${medida}` : ""} no estoque cadastrado.`,
        rows: []
      };
    }

    const totais = {
      disponivel: sum(encontrados, (item) => item.estoqueDisponivel),
      consignado: sum(encontrados, (item) => item.estoqueConsignado),
      vendido: sum(encontrados, (item) => item.estoqueVendido)
    };

    const idsEncontrados = new Set(encontrados.map((item) => item.id));
    const lotesEncontrados = lotes.filter((lote) => idsEncontrados.has(lote.produtoId));
    const textoLotes = lotesEncontrados.length
      ? `\n\nLotes encontrados:\n${lotesEncontrados.slice(0, 20).map(formatLotLine).join("\n")}`
      : "";

    return {
      title: "Consulta de estoque por cadastro/SKU",
      text:
        `Joias encontradas: ${formatNumber(encontrados.length, 0)}\n` +
        `Disponível: ${formatNumber(totais.disponivel, 0)} peça(s)\n` +
        `Consignado: ${formatNumber(totais.consignado, 0)} peça(s)\n` +
        `Vendido acumulado: ${formatNumber(totais.vendido, 0)} peça(s)\n\n` +
        encontrados.slice(0, 40).map(formatProductLine).join("\n") +
        textoLotes,
      rows: encontrados
    };
  }

  if (containsAny(upper, ["PRODUCAO", "PRODUÇÃO", "LOTE", "ENTRADA PRONTA"])) {
    return {
      title: "Histórico de produção",
      text: producoes.length
        ? producoes.slice(0, 30).map((p) => `• ${p.codigo || ""} medida ${p.medida || "-"} · qtd ${formatNumber(p.quantidade || 0, 0)} · peso ${formatNumber(p.pesoTotal || p.pesoUnitario || 0, 3)} g · lote ${p.lote || "-"}.`).join("\n")
        : "Nenhuma produção lançada ainda.",
      rows: producoes
    };
  }

  const knowledge = conhecimentoDoSistema(text);
  if (knowledge) return knowledge;

  return {
    title: "Consulta não localizada",
    text:
      "Não encontrei dados ou fluxo para essa pergunta. Informe código, medida, cliente, vendedor ou assunto operacional.\n\nExemplos:\n" +
      "• Quantos anéis 2740AGL medida 8 tem?\n" +
      "• Vendas do cliente Capital Joalheria\n" +
      (canSeeCommissions ? "• Comissão do vendedor João\n" : "") +
      "• Mostrar estoque crítico\n" +
      "• Explique o fluxo de produção",
    rows: []
  };
}

function valueCell(item) {
  if (item.valorTotal !== undefined) return formatCurrency(item.valorTotal);
  if (item.valor !== undefined) return formatCurrency(item.valor);
  if (item.estoqueDisponivel !== undefined) return formatNumber(item.estoqueDisponivel, 0);
  if (item.quantidade !== undefined) return formatNumber(item.quantidade, 0);
  return "-";
}

export function renderAssistantRows(rows = []) {
  if (!rows.length) return "";
  const tableRows = rows.slice(0, 30).map((item) => `
    <tr>
      <td>${escapeHtml(item.codigo || item.produtoCodigo || item.nome || item.id || "-")}</td>
      <td>${escapeHtml(item.descricao || item.documento || item.email || item.tipo || "-")}</td>
      <td>${escapeHtml(item.medida || item.material || item.cidade || "-")}</td>
      <td>${escapeHtml(item.cliente || item.telefone || "-")}</td>
      <td>${escapeHtml(item.vendedor || item.cargo || "-")}</td>
      <td>${escapeHtml(valueCell(item))}</td>
      <td>${escapeHtml(item.criadoEm ? formatDate(item.criadoEm) : (item.status || "-"))}</td>
    </tr>
  `).join("");

  return `
    <div class="table-wrap ai-table" style="margin-top:16px">
      <table>
        <thead>
          <tr>
            <th>Registro</th>
            <th>Descrição</th>
            <th>Medida/Material</th>
            <th>Cliente</th>
            <th>Vendedor</th>
            <th>Qtd/Valor</th>
            <th>Data/Status</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
  `;
}

import {
  brDateToIso,
  inferMaterial,
  inferMedida,
  inferTipo,
  parseNumberBR
} from "./utils.js";

const PRODUCT_CODE_REGEX = /\b((?:[A-Z]{2,6}\d{3,}[A-Z0-9]*|\d{3,}\s*[A-Z]{2,6}[A-Z0-9]*)(?:\s*-\s*\d{1,2}\/\d{1,2})?)\b/i;

function cleanLine(line = "") {
  return String(line)
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function groupPdfItemsIntoLines(items) {
  const mapped = items
    .map((item) => ({
      text: cleanLine(item.str),
      x: item.transform?.[4] || 0,
      y: item.transform?.[5] || 0
    }))
    .filter((item) => item.text);

  mapped.sort((a, b) => {
    if (Math.abs(b.y - a.y) > 2) return b.y - a.y;
    return a.x - b.x;
  });

  const lines = [];
  for (const item of mapped) {
    const current = lines[lines.length - 1];
    if (!current || Math.abs(current.y - item.y) > 2.2) {
      lines.push({ y: item.y, chunks: [item] });
    } else {
      current.chunks.push(item);
    }
  }

  return lines.map((line) =>
    line.chunks
      .sort((a, b) => a.x - b.x)
      .map((chunk) => chunk.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function extractNumbers(line = "") {
  const matches = String(line).match(/\d+(?:[.,]\d+)?/g) || [];
  return matches.map(parseNumberBR);
}
function applyLineWeightSemantics(item = {}) {
  const qtd = Math.max(0, Math.round(parseNumberBR(item.quantidade || 0)));
  const pesoTotalLinha = parseNumberBR(item.pesoTotalLinha ?? item.peso ?? 0);
  item.pesoTotalLinha = pesoTotalLinha;
  item.pesoUnitarioEstimado = qtd > 0 && pesoTotalLinha > 0 ? pesoTotalLinha / qtd : 0;
  item.pesoTotalReferencia = pesoTotalLinha;
  // O sistema não usa valor financeiro do PDF.
  item.valorUnitario = 0;
  item.valorTotal = 0;
  item.totalItem = 0;
  return item;
}


function firstMatch(lines, regex) {
  for (const line of lines) {
    const match = line.match(regex);
    if (match) return match;
  }
  return null;
}

function parseHeader(lines) {
  const joined = lines.join("\n");
  const flat = joined.replace(/\s+/g, " ");

  let numeroPedido = "";
  let dataPedido = "";
  let situacao = "";
  let tipoPedido = "";
  let observacao = "";
  let clienteNome = "";
  let conta = "";
  let cnpjCpf = "";
  let telefone = "";
  let endereco = "";
  let cidade = "";
  let uf = "";

  const visualHeader = firstMatch(lines, /\b(\d{4,7})\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(PENDENTE|FINALIZADO|FATURADO|CANCELADO)?\s*(POR\s+PESO|POR\s+PE[ÇC]A|VENDA|CONSIGNA[ÇC][ÃA]O)?/i);
  if (visualHeader) {
    numeroPedido = visualHeader[1] || "";
    dataPedido = brDateToIso(visualHeader[2] || "");
    situacao = (visualHeader[3] || "").toUpperCase();
    tipoPedido = (visualHeader[4] || "").toUpperCase();
  }

  if (!numeroPedido) {
    const pedidoSolo = firstMatch(lines, /^\s*(\d{4,7})\s*$/);
    if (pedidoSolo) numeroPedido = pedidoSolo[1];
  }

  if (!dataPedido) {
    const dateMatch = firstMatch(lines, /^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*$/);
    if (dateMatch) dataPedido = brDateToIso(dateMatch[1]);
  }

  if (!situacao) {
    const statusMatch = flat.match(/\b(PENDENTE|FINALIZADO|FATURADO|CANCELADO)\b/i);
    if (statusMatch) situacao = statusMatch[1].toUpperCase();
  }

  if (!tipoPedido) {
    const tipoMatch = flat.match(/\b(POR\s+PESO|POR\s+PE[ÇC]A|VENDA|CONSIGNA[ÇC][ÃA]O)\b/i);
    if (tipoMatch) tipoPedido = tipoMatch[1].toUpperCase();
  }

  const cnpjMatch = flat.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}|\d{3}\.\d{3}\.\d{3}-\d{2})/);
  if (cnpjMatch) cnpjCpf = cnpjMatch[1];

  const telefoneMatch = flat.match(/(\(?\d{2}\)?\s?\d{4,5}-?\d{4}|\(\d{2}\)\d{5,})/);
  if (telefoneMatch) telefone = telefoneMatch[1];

  const contaLine = lines.find((line) => /^\d{3,6}\s+\/?\s*[A-Z0-9 -]+/i.test(line) && !PRODUCT_CODE_REGEX.test(line));
  if (contaLine) conta = contaLine;

  const clienteLine = lines.find((line) => /\bLTDA\b|\bME\b|\bEIRELI\b|\bJOALHERIA\b/i.test(line) && !PRODUCT_CODE_REGEX.test(line));
  if (clienteLine) clienteNome = clienteLine.replace(/^\d+\s+\/?\s*/, "").trim();

  const ruaLine = lines.find((line) => /\bRUA\b|\bAV\b|\bAVENIDA\b|\bALAMEDA\b/i.test(line));
  if (ruaLine) endereco = ruaLine;

  const cidadeLine = lines.find((line) => /\b(SÃO PAULO|SAO PAULO|RIO DE JANEIRO|SP|RJ|MG|PR|SC|RS)\b/i.test(line) && !line.includes("www."));
  if (cidadeLine) {
    cidade = cidadeLine.replace(/\b(SP|RJ|MG|PR|SC|RS|BA|GO|PE|CE|ES|DF)\b.*/i, "").trim();
    const ufMatch = cidadeLine.match(/\b(SP|RJ|MG|PR|SC|RS|BA|GO|PE|CE|ES|DF)\b/i);
    if (ufMatch) uf = ufMatch[1].toUpperCase();
  }

  const obsIndex = lines.findIndex((line) => /^Observa[cç][aã]o$/i.test(line) || /^Observa[cç][aã]o\s*:?$/i.test(line));
  if (obsIndex >= 0) {
    for (let i = obsIndex + 1; i < Math.min(lines.length, obsIndex + 5); i++) {
      const candidate = lines[i];
      if (
        candidate &&
        !/Pedido|Data|Situa|Tipo|Endere|CNPJ|Cidade|Seq|Produto/i.test(candidate) &&
        !PRODUCT_CODE_REGEX.test(candidate)
      ) {
        observacao = candidate;
        break;
      }
    }
  }

  if (!observacao) {
    const possible = lines.find((line) => /CONSIG|MOSTRUARIO|MOSTRUÁRIO|TIRAR PEDIDO|PEDIDO PARA MONTAR O ESTOQUE|ESTOQUE|ORÇAMENTO|ORCAMENTO|PRODUÇÃO|PRODUCAO/i.test(line));
    if (possible) observacao = possible;
  }

  return {
    numeroPedido,
    dataPedido,
    situacao,
    tipoPedido,
    conta,
    clienteNome,
    cnpjCpf,
    telefone,
    endereco,
    cidade,
    uf,
    observacao
  };
}



function normalizeProductCode(raw = "") {
  return String(raw || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/\s*-\s*/g, "-")
    .trim();
}

function isFooterOrTotalLine(line = "") {
  const value = cleanLine(line);
  if (!value) return true;

  return /(?:SubTotal\s+Pedido|Total\s+Pedido|Qtd\s+de\s+Item|Qtd\s+Pe[cç]a|Total\s+Brits|Total\s+Pedras|Total\s+Outras|Acr[eé]scimo|Frete|Documento\s+gerado|Powered\s+by|https?:\/\/|www\.)/i.test(value);
}

function isInvalidProductCode(code = "", line = "") {
  const normalized = normalizeProductCode(code);
  const value = cleanLine(line).toUpperCase();

  if (!normalized) return true;
  if (isFooterOrTotalLine(line)) return true;

  // Protege contra rodapé/totais sendo lidos como código, exemplo:
  // "23 485 SubTotal Pedido 1138,500" virando "485SUBTOTAL".
  if (/(SUBTOTAL|TOTAL|FRETE|ACRESCIMO|ACRÉSCIMO|BRITS|PEDRAS|OUTRAS|PEDIDO|RELATORIO|RELATÓRIO|GLAMORE|ARP|HTTP|WWW|DOCUMENTO|POWERED)/i.test(normalized)) return true;
  if (/^\d{1,4}$/.test(normalized)) return true;

  // Código válido pode começar com número, mas precisa terminar com um bloco curto
  // de letras de produto. Não aceita palavras de relatório nem termos de material.
  if (/^\d{3,}(SUBTOTAL|TOTAL|PEDIDO|FRETE)/i.test(normalized)) return true;
  if (/\b(SubTotal|Total|Frete|Acr[eé]scimo)\b/i.test(value)) return true;

  // V35 — proteção crítica: no cabeçalho/observação do pedido 25826 aparece
  // "REPOSIÇÃO DE ESTOQUE 2740 OURO 18K...". O regex antigo enxergava
  // "2740 OURO" como produto e criava uma linha falsa, somando 1224 peças
  // em vez das 1223 oficiais. Produto verdadeiro é 2740AGL; "OURO" é material.
  if (/^\d{3,}(OURO|PRATA|GOLD|SILVER|AMARELO|BRANCO|ROSE|ROSE)$/i.test(normalized)) return true;
  if (/\b(REPOSI[CÇ][AÃ]O|SOLICITADO|SOLICITADA|ESTOQUE|OR[CÇ]AMENTO|ORCAMENTO)\b/i.test(value) && /^\d{3,}(OURO|PRATA|GOLD|SILVER)/i.test(normalized)) return true;

  return false;
}

function extractLote(text = "") {
  const value = String(text || "");
  /*
   * V37 — proteção crítica: a observação do PDF usa "LOJA 94-01/ENV ...".
   * A regra antiga aceitava a letra "L" sozinha e transformava LOJA em lote "OJA",
   * quebrando a rastreabilidade. Agora lote só é extraído quando vier como LOTE/LOT
   * ou como L: / L- / L# explícito.
   */
  const explicit = value.match(/\b(?:LOTE|LOT)\s*[:#-]?\s*([A-Z0-9._/-]{2,40})\b/i);
  if (explicit) return explicit[1].trim();
  const short = value.match(/\bL\s*[:#-]\s*([A-Z0-9._/-]{2,40})\b/i);
  return short ? short[1].trim() : "";
}

function extractLojaEnv(text = "") {
  const value = String(text || "");
  const lojaMatch = value.match(/\bLOJA\s*([0-9]{1,5}(?:[-/][0-9]{1,5})?)\b/i);
  const envMatch = value.match(/\bENV\s*([0-9]{3,})\b/i);
  return {
    lojaCodigo: lojaMatch ? lojaMatch[1].trim() : "",
    envCodigo: envMatch ? envMatch[1].trim() : ""
  };
}

function applyTechnicalObservationFields(item = {}, text = "") {
  const source = String(text || "");
  const lojaEnv = extractLojaEnv(source);
  item.lote = extractLote(source);
  item.lojaCodigo = lojaEnv.lojaCodigo || item.lojaCodigo || "";
  item.envCodigo = lojaEnv.envCodigo || item.envCodigo || "";
  item.referenciaLojaEnv = [
    item.lojaCodigo ? `LOJA ${item.lojaCodigo}` : "",
    item.envCodigo ? `ENV ${item.envCodigo}` : ""
  ].filter(Boolean).join(" / ");
  item.observacaoTecnica = item.observacao || "";
  return item;
}

function isSequenceLine(line = "") {
  return /^\d{1,4}$/.test(cleanLine(line));
}

function isNumericOnlyLine(line = "") {
  const value = cleanLine(line);
  return /^[\d.,]+(?:\s+[\d.,]+)+$/.test(value) || /^[\d.,]+$/.test(value);
}

function isDescriptionLine(line = "") {
  const value = cleanLine(line);
  if (!value) return false;
  if (PRODUCT_CODE_REGEX.test(value)) return false;
  if (/^(Seq\.?|Produto|Qtd|Peso|Vlr|B0,5|Brits|Ped\.|Observa[cç][aã]o|Total|SubTotal|Frete|Acr[eé]scimo|www\.|Glamore|Relat[oó]rio|Pedido Data|Conta|Pessoa|Endere[cç]o|CNPJ|Cidade|UF)/i.test(value)) return false;
  if (isSequenceLine(value) || isNumericOnlyLine(value)) return false;
  return /ALIAN|ANEL|AN\.|BR\.|PI\.|BRINCO|CORRENTE|PINGENTE|PULSEIRA|FEM|MASC|OURO|PRATA|18K|10K|ZIRC|MOISS|ARGOLA|SOLIT|APARADOR|GOTA|REDONDO|OVAL|CORA/i.test(value);
}

function findNextDescription(lines, index) {
  for (let i = index + 1; i < Math.min(lines.length, index + 8); i++) {
    const candidate = cleanLine(lines[i] || "");
    if (isDescriptionLine(candidate)) return candidate;
  }
  return "";
}

function findNextObservation(lines, index) {
  for (let i = index + 1; i < Math.min(lines.length, index + 10); i++) {
    const candidate = cleanLine(lines[i] || "");
    if (/^Observa[cç][aã]o\s*:/i.test(candidate)) {
      return candidate.replace(/^Observa[cç][aã]o\s*:\s*/i, "").trim();
    }
  }
  return "";
}

function findNextQuantityTriplet(lines, index) {
  for (let i = index + 1; i < Math.min(lines.length, index + 10); i++) {
    const candidate = cleanLine(lines[i] || "");
    if (/^\d+\s+\d+\s+\d+$/.test(candidate)) {
      const nums = extractNumbers(candidate);
      return {
        quantidade: nums[0] || 0,
        pedraN: nums[1] || 0,
        outras: nums[2] || 0
      };
    }
  }
  return null;
}

function previousMeaningfulLine(lines, index, offset = 1) {
  let found = 0;
  for (let i = index - 1; i >= 0; i--) {
    const candidate = cleanLine(lines[i] || "");
    if (!candidate) continue;
    found++;
    if (found === offset) return candidate;
  }
  return "";
}

function parseItemFromVisualLine(line, lines, index, codeMatch, mode = "peso") {
  const codeRaw = cleanLine(codeMatch[1] || "");
  const codigoBase = normalizeProductCode(codeRaw.split("-")[0]);
  const before = cleanLine(line.slice(0, codeMatch.index));
  const after = cleanLine(line.slice(codeMatch.index + codeMatch[0].length));

  let sequencia = "";
  const seqMatch = before.match(/(\d{1,4})\s*$/);
  if (seqMatch) sequencia = seqMatch[1];

  const item = {
    sequencia,
    codigoOriginal: codeRaw,
    codigo: codigoBase,
    descricao: "",
    quantidade: 1,
    peso: 0,
    valorUnitario: 0,
    b05: 0,
    brits10: 0,
    pedraN: 0,
    valorPedraN: 0,
    outras: 0,
    valorOutraPedra: 0,
    totalItem: 0,
    observacao: "",
    medida: "",
    material: "",
    lote: "",
    tipo: "",
    modeloPdf: mode
  };

  const nums = extractNumbers(after);

  if (nums.length >= 9) {
    item.quantidade = Math.max(0, Math.round(nums[0] || 1));

    if (mode === "valor") {
      item.valorUnitario = nums[1] || 0;
      item.peso = 0;
    } else {
      item.peso = nums[1] || 0;
      item.valorUnitario = 0;
    }

    item.b05 = nums[2] || 0;
    item.brits10 = nums[3] || 0;
    item.pedraN = nums[4] || 0;
    item.valorPedraN = nums[5] || 0;
    item.outras = nums[6] || 0;
    item.valorOutraPedra = nums[7] || 0;
    item.totalItem = nums[8] || 0;
  } else if (nums.length >= 2 && /^\d+(?:[.,]\d+)?(?:\s|$)/.test(after)) {
    item.quantidade = Math.max(0, Math.round(nums[0] || 1));
    if (mode === "valor") {
      item.valorUnitario = nums[1] || 0;
      item.totalItem = nums[nums.length - 1] || 0;
    } else {
      item.peso = nums[1] || 0;
      item.totalItem = nums[nums.length - 1] || 0;
    }
  } else {
    const previousSeqLine = previousMeaningfulLine(lines, index, 1);
    const previousNumeric = previousMeaningfulLine(lines, index, 2);

    if (!item.sequencia && isSequenceLine(previousSeqLine)) {
      item.sequencia = previousSeqLine;
    }

    const rowNums = extractNumbers(previousNumeric);
    if (rowNums.length >= 6 && /^[\d.,]/.test(previousNumeric)) {
      if (mode === "valor") {
        item.valorUnitario = rowNums[0] || 0;
      } else {
        item.peso = rowNums[0] || 0;
      }
      item.b05 = rowNums[1] || 0;
      item.brits10 = rowNums[2] || 0;
      item.valorPedraN = rowNums[3] || 0;
      item.valorOutraPedra = rowNums[4] || 0;
      item.totalItem = rowNums[5] || 0;
    }
  }

  item.descricao = findNextDescription(lines, index);
  item.observacao = findNextObservation(lines, index);

  const triplet = findNextQuantityTriplet(lines, index);
  if (triplet) {
    item.quantidade = Math.max(0, Math.round(triplet.quantidade || item.quantidade || 1));
    item.pedraN = triplet.pedraN || item.pedraN || 0;
    item.outras = triplet.outras || item.outras || 0;
  }

  const fullText = `${item.codigoOriginal} ${item.descricao} ${item.observacao}`;
  item.material = inferMaterial(fullText);
  item.medida = inferMedida(fullText);
  applyTechnicalObservationFields(item, fullText);
  item.tipo = inferTipo(item.descricao, item.codigo);

  return item;
}


function findObservationBetween(lines, startIndex, endIndex) {
  const start = Math.max(0, startIndex);
  const end = Math.min(lines.length, endIndex);
  for (let i = start; i < end; i++) {
    const candidate = cleanLine(lines[i] || "");
    const match = candidate.match(/^Observa[cç][aã]o\s*:\s*(.+)$/i);
    if (match) return cleanLine(match[1] || "");
  }
  return "";
}

function nextProductLineIndex(lines, index) {
  for (let i = index + 1; i < lines.length; i++) {
    const candidate = cleanLine(lines[i] || "");
    if (PRODUCT_CODE_REGEX.test(candidate) && !isInvalidProductCode((candidate.match(PRODUCT_CODE_REGEX) || [])[1] || "", candidate)) return i;
  }
  return lines.length;
}

function previousProductLineIndex(lines, index) {
  for (let i = index - 1; i >= 0; i--) {
    const candidate = cleanLine(lines[i] || "");
    if (PRODUCT_CODE_REGEX.test(candidate) && !isInvalidProductCode((candidate.match(PRODUCT_CODE_REGEX) || [])[1] || "", candidate)) return i;
  }
  return -1;
}

function findObservationForProductRow(lines, index) {
  /*
   * V27.1 — correção crítica do inventário Glamore.
   * No PDF original de estoque, a observação N°08/N°09/N°10 vem em linhas
   * separadas depois do produto; na virada de página, a observação N°18 vem
   * antes da próxima linha de produto. A busca antiga por janela fixa podia
   * pular N°08/N°09 e transformar 485 peças em 400.
   * Aqui a observação é vinculada ao produto atual pelo BLOCO: do produto atual
   * até antes do próximo produto. Só se não encontrar, procura no bloco anterior.
   */
  const nextProduct = nextProductLineIndex(lines, index);
  const forward = findObservationBetween(lines, index + 1, nextProduct);
  if (forward) return forward;

  const previousProduct = previousProductLineIndex(lines, index);
  const backward = findObservationBetween(lines, previousProduct + 1, index);
  if (backward) return backward;

  return "";
}

function parseItemsByProductBlocks(lines, mode = "peso") {
  const items = [];

  lines.forEach((line, index) => {
    if (isFooterOrTotalLine(line)) return;

    const codeMatch = line.match(PRODUCT_CODE_REGEX);
    if (!codeMatch) return;

    const codeRaw = cleanLine(codeMatch[1] || "");
    if (isInvalidProductCode(codeRaw, line)) return;

    const item = parseItemFromVisualLine(line, lines, index, codeMatch, mode);
    const observation = findObservationForProductRow(lines, index);
    if (observation) {
      item.observacao = observation;
      const fullText = `${item.codigoOriginal} ${item.descricao} ${item.observacao}`;
      item.material = inferMaterial(fullText);
      item.medida = inferMedida(fullText);
      applyTechnicalObservationFields(item, fullText);
      item.tipo = inferTipo(item.descricao, item.codigo);
    }

    if (!item.codigo || isInvalidProductCode(item.codigo, line)) return;
    if (!item.descricao && !item.medida && !item.material) return;

    items.push(item);
  });

  return items.map(applyLineWeightSemantics);
}

function totalQuantity(items = []) {
  return items.reduce((acc, item) => acc + Number(item.quantidade || 0), 0);
}

function parseItems(lines) {
  const items = [];
  const seen = new Set();
  const joined = lines.join(" ");
  const hasValueHeader = /Vlr\.?\s*Unit/i.test(joined);
  const hasPesoHeader = /\bQtd\s+Peso\b/i.test(joined) || /\bPeso\s+B0,5\b/i.test(joined);
  const mode = hasValueHeader && !hasPesoHeader ? "valor" : "peso";

  lines.forEach((line, index) => {
    if (isFooterOrTotalLine(line)) return;

    const codeMatch = line.match(PRODUCT_CODE_REGEX);
    if (!codeMatch) return;

    const codeRaw = cleanLine(codeMatch[1] || "");
    if (isInvalidProductCode(codeRaw, line)) return;

    const item = parseItemFromVisualLine(line, lines, index, codeMatch, mode);
    const signature = `${item.sequencia}_${item.codigoOriginal}_${item.medida}_${index}`;
    if (seen.has(signature)) return;
    seen.add(signature);

    if (!item.codigo || isInvalidProductCode(item.codigo, line)) return;
    if (!item.descricao && !item.medida && !item.material) return;

    items.push(item);
  });

  const blockItems = parseItemsByProductBlocks(lines, mode);
  const expectedPieces = parseTotals(lines).qtdPecas || 0;

  /*
   * Se o parser visual não bater com o total oficial do PDF, usa o parser por
   * blocos. Isso corrige o PDF original Pedido 26686, onde o visual antigo
   * importava 400 em vez de 485 peças.
   */
  if (expectedPieces && totalQuantity(blockItems) === expectedPieces && totalQuantity(items) !== expectedPieces) {
    return blockItems.map(applyLineWeightSemantics);
  }

  if (totalQuantity(blockItems) > totalQuantity(items)) {
    return blockItems.map(applyLineWeightSemantics);
  }

  return items.map(applyLineWeightSemantics);
}

function parseTotals(lines) {
  const flat = lines.join(" ").replace(/\s+/g, " ");
  const totals = {
    qtdItens: 0,
    qtdPecas: 0,
    totalBrits05: 0,
    totalBrits: 0,
    totalPedrasN: 0,
    totalOutras: 0,
    subtotal: 0,
    acrescimo: 0,
    frete: 0,
    totalPedido: 0
  };

  const itensPecas = flat.match(/(\d+)\s+(\d+)\s+SubTotal\s+Pedido/i);
  if (itensPecas) {
    totals.qtdItens = Number(itensPecas[1] || 0);
    totals.qtdPecas = Number(itensPecas[2] || 0);
  }

  return totals;
}


function safeImageName(value = "") {
  return String(value || "joia")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "joia";
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Não foi possível gerar a foto da joia a partir do PDF."));
    }, type, quality);
  });
}

function canvasToDataUrl(canvas, type = "image/jpeg", quality = 0.86) {
  try {
    return canvas.toDataURL(type, quality);
  } catch (_) {
    return "";
  }
}

function buildImageFile(blob, name) {
  const fileName = `${safeImageName(name)}.jpg`;
  try {
    return new File([blob], fileName, { type: "image/jpeg" });
  } catch (_) {
    blob.name = fileName;
    return blob;
  }
}

function productCodeEntries(content, viewport, pageNumber) {
  return content.items
    .map((item) => {
      const text = cleanLine(item.str);
      const match = text.match(PRODUCT_CODE_REGEX);
      if (!match) return null;

      const raw = match[1].replace(/\s+/g, " ").trim();
      if (isInvalidProductCode(raw, text)) return null;
      const base = raw.split("-")[0].trim();
      const x = Number(item.transform?.[4] || 0);
      const y = Number(item.transform?.[5] || 0);
      const [viewX, viewY] = viewport.convertToViewportPoint(x, y);

      return {
        pageNumber,
        codigoOriginal: raw,
        codigo: base,
        viewX,
        viewY
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (Math.abs(a.viewY - b.viewY) > 2) return a.viewY - b.viewY;
      return a.viewX - b.viewX;
    });
}


function isLikelyJewelryPixel(r, g, b, a = 255) {
  if (a < 40) return false;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max - min;
  const brightness = (r + g + b) / 3;

  // Remove fundo branco, linhas cinzas e textos pretos/cinzas do PDF.
  if (brightness > 238 && saturation < 28) return false;
  if (saturation < 16) return false;

  // Remove textos azuis/roxos da palavra "Observação" e linhas coloridas.
  if (b > r + 18 && b > g + 12) return false;

  // Ouro/amarelo/marrom do produto.
  const gold =
    r > 118 &&
    g > 82 &&
    b < 190 &&
    r > b + 22 &&
    g > b + 8;

  // Sombras quentes e partes internas escuras próximas ao ouro.
  const warmShadow =
    r > 72 &&
    g > 48 &&
    b < 95 &&
    r >= g - 10 &&
    r > b + 12;

  return gold || warmShadow;
}

function findJewelryBounds(sourceCanvas) {
  const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = sourceCanvas;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  /*
   * V15: recorte por componente conectado.
   * O problema anterior era juntar a joia principal com pedaços da próxima linha
   * ou com a faixa "Observação". Agora o algoritmo:
   * 1) monta uma máscara só dos pixels quentes/dourados da joia;
   * 2) separa componentes conectados;
   * 3) escolhe a peça principal pelo tamanho e pela posição esperada da miniatura;
   * 4) corta somente em volta dessa peça.
   */
  const padX = Math.max(2, Math.round(width * 0.05));
  const padY = Math.max(2, Math.round(height * 0.05));
  const mask = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);

  for (let y = padY; y < height - padY; y++) {
    for (let x = padX; x < width - padX; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      if (isLikelyJewelryPixel(r, g, b, a)) {
        mask[y * width + x] = 1;
      }
    }
  }

  const components = [];
  const queue = [];

  for (let y = padY; y < height - padY; y++) {
    for (let x = padX; x < width - padX; x++) {
      const start = y * width + x;
      if (!mask[start] || visited[start]) continue;

      let minX = x;
      let minY = y;
      let maxX = x;
      let maxY = y;
      let area = 0;
      let sumX = 0;
      let sumY = 0;

      queue.length = 0;
      queue.push(start);
      visited[start] = 1;

      for (let qi = 0; qi < queue.length; qi++) {
        const p = queue[qi];
        const px = p % width;
        const py = Math.floor(p / width);

        area++;
        sumX += px;
        sumY += py;
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const nx = px + dx;
            const ny = py + dy;
            if (nx < padX || nx >= width - padX || ny < padY || ny >= height - padY) continue;

            const ni = ny * width + nx;
            if (!mask[ni] || visited[ni]) continue;

            visited[ni] = 1;
            queue.push(ni);
          }
        }
      }

      const boxW = maxX - minX + 1;
      const boxH = maxY - minY + 1;
      if (area < 35 || boxW < width * 0.08 || boxH < height * 0.06) continue;

      components.push({
        minX,
        minY,
        maxX,
        maxY,
        area,
        boxW,
        boxH,
        cx: sumX / area,
        cy: sumY / area
      });
    }
  }

  if (!components.length) return null;

  const expectedX = width * 0.50;
  const expectedY = height * 0.48;

  const scored = components
    .filter((component) => {
      const tooLow = component.cy > height * 0.88;
      const tooHigh = component.cy < height * 0.02;
      const tooThin = component.boxW < width * 0.10 || component.boxH < height * 0.08;
      return !tooLow && !tooHigh && !tooThin;
    })
    .map((component) => {
      const distX = Math.abs(component.cx - expectedX) / width;
      const distY = Math.abs(component.cy - expectedY) / height;
      const shapeBonus = Math.min(component.boxW, component.boxH) / Math.max(component.boxW, component.boxH);
      const areaScore = Math.sqrt(component.area);
      const score = areaScore + shapeBonus * 22 - distX * 35 - distY * 45;
      return { ...component, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0] || components.sort((a, b) => b.area - a.area)[0];
  if (!best) return null;

  let { minX, minY, maxX, maxY } = best;
  const boxW = maxX - minX;
  const boxH = maxY - minY;

  if (boxW < width * 0.10 || boxH < height * 0.08) return null;

  const margin = Math.round(Math.max(boxW, boxH) * 0.18);
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(width - 1, maxX + margin);
  maxY = Math.min(height - 1, maxY + margin);

  return { minX, minY, maxX, maxY };
}

function drawJewelryOnlyOutput(sourceCanvas) {
  const output = document.createElement("canvas");
  const size = 720;
  output.width = size;
  output.height = size;

  const out = output.getContext("2d", { alpha: false });
  out.fillStyle = "#ffffff";
  out.fillRect(0, 0, size, size);
  out.imageSmoothingEnabled = true;
  out.imageSmoothingQuality = "high";

  const bounds = findJewelryBounds(sourceCanvas);

  let sx = 0;
  let sy = 0;
  let sw = sourceCanvas.width;
  let sh = sourceCanvas.height;

  if (bounds) {
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    const side = Math.min(
      Math.max(bw, bh) * 1.10,
      Math.max(sourceCanvas.width, sourceCanvas.height)
    );

    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;

    sx = Math.round(cx - side / 2);
    sy = Math.round(cy - side / 2);
    sw = Math.round(side);
    sh = Math.round(side);

    if (sx < 0) sx = 0;
    if (sy < 0) sy = 0;
    if (sx + sw > sourceCanvas.width) sx = Math.max(0, sourceCanvas.width - sw);
    if (sy + sh > sourceCanvas.height) sy = Math.max(0, sourceCanvas.height - sh);
    sw = Math.min(sw, sourceCanvas.width - sx);
    sh = Math.min(sh, sourceCanvas.height - sy);
  }

  const margin = Math.round(size * 0.08);
  const available = size - margin * 2;
  out.drawImage(sourceCanvas, sx, sy, sw, sh, margin, margin, available, available);

  return output;
}

async function extractProductPhotosFromPage(page, content, pageNumber) {
  /*
   * Captura automática das fotos do relatório:
   * - renderiza a página em alta escala;
   * - localiza os códigos dos produtos;
   * - recorta a coluna visual das miniaturas;
   * - limpa o recorte para manter somente a joia, removendo texto/linhas do PDF;
   * - gera arquivo para envio e DataURL de segurança para exibição imediata.
   */
  const scale = 3.35;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport }).promise;

  const entries = productCodeEntries(content, viewport, pageNumber);
  const photos = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];

    /*
     * Molde Glamore v16:
     * A foto da joia fica antes do código do produto, entre x≈40 e x≈91
     * no PDF original. O recorte antigo pegava o código, a palavra Observação
     * e até pedaços da próxima linha. Este recorte inicial já corta somente
     * a célula visual da foto; depois o detector de pixels dourados faz o
     * enquadramento fino da joia.
     */
    const cropX = Math.max(0, Math.round(39 * scale));
    const cropW = Math.round(53 * scale);

    const estimatedY = Number(entry.viewY || 0);
    let cropY = Math.round(estimatedY * 1);
    const cropH = Math.round(46 * scale);

    if (cropY < 0) cropY = 0;
    if (cropY + cropH > canvas.height) cropY = Math.max(0, canvas.height - cropH);

    const source = document.createElement("canvas");
    source.width = cropW;
    source.height = cropH;
    const src = source.getContext("2d", { alpha: false });
    src.fillStyle = "#ffffff";
    src.fillRect(0, 0, source.width, source.height);
    src.imageSmoothingEnabled = true;
    src.imageSmoothingQuality = "high";
    src.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const output = drawJewelryOnlyOutput(source);

    const blob = await canvasToBlob(output, "image/jpeg", 0.92);
    const dataUrl = canvasToDataUrl(output, "image/jpeg", 0.86);
    const file = buildImageFile(blob, `${entry.codigo}-${pageNumber}-${index + 1}`);
    const previewUrl = dataUrl || URL.createObjectURL(blob);

    photos.push({
      ...entry,
      fotoArquivo: file,
      fotoPreviewUrl: previewUrl,
      fotoDataUrl: dataUrl,
      fotoArquivoNome: file.name || `${safeImageName(entry.codigo)}.jpg`,
      fotoExtraidaDoPdf: true,
      fotoRecorte: "joia_apenas_v16_recorte_preciso"
    });
  }

  return photos;
}

export async function extractPdf(file, options = {}) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("Nenhum PDF foi recebido pelo importador. Selecione o arquivo PDF novamente.");
  }

  const fileName = String(file.name || "").toLowerCase();
  const fileType = String(file.type || "").toLowerCase();
  if (!fileName.endsWith(".pdf") && !fileType.includes("pdf")) {
    throw new Error("O arquivo selecionado não é um PDF válido.");
  }

  if (Number(file.size || 0) <= 0) {
    throw new Error("O PDF selecionado está vazio.");
  }

  if (!window.pdfjsLib) {
    throw new Error("PDF.js não carregou. Verifique a conexão com a internet ou o CDN no index.html.");
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const buffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buffer }).promise;

  const pages = [];
  const allLines = [];
  const allPhotos = [];
  const shouldExtractPhotos = options.extrairFotos !== false;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = groupPdfItemsIntoLines(content.items);
    pages.push({ pageNumber, lines });
    allLines.push(...lines);

    if (shouldExtractPhotos && typeof document !== "undefined") {
      try {
        const photos = await extractProductPhotosFromPage(page, content, pageNumber);
        allPhotos.push(...photos);
      } catch (err) {
        console.warn("Fotos do PDF não foram capturadas nesta página:", err);
      }
    }
  }

  const header = parseHeader(allLines);
  const itens = parseItems(allLines);
  const totais = parseTotals(allLines);

  const photosByCode = new Map();
  allPhotos.forEach((photo, index) => {
    const key = `${photo.codigo || ""}_${photosByCode.size}`;
    photosByCode.set(key, photo);
  });

  itens.forEach((item, index) => {
    /*
     * Mantém o pareamento visual na ordem do relatório, mas carrega também
     * a DataURL de segurança para que a foto apareça mesmo se o envio externo
     * de imagem ainda não estiver liberado.
     */
    const photo = allPhotos[index];
    if (!photo) return;
    item.fotoPreviewUrl = photo.fotoPreviewUrl || photo.fotoDataUrl || "";
    item.fotoDataUrl = photo.fotoDataUrl || "";
    item.fotoArquivo = photo.fotoArquivo;
    item.fotoArquivoNome = photo.fotoArquivoNome;
    item.fotoExtraidaDoPdf = true;
  });

  return {
    arquivoNome: file.name,
    importadoEm: new Date().toISOString(),
    paginas: pdf.numPages,
    header,
    itens,
    fotosExtraidas: itens.filter((item) => item.fotoExtraidaDoPdf).length,
    totais,
    textoExtraido: allLines.join("\n"),
    pages
  };
}

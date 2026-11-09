let EXECUCAO_ATUAL = null;
let HISTORICO_SHEET = null;
let INDICE_HISTORICO = null;

function iniciarExecucao_(modo, origem) {
  const agora = new Date();
  EXECUCAO_ATUAL = {
    id: "B" + Utilities.formatDate(agora, "America/Sao_Paulo", "yyyyMMdd-HHmmss"),
    dataHora: Utilities.formatDate(agora, "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss"),
    modo: modo || "",
    origem: origem || "busca",
    empresas: 0,
    contatosEnriquecidos: 0,
    contatosRetornados: 0,
    telefones: 0,
    corrigidas: 0,
    economizados: 0
  };
  HISTORICO_SHEET = prepararAbaHistorico_();
  return EXECUCAO_ATUAL;
}

function prepararAbaHistorico_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(SHEET_HISTORICO);
  if (!aba) {
    aba = ss.insertSheet(SHEET_HISTORICO);
    aba.appendRow(CABECALHO_HISTORICO);
    aba.getRange(1, 1, 1, CABECALHO_HISTORICO.length).setFontWeight("bold");
    aba.setFrozenRows(1);
  }
  return aba;
}

function prepararAbaExecucoes_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(SHEET_EXECUCOES);
  if (!aba) {
    aba = ss.insertSheet(SHEET_EXECUCOES);
    aba.appendRow(CABECALHO_EXECUCOES);
    aba.getRange(1, 1, 1, CABECALHO_EXECUCOES.length).setFontWeight("bold");
    aba.setFrozenRows(1);
  }
  return aba;
}

function contarEnriquecimento_(quantidade, querCelular) {
  if (!EXECUCAO_ATUAL) return;
  EXECUCAO_ATUAL.contatosEnriquecidos += quantidade;
  if (querCelular) EXECUCAO_ATUAL.telefones += quantidade;
}

function marcarEmpresaProcessada_() {
  if (EXECUCAO_ATUAL) EXECUCAO_ATUAL.empresas += 1;
}

function marcarEmpresasCorrigidas_(n) {
  if (EXECUCAO_ATUAL) EXECUCAO_ATUAL.corrigidas = n;
}

function registrarContatoHistorico_(linhaResultado, segmento, solicitante, dominio) {
  if (!HISTORICO_SHEET || !EXECUCAO_ATUAL) return;
  EXECUCAO_ATUAL.contatosRetornados += 1;
  HISTORICO_SHEET.appendRow(
    [EXECUCAO_ATUAL.id, EXECUCAO_ATUAL.dataHora, EXECUCAO_ATUAL.modo, segmento,
     solicitante || "", dominio || ""].concat(linhaResultado)
  );
}

function finalizarExecucao_() {
  if (!EXECUCAO_ATUAL) return;
  const e = EXECUCAO_ATUAL;
  const creditos = e.contatosEnriquecidos + e.telefones * 8;
  prepararAbaExecucoes_().appendRow([
    e.id, e.dataHora, e.modo, e.origem,
    e.empresas, e.contatosEnriquecidos, e.contatosRetornados,
    e.telefones, creditos, e.corrigidas, e.economizados
  ]);
  EXECUCAO_ATUAL = null;
  HISTORICO_SHEET = null;
  INDICE_HISTORICO = null;
}

function carregarIndiceHistorico_() {
  INDICE_HISTORICO = {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(SHEET_HISTORICO);
  if (!aba || aba.getLastRow() < 2) return;

  const dados = aba.getRange(2, 1, aba.getLastRow() - 1, CABECALHO_HISTORICO.length).getValues();
  const col = {};
  CABECALHO_HISTORICO.forEach((nome, i) => { col[nome] = i; });

  dados.forEach(linha => {
    const nome = (linha[col["Empresa (busca)"]] || "").toString().trim();
    const status = (linha[col["Status"]] || "").toString();
    const contato = (linha[col["Nome"]] || "").toString().trim();
    if (!nome || !contato || status.indexOf("OK") !== 0) return;

    const segmento = (linha[col["Segmento"]] || "").toString();
    const dataHora = (linha[col["Data/hora"]] || "").toString();
    const dominio = (linha[col["Domínio"]] || "").toString();
    const chave = normalizarNome_(nome) + "||" + segmento;
    const linhaResultado = linha.slice(col["Empresa (busca)"]);

    if (!INDICE_HISTORICO[chave] || dataHora > INDICE_HISTORICO[chave].dataHora) {
      INDICE_HISTORICO[chave] = { dataHora: dataHora, dominio: dominio, contatos: [] };
    }
    if (dataHora === INDICE_HISTORICO[chave].dataHora) {
      INDICE_HISTORICO[chave].contatos.push(linhaResultado);
    }
  });
}

function diasDesde_(dataHora) {
  const d = new Date(dataHora.replace(" ", "T"));
  if (isNaN(d.getTime())) return Infinity;
  return (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
}

function reaproveitarDoHistorico_(empresa, segmento, resultadosSheet, solicitante) {
  if (!INDICE_HISTORICO) return false;
  const chave = normalizarNome_(empresa) + "||" + segmento;
  const entrada = INDICE_HISTORICO[chave];
  if (!entrada || !entrada.contatos.length) return false;
  if (diasDesde_(entrada.dataHora) > DIAS_REAPROVEITAMENTO) return false;

  marcarEmpresaProcessada_();
  const nota = "Reaproveitado do histórico (busca de " + entrada.dataHora.substring(0, 10) + ")";
  entrada.contatos.forEach(orig => {
    const linha = orig.slice();
    linha[2] = nota;
    linha[12] = "";
    resultadosSheet.appendRow(linha);
    registrarContatoHistorico_(linha, segmento, solicitante, entrada.dominio);
    if (EXECUCAO_ATUAL) EXECUCAO_ATUAL.economizados += 1;
  });
  return true;
}

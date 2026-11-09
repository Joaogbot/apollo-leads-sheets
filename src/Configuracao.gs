function configurarApiKey() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    "Configurar API Key do Apollo",
    "Cole sua API Key do Apollo (Settings > API):",
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() == ui.Button.OK) {
    PropertiesService.getScriptProperties()
      .setProperty("APOLLO_API_KEY", resp.getResponseText().trim());
    ui.alert("API Key da Apollo salva com sucesso.");
  }
}

function getApiKey_() {
  const key = PropertiesService.getScriptProperties().getProperty("APOLLO_API_KEY");
  if (!key) {
    throw new Error("API Key do Apollo não configurada. Use o menu Apollo Leads > Configurar API Key (Apollo).");
  }
  return key;
}

function instalarPlanilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const criadas = [];
  const jaExistiam = [];

  [[SHEET_ENDEMICO, "empresas de games / cultura geek (endêmicas)"],
   [SHEET_NAO_ENDEMICO, "empresas de fora do setor (não-endêmicas)"]].forEach(par => {
    let aba = ss.getSheetByName(par[0]);
    if (!aba) {
      aba = ss.insertSheet(par[0]);
      aba.appendRow(["Empresa (nome ou domínio) — " + par[1]]);
      aba.getRange(1, 1, 1, 1).setFontWeight("bold");
      aba.setFrozenRows(1);
      aba.setColumnWidth(1, 340);
      criadas.push(par[0]);
    } else {
      jaExistiam.push(par[0]);
    }
  });

  let dep = ss.getSheetByName(SHEET_DEPARA);
  if (!dep) {
    dep = ss.insertSheet(SHEET_DEPARA);
    dep.appendRow(["Nome digitado (marca)", "Empresa ou domínio real", "Observação"]);
    dep.getRange(1, 1, 1, 3).setFontWeight("bold");
    dep.setFrozenRows(1);
    dep.autoResizeColumns(1, 3);
    criadas.push(SHEET_DEPARA);
  } else {
    jaExistiam.push(SHEET_DEPARA);
  }

  let res = ss.getSheetByName(SHEET_RESULTADOS);
  if (!res) {
    res = ss.insertSheet(SHEET_RESULTADOS);
    escreverCabecalhoResultados_(res);
    res.autoResizeColumns(1, TOTAL_COLUNAS);
    criadas.push(SHEET_RESULTADOS);
  } else {
    jaExistiam.push(SHEET_RESULTADOS);
  }

  try {
    ["Página1", "Pagina1", "Sheet1", "Folha1", "Hoja1", "Planilha1"].forEach(nome => {
      const padrao = ss.getSheetByName(nome);
      if (padrao && padrao.getLastRow() === 0 && ss.getSheets().length > 1) {
        ss.deleteSheet(padrao);
      }
    });
  } catch (err) {  }

  const alvo = ss.getSheetByName(SHEET_ENDEMICO);
  if (alvo) ss.setActiveSheet(alvo);

  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "Planilha instalada!",
    (criadas.length ? "Abas criadas: " + criadas.join(", ") + ".\n" : "") +
    (jaExistiam.length ? "Já existiam (mantidas): " + jaExistiam.join(", ") + ".\n" : "") +
    "\nPróximo passo: Apollo Leads → Configurar API Key (Apollo).\n\n" +
    "Depois é só preencher os nomes das empresas nas abas \"" + SHEET_ENDEMICO +
    "\" e/ou \"" + SHEET_NAO_ENDEMICO + "\" (coluna A, a partir da linha 2) e usar Buscar Contatos.",
    ui.ButtonSet.OK
  );
}

function criarAbaDePara() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(SHEET_DEPARA);

  if (!aba) {
    aba = ss.insertSheet(SHEET_DEPARA);
    aba.appendRow(["Nome digitado (marca)", "Empresa ou domínio real", "Observação"]);
    aba.getRange(1, 1, 1, 3).setFontWeight("bold");
    aba.setFrozenRows(1);
    aba.autoResizeColumns(1, 3);
  }

  ss.setActiveSheet(aba);
  SpreadsheetApp.getUi().alert(
    "Aba \"" + SHEET_DEPARA + "\" pronta.\n\n" +
    "Use ela para marcas que não são empresas no Apollo.\n" +
    "Coluna A: o nome que as pessoas digitam (a marca)\n" +
    "Coluna B: a empresa ou domínio real\n\n" +
    "O que estiver aqui tem prioridade sobre a busca automática."
  );
}

function carregarDePara_() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_DEPARA);
  const mapa = {};
  if (!aba || aba.getLastRow() < 2) return mapa;

  const dados = aba.getRange(2, 1, aba.getLastRow() - 1, 2).getValues();
  dados.forEach(linha => {
    const de = (linha[0] || "").toString().trim();
    const para = (linha[1] || "").toString().trim();
    if (de && para) mapa[de.toLowerCase()] = para;
  });
  return mapa;
}

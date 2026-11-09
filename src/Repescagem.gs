function repescagemAtiva_() {
  return PropertiesService.getScriptProperties()
    .getProperty("REPESCAGEM_ATIVA") === "sim";
}

function alternarRepescagem() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  if (repescagemAtiva_()) {
    props.setProperty("REPESCAGEM_ATIVA", "nao");
    ui.alert("Repescagem DESLIGADA.\n\nAs buscas vão direto para a aba Resultados. " +
             "A aba Repescagem ainda é preenchida como registro, e você pode trocar " +
             "o X e usar 'Busca corrigida' depois.");
  } else {
    props.setProperty("REPESCAGEM_ATIVA", "sim");
    ui.alert("Repescagem LIGADA.\n\n'Buscar Contatos' vai parar na aba Repescagem " +
             "para você revisar qual empresa é a certa (marque o X). Depois use " +
             "'Confirmar repescagem' para gerar os resultados.");
  }
}

function prepararAbaRepescagem_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let aba = ss.getSheetByName(SHEET_REPESCAGEM);
  if (!aba) aba = ss.insertSheet(SHEET_REPESCAGEM);
  aba.clear();
  aba.appendRow([
    "Nome buscado", "Aba", "X (escolha)", "Empresa (Apollo)", "Domínio",
    "Seguidores LinkedIn", "Setor"
  ]);
  aba.getRange(1, 1, 1, 7).setFontWeight("bold");
  aba.setFrozenRows(1);
  return aba;
}

function registrarCandidatasRepescagem_(abaRep, nomeBuscado, aba, candidatas, escolhidaX) {
  if (!candidatas.length) return null;

  const domEscolhido = escolhidaX && escolhidaX.dominio ? limparDominio_(escolhidaX.dominio) : null;
  let marcou = false;

  candidatas.forEach((c) => {
    const dom = c.dominio ? limparDominio_(c.dominio) : "";
    let marca = "";
    if (domEscolhido && dom === domEscolhido && !marcou) {
      marca = "X"; marcou = true;
    }
    abaRep.appendRow([nomeBuscado, aba, marca, c.nome, c.dominio, c.seguidores, c.setor]);
  });

  if (!marcou) {
    const primeiraLinha = abaRep.getLastRow() - candidatas.length + 1;
    abaRep.getRange(primeiraLinha, 3).setValue("X");
  }

  abaRep.appendRow(["", "", "", "", "", "", ""]);
  return escolhidaX || candidatas[0];
}

function lerEscolhasRepescagem_() {
  const aba = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_REPESCAGEM);
  const escolhas = {};
  if (!aba || aba.getLastRow() < 2) return escolhas;

  const dados = aba.getRange(2, 1, aba.getLastRow() - 1, 7).getValues();
  dados.forEach(linha => {
    const nome = (linha[0] || "").toString().trim();
    const abaOrigem = (linha[1] || "").toString().trim();
    const marca = (linha[2] || "").toString().trim().toLowerCase();
    const empresaNome = (linha[3] || "").toString().trim();
    const dominio = (linha[4] || "").toString().trim();
    if (!nome || marca !== "x" || !dominio) return;
    escolhas[chaveRepescagem_(nome, abaOrigem)] = { dominio: dominio, nome: empresaNome };
  });
  return escolhas;
}

function chaveRepescagem_(nome, aba) {
  return nome.toLowerCase() + "||" + aba.toLowerCase();
}

function buscarContatosParaTodasEmpresas_ComRepescagem_(modoSP, rotulo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaRep = prepararAbaRepescagem_();
  const dePara = carregarDePara_();
  let total = 0;

  [[SHEET_NAO_ENDEMICO, "NE"], [SHEET_ENDEMICO, "E"]].forEach(par => {
    const aba = ss.getSheetByName(par[0]);
    if (!aba || aba.getLastRow() < 2) return;
    const nomes = aba.getRange(2, 1, aba.getLastRow() - 1, 1).getValues()
      .flat().filter(v => v && v.toString().trim());

    nomes.forEach(nomeRaw => {
      const nome = nomeRaw.toString().trim();
      const alvo = resolverEmpresa_(nome, dePara);
      if (alvo.dominio) {
        abaRep.appendRow([nome, par[1], "X", alvo.nome || nome, alvo.dominio, "(resolvido direto)", ""]);
        abaRep.appendRow(["", "", "", "", "", "", ""]);
      } else {
        const res = resolverNomeParaAlvo_(alvo.nome, alvo.origem);
        if (res.candidatas.length) {
          registrarCandidatasRepescagem_(abaRep, nome, par[1], res.candidatas, res.escolhidaX);
        } else {
          const dom = res.alvo.dominio || (res.alvo.dominios && res.alvo.dominios[0]) || "";
          abaRep.appendRow([nome, par[1], "X", res.alvo.nome || nome, dom, "(" + (res.alvo.origem || "resolvido") + ")", ""]);
          abaRep.appendRow(["", "", "", "", "", "", ""]);
        }
      }
      total++;
      Utilities.sleep(300);
    });
  });

  abaRep.autoResizeColumns(1, 7);
  ss.setActiveSheet(abaRep);
  PropertiesService.getScriptProperties().setProperty("REPESCAGEM_MODO_SP", modoSP ? "sim" : "nao");
  PropertiesService.getScriptProperties().setProperty("REPESCAGEM_ROTULO", rotulo);

  SpreadsheetApp.getUi().alert(
    `Encontrei candidatas para ${total} empresa(s).\n\n` +
    "Revise a aba Repescagem: o X marca a empresa escolhida automaticamente " +
    "(a mais relevante). Mova o X se quiser outra.\n\n" +
    "Depois use 'Apollo Leads → Confirmar repescagem' para buscar os contatos."
  );
}

function confirmarRepescagem() {
  const props = PropertiesService.getScriptProperties();
  const modoSP = props.getProperty("REPESCAGEM_MODO_SP") === "sim";
  const escolhas = lerEscolhasRepescagem_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let resultadosSheet = ss.getSheetByName(SHEET_RESULTADOS);
  if (!resultadosSheet) resultadosSheet = ss.insertSheet(SHEET_RESULTADOS);
  resultadosSheet.clear();
  escreverCabecalhoResultados_(resultadosSheet);

  const dePara = carregarDePara_();
  let total = 0;

  [[SHEET_NAO_ENDEMICO, "NE", false], [SHEET_ENDEMICO, "E", true]].forEach(par => {
    const aba = ss.getSheetByName(par[0]);
    if (!aba || aba.getLastRow() < 2) return;
    const nomes = aba.getRange(2, 1, aba.getLastRow() - 1, 1).getValues()
      .flat().filter(v => v && v.toString().trim());

    nomes.forEach(nomeRaw => {
      const nome = nomeRaw.toString().trim();
      const escolha = escolhas[chaveRepescagem_(nome, par[1])];
      try {
        processarEmpresaComEscolha_(nome, resultadosSheet, par[2], dePara, modoSP, escolha);
      } catch (err) {
        resultadosSheet.appendRow([nome, "", "", "", "", "", "", "", "", "", "", "ERRO: " + err.message, "", ""]);
      }
      total++;
      Utilities.sleep(400);
    });
  });

  resultadosSheet.autoResizeColumns(1, TOTAL_COLUNAS);
  SpreadsheetApp.getUi().alert(`Repescagem confirmada: ${total} empresa(s) processada(s). Veja a aba Resultados.`);
}

function buscaCorrigida() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resultadosSheet = ss.getSheetByName(SHEET_RESULTADOS);
  if (!resultadosSheet || resultadosSheet.getLastRow() < 2) {
    ui.alert("Aba Resultados vazia. Rode uma busca primeiro.");
    return;
  }

  const escolhas = lerEscolhasRepescagem_();
  if (!Object.keys(escolhas).length) {
    ui.alert("Nenhuma escolha marcada com X na aba Repescagem.");
    return;
  }

  const props = PropertiesService.getScriptProperties();
  const modoSP = props.getProperty("REPESCAGEM_MODO_SP") === "sim";
  const dePara = carregarDePara_();

  const dados = resultadosSheet.getRange(2, 1, resultadosSheet.getLastRow() - 1, TOTAL_COLUNAS).getValues();
  const nomesParaRefazer = {};

  Object.keys(escolhas).forEach(chave => {
    const nomeBuscado = chave.split("||")[0];
    const linhasDoNome = dados.filter(d => (d[0] || "").toString().trim().toLowerCase() === nomeBuscado);
    const dominioEscolhido = escolhas[chave].dominio.toLowerCase();
    const nomeEscolhido = (escolhas[chave].nome || "").toLowerCase();

    const jaBate = linhasDoNome.some(d => {
      const resolvida = (d[2] || "").toString().toLowerCase();
      return resolvida.indexOf(dominioEscolhido) !== -1 ||
             (nomeEscolhido && resolvida.indexOf(nomeEscolhido) !== -1);
    });
    if (!jaBate && linhasDoNome.length) nomesParaRefazer[chave] = true;
  });

  const chaves = Object.keys(nomesParaRefazer);
  if (!chaves.length) {
    ui.alert("Nada a corrigir: os X marcados já correspondem ao que está na aba Resultados.");
    return;
  }

  const resp = ui.alert(
    "Busca corrigida",
    `${chaves.length} empresa(s) tiveram o X alterado e serão refeitas.\n` +
    "As linhas antigas delas na aba Resultados serão substituídas. Continuar?",
    ui.ButtonSet.YES_NO
  );
  if (resp !== ui.Button.YES) return;

  let refeitas = 0;
  chaves.forEach(chave => {
    const partes = chave.split("||");
    const nomeBuscado = partes[0];
    const abaOrigem = partes[1];
    const isEndemico = abaOrigem === "e";

    removerLinhasDaEmpresa_(resultadosSheet, nomeBuscado);
    try {
      processarEmpresaComEscolha_(
        acharNomeOriginal_(nomeBuscado, abaOrigem) || nomeBuscado,
        resultadosSheet, isEndemico, dePara, modoSP, escolhas[chave]
      );
      refeitas++;
    } catch (err) {
      resultadosSheet.appendRow([nomeBuscado, "", "", "", "", "", "", "", "", "", "", "ERRO: " + err.message, "", ""]);
    }
    Utilities.sleep(400);
  });

  ui.alert(`Busca corrigida: ${refeitas} empresa(s) refeita(s) na aba Resultados.`);
}

function removerLinhasDaEmpresa_(sheet, nomeBuscado) {
  const last = sheet.getLastRow();
  if (last < 2) return;
  const col = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (let i = col.length - 1; i >= 0; i--) {
    if ((col[i][0] || "").toString().trim().toLowerCase() === nomeBuscado.toLowerCase()) {
      sheet.deleteRow(i + 2);
    }
  }
}

function acharNomeOriginal_(nomeMinusculo, abaOrigem) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nomeAba = abaOrigem === "e" ? SHEET_ENDEMICO : SHEET_NAO_ENDEMICO;
  const aba = ss.getSheetByName(nomeAba);
  if (!aba || aba.getLastRow() < 2) return null;
  const nomes = aba.getRange(2, 1, aba.getLastRow() - 1, 1).getValues().flat();
  for (let i = 0; i < nomes.length; i++) {
    if ((nomes[i] || "").toString().trim().toLowerCase() === nomeMinusculo) {
      return nomes[i].toString().trim();
    }
  }
  return null;
}

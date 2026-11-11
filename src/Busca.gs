function buscarContatosParaTodasEmpresas() {
  executarBusca_(false, "Brasil");
}

function buscarContatosSP() {
  executarBusca_(true, "São Paulo");
}

function executarBusca_(modoSP, rotulo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaEndemico = ss.getSheetByName(SHEET_ENDEMICO);
  const abaNaoEndemico = ss.getSheetByName(SHEET_NAO_ENDEMICO);

  if (!abaEndemico && !abaNaoEndemico) {
    throw new Error(`Crie ao menos uma das abas "${SHEET_ENDEMICO}" ou "${SHEET_NAO_ENDEMICO}" com o nome/domínio das empresas na coluna A.`);
  }

  if (repescagemAtiva_()) {
    buscarContatosParaTodasEmpresas_ComRepescagem_(modoSP, rotulo);
    return;
  }

  const dePara = carregarDePara_();
  const abaRep = prepararAbaRepescagem_();

  let resultadosSheet = ss.getSheetByName(SHEET_RESULTADOS);
  if (!resultadosSheet) {
    resultadosSheet = ss.insertSheet(SHEET_RESULTADOS);
  }
  resultadosSheet.clear();
  escreverCabecalhoResultados_(resultadosSheet);

  iniciarExecucao_(rotulo, "busca");
  carregarIndiceHistorico_();

  let total = 0;
  if (abaNaoEndemico) total += processarAba_(abaNaoEndemico, resultadosSheet, false, dePara, modoSP, abaRep, "NE");
  if (abaEndemico) total += processarAba_(abaEndemico, resultadosSheet, true, dePara, modoSP, abaRep, "E");

  finalizarExecucao_();

  if (total === 0) {
    SpreadsheetApp.getUi().alert("Nenhuma empresa encontrada nas abas de entrada (coluna A, a partir da linha 2).");
    return;
  }

  resultadosSheet.autoResizeColumns(1, TOTAL_COLUNAS);
  abaRep.autoResizeColumns(1, 7);
  SpreadsheetApp.getUi().alert(
    `Busca (${rotulo}) concluída! Confira a aba "${SHEET_RESULTADOS}".\n\n` +
    "A aba Repescagem mostra as empresas encontradas, com X na escolhida. " +
    "Se quiser trocar alguma, mova o X e use 'Busca corrigida'."
  );
}

function escreverCabecalhoResultados_(sheet) {
  sheet.appendRow([
    "Empresa (busca)", "Empresa real (Apollo)", "Como foi resolvida", "Nome",
    "Cargo", "Nível do cargo", "País", "Email", "Telefone", "LinkedIn",
    "Relacionado a Games", "Status", "Status Envio", "ID Apollo"
  ]);
  sheet.getRange(1, 1, 1, TOTAL_COLUNAS).setFontWeight("bold");
  sheet.setFrozenRows(1);
  const regra = SpreadsheetApp.newDataValidation()
    .requireValueInList(Object.keys(ORDEM_STATUS_ENVIO).filter(s => s), true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, COL.STATUS_ENVIO, sheet.getMaxRows() - 1, 1).setDataValidation(regra);
}

function processarAba_(abaEmpresas, resultadosSheet, isEndemico, dePara, modoSP, abaRep, rotuloAba) {
  if (abaEmpresas.getLastRow() < 2) return 0;

  const autores = autoresDaAba_(abaEmpresas);
  const empresas = abaEmpresas
    .getRange(2, 1, abaEmpresas.getLastRow() - 1, 1)
    .getValues()
    .flat()
    .filter(v => v && v.toString().trim() !== "");

  empresas.forEach(empresa => {
    const nome = empresa.toString().trim();
    const solicitante = autores[nome.toLowerCase()] || "";
    try {
      if (!reaproveitarDoHistorico_(nome, rotuloAba, resultadosSheet, solicitante)) {
        processarEmpresa_(nome, resultadosSheet, isEndemico, dePara, modoSP, abaRep, rotuloAba, solicitante);
        Utilities.sleep(400);
      }
    } catch (err) {
      resultadosSheet.appendRow([nome, "", "", "", "", "", "", "", "", "", "", "ERRO: " + err.message, "", ""]);
    }
  });

  return empresas.length;
}

function processarEmpresa_(empresa, resultadosSheet, isEndemico, dePara, modoSP, abaRep, rotuloAba, solicitante) {
  const alvoInicial = resolverEmpresa_(empresa, dePara);
  let escolha = null;

  if (alvoInicial.dominio) {

    if (abaRep) {
      abaRep.appendRow([empresa, rotuloAba || "", "X", alvoInicial.nome || empresa, alvoInicial.dominio, "(resolvido direto)", ""]);
      abaRep.appendRow(["", "", "", "", "", "", ""]);
    }
    escolha = { dominios: [alvoInicial.dominio], nome: alvoInicial.nome || empresa };
  } else {

    const res = resolverNomeParaAlvo_(alvoInicial.nome, alvoInicial.origem);

    if (abaRep) {
      if (res.candidatas.length) {
        registrarCandidatasRepescagem_(abaRep, empresa, rotuloAba || "", res.candidatas, res.escolhidaX);
      } else {
        const dom = res.alvo.dominio || (res.alvo.dominios && res.alvo.dominios[0]) || "";
        abaRep.appendRow([empresa, rotuloAba || "", "X", res.alvo.nome || empresa, dom, "(" + (res.alvo.origem || "resolvido") + ")", ""]);
        abaRep.appendRow(["", "", "", "", "", "", ""]);
      }
    }

    if (res.alvo.dominios && res.alvo.dominios.length) {
      escolha = { dominios: res.alvo.dominios, nome: res.alvo.nome };
    } else if (res.alvo.dominio) {
      escolha = { dominios: [res.alvo.dominio], nome: res.alvo.nome };
    }

  }

  processarEmpresaComEscolha_(empresa, resultadosSheet, isEndemico, dePara, modoSP, escolha, solicitante);
}

function processarEmpresaComEscolha_(empresa, resultadosSheet, isEndemico, dePara, modoSP, escolha, solicitante) {
  marcarEmpresaProcessada_();
  const segmento = isEndemico ? "E" : "NE";
  let alvo = resolverEmpresa_(empresa, dePara);

  if (escolha && (escolha.dominios || escolha.dominio)) {
    const doms = escolha.dominios || [escolha.dominio];
    alvo = {
      dominios: doms,
      dominio: doms[0],
      nome: escolha.nome || alvo.nome,
      origem: alvo.origem + " → " + (escolha.nome || doms[0]) +
              (doms.length > 1 ? " (+" + (doms.length - 1) + " domínios do grupo)" : "")
    };
  }

  const dominioAlvo = alvo.dominio || (alvo.dominios && alvo.dominios[0]) || "";
  const selecionados = buscarPessoasPorHierarquia_(alvo, modoSP);

  let origemFinal = alvo.origem;
  if (selecionados.alvoUsado && descreverAlvo_(selecionados.alvoUsado) !== descreverAlvo_(alvo)) {
    origemFinal += " [busca ampliada: " + descreverAlvo_(selecionados.alvoUsado) + "]";
  }

  if (selecionados.length === 0) {
    const linha = [
      empresa, "", origemFinal, "", "", "", "", "", "", "", "",
      "Nenhum contato encontrado nos cargos-alvo", "", ""
    ];
    resultadosSheet.appendRow(linha);
    registrarContatoHistorico_(linha, segmento, solicitante, dominioAlvo);
    return;
  }

  selecionados.forEach(p => {
    const org = p.organization || {};
    const linha = [
      empresa,
      org.name || p.organization_name || "(não identificada)",
      origemFinal,
      p.name || "",
      p.title || "",
      p.nivelCargo || "",
      p.country || "",
      p.email || "(sem email)",
      p.phone || "(não revelado)",
      p.linkedin_url || "",
      isEndemico ? classificarGamingPorPalavraChave_(p) : "N/A (não-endêmico)",
      "OK",
      "",
      p.id || ""
    ];
    resultadosSheet.appendRow(linha);
    registrarContatoHistorico_(linha, segmento, solicitante, dominioAlvo);
  });
}

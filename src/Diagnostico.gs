function diagnosticarLista() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();

  const entradas = [];
  [[SHEET_ENDEMICO, "Empresas E"], [SHEET_NAO_ENDEMICO, "Empresas NE"]].forEach(par => {
    const aba = ss.getSheetByName(par[0]);
    if (!aba || aba.getLastRow() < 2) return;
    aba.getRange(2, 1, aba.getLastRow() - 1, 1).getValues().flat().forEach(v => {
      if (v && v.toString().trim()) entradas.push({ termo: v.toString().trim(), aba: par[1] });
    });
  });

  if (!entradas.length) {
    ui.alert("Nenhuma empresa nas abas de entrada.");
    return;
  }

  let diag = ss.getSheetByName(SHEET_DIAGNOSTICO);
  if (!diag) diag = ss.insertSheet(SHEET_DIAGNOSTICO);
  diag.clear();
  diag.appendRow([
    "Empresa (como digitada)", "Aba", "Caminho usado", "Entidade Wikidata",
    "Empresa-mãe encontrada", "Vai buscar por", "Situação"
  ]);
  diag.getRange(1, 1, 1, 7).setFontWeight("bold");
  diag.setFrozenRows(1);

  const dePara = carregarDePara_();

  entradas.forEach(item => {
    const linha = analisarTermo_(item.termo, dePara);
    diag.appendRow([
      item.termo, item.aba, linha.caminho, linha.entidade,
      linha.mae, linha.buscaPor, linha.situacao
    ]);
    Utilities.sleep(200);
  });

  diag.autoResizeColumns(1, 7);
  ss.setActiveSheet(diag);

  const problemas = diag.getRange(2, 7, entradas.length, 1).getValues()
    .filter(r => (r[0] || "").toString().indexOf("Atenção") === 0).length;

  ui.alert(
    `Diagnóstico pronto: ${entradas.length} empresas analisadas.\n` +
    `Precisam de atenção: ${problemas}\n\n` +
    (problemas
      ? "As marcadas com 'Atenção' provavelmente trarão pouco ou nenhum contato. " +
        "Cadastre essas na aba De-Para com o domínio correto."
      : "Todas resolveram para uma empresa identificável.")
  );
}

function analisarTermo_(termo, dePara) {
  const saida = { caminho: "", entidade: "", mae: "", buscaPor: "", situacao: "" };

  if (pareceDominio_(termo)) {
    saida.caminho = "Domínio informado";
    saida.buscaPor = "domínio: " + limparDominio_(termo);
    saida.situacao = "OK (busca exata)";
    return saida;
  }

  const destino = dePara[termo.toLowerCase()];
  if (destino) {
    saida.caminho = "De-Para (manual)";
    saida.buscaPor = pareceDominio_(destino)
      ? "domínio: " + limparDominio_(destino)
      : "nome: " + destino;
    saida.situacao = "OK (cadastrado manualmente)";
    return saida;
  }

  const res = resolverNomeParaAlvo_(termo, "Busca por nome");
  const doms = (res.alvo.dominios || (res.alvo.dominio ? [res.alvo.dominio] : [])).filter(Boolean);

  saida.entidade = res.candidatas.length
    ? res.candidatas.map(c => c.nome).slice(0, 4).join("; ")
    : "nenhuma candidata no Apollo";
  saida.mae = res.escolhidaX ? res.escolhidaX.nome + " (X)" : "";

  if (doms.length) {
    saida.caminho = res.alvo.origem || "Apollo";
    saida.buscaPor = "domínio(s): " + doms.join(", ");
    const exato = (res.alvo.origem || "").indexOf("match exato") !== -1;
    saida.situacao = exato ? "OK (match exato)" : "OK (empresa mais relevante, confira na Repescagem)";
  } else if (res.alvo.nome) {
    saida.caminho = res.alvo.origem || "Busca por nome";
    saida.buscaPor = "nome: " + res.alvo.nome;
    saida.situacao = "Atenção: nem o Apollo nem o Wikidata acharam a empresa. " +
                     "Confira o nome ou cadastre o domínio no De-Para.";
  }

  return saida;
}

function diagnosticarEmpresa() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    "Diagnóstico de uma empresa",
    "Digite o nome ou domínio da empresa para ver onde os contatos são perdidos\n" +
    "(não gasta crédito de enriquecimento):",
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const termo = resp.getResponseText().trim();
  if (!termo) return;

  const dePara = carregarDePara_();
  const inicial = resolverEmpresa_(termo, dePara);

  let alvo, candidatas = [];
  if (inicial.dominio) {
    alvo = { dominios: [inicial.dominio], dominio: inicial.dominio, nome: inicial.nome, origem: inicial.origem };
  } else {
    const res = resolverNomeParaAlvo_(inicial.nome, inicial.origem);
    alvo = res.alvo;
    candidatas = res.candidatas;
  }

  const linhas = ["EMPRESA: " + termo, "Resolvida como: " + (alvo.origem || inicial.origem), ""];
  if (alvo.dominios && alvo.dominios.length) {
    linhas.push("Domínios de busca: " + alvo.dominios.join(", "));
  } else if (alvo.dominio) {
    linhas.push("Domínio de busca: " + alvo.dominio);
  } else {
    linhas.push("Busca por nome: " + (alvo.nome || termo));
  }
  if (candidatas.length) {
    linhas.push("Candidatas no Apollo: " + candidatas.map(c => c.nome + " [" + c.dominio + "]").slice(0, 8).join("; "));
  }
  linhas.push("");

  const resultado = buscarComFallback_(alvo);
  linhas.push("Tentativas de busca (nome/domínio: total encontrado):");
  resultado.tentativas.forEach(t => linhas.push("  • " + t));

  const todos = resultado.pessoas;
  const alvoUsado = resultado.alvoUsado;

  linhas.push("");
  linhas.push("TOTAL bruto (todos os cargos, alvo final): " + todos.length);

  if (todos.length === 0) {
    linhas.push("");
    linhas.push("⚠ Nenhuma tentativa encontrou ninguém, mesmo com fallback.");
    linhas.push("Prováveis causas: o nome/domínio usado não corresponde ao");
    linhas.push("cadastro da empresa no Apollo, ou ela não tem ninguém nos");
    linhas.push("cargos-alvo (Marketing/Eventos/Sócio/CEO) catalogado lá.");
    linhas.push("Confira o domínio exato na página da empresa no Apollo e");
    linhas.push("cadastre no De-Para.");
    ui.alert("Diagnóstico: " + termo, linhas.join("\n"), ui.ButtonSet.OK);
    return;
  }

  const nomesEmpresas = {};
  todos.forEach(p => {
    const n = (p.organization_name || "(sem nome)") +
              (p.organization_domain ? " [" + p.organization_domain + "]" : "");
    nomesEmpresas[n] = (nomesEmpresas[n] || 0) + 1;
  });
  linhas.push("");
  linhas.push("Empregador ATUAL das pessoas encontradas:");
  Object.keys(nomesEmpresas).slice(0, 14).forEach(n => {
    linhas.push("  • " + n + " (" + nomesEmpresas[n] + ")");
  });

  if (!alvoUsado.dominio) {
    const ancora = identificarEmpresaAlvo_(todos, alvoUsado);
    const doGrupo = todos.filter(p => pertenceAoGrupo_(p, ancora));
    linhas.push("");
    linhas.push("Âncora de desambiguação: \"" + ancora + "\"");
    linhas.push("Após filtro de empresa: " + doGrupo.length + " contatos");
    if (doGrupo.length === 0) {
      linhas.push("");
      linhas.push("⚠ O filtro removeu TODOS. Cadastre o domínio no De-Para para forçar.");
    }
  } else {
    linhas.push("");
    linhas.push("Busca por domínio: sem filtro de desambiguação.");
  }

  ui.alert("Diagnóstico: " + termo, linhas.join("\n"), ui.ButtonSet.OK);
}

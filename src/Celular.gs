function buscaCelularAtiva_() {
  return PropertiesService.getScriptProperties()
    .getProperty("BUSCAR_CELULAR") === "sim";
}

function alternarBuscaCelular() {  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const ativo = buscaCelularAtiva_();

  if (ativo) {
    props.setProperty("BUSCAR_CELULAR", "nao");
    ui.alert("Busca de celular DESLIGADA.\n\nO custo volta a ser ~1 crédito por contato.");
    return;
  }

  const resp = ui.alert(
    "Ligar busca de celular?",
    "ATENÇÃO AO CUSTO: a Apollo cobra cerca de 8 créditos por celular " +
    "retornado, além do 1 crédito normal do contato.\n\n" +
    "Com 5 contatos por empresa, uma empresa pode custar ~45 créditos " +
    "em vez de ~5.\n\n" +
    "O celular também não vem na hora: depois de 'Buscar Contatos', " +
    "espere alguns minutos e use 'Buscar celulares pendentes'.\n\n" +
    "Deseja ligar?",
    ui.ButtonSet.YES_NO
  );

  if (resp === ui.Button.YES) {
    props.setProperty("BUSCAR_CELULAR", "sim");
    ui.alert("Busca de celular LIGADA.");
  }
}

function registrarRequestPendente_(requestId) {
  const props = PropertiesService.getScriptProperties();
  let lista = [];
  try {
    lista = JSON.parse(props.getProperty("REQUESTS_PENDENTES") || "[]");
  } catch (e) {
    lista = [];
  }
  if (lista.indexOf(requestId) === -1) lista.push(requestId);
  props.setProperty("REQUESTS_PENDENTES", JSON.stringify(lista));
}

function buscarCelularesPendentes() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RESULTADOS);

  if (!sheet) {
    ui.alert(`Aba "${SHEET_RESULTADOS}" não encontrada. Rode "Buscar Contatos" primeiro.`);
    return;
  }

  let pendentes = [];
  try {
    pendentes = JSON.parse(props.getProperty("REQUESTS_PENDENTES") || "[]");
  } catch (e) {
    pendentes = [];
  }

  if (!pendentes.length) {
    ui.alert("Nenhuma busca de celular pendente.\n\n" +
             "Ligue a opção de celular no menu e rode 'Buscar Contatos' primeiro.");
    return;
  }

  const telefones = {};
  const aindaPendentes = [];
  let consultas = 0;

  pendentes.forEach(requestId => {
    try {
      const payload = consultarWebhookResult_(requestId);
      if (payload === null) {
        aindaPendentes.push(requestId);
        return;
      }
      const achados = extrairTelefonesDoPayload_(payload);
      Object.keys(achados).forEach(id => { telefones[id] = achados[id]; });
      consultas++;
    } catch (err) {
      aindaPendentes.push(requestId);
    }
    Utilities.sleep(500);
  });

  const lastRow = sheet.getLastRow();
  let preenchidos = 0;

  if (lastRow >= 2) {
    const ids = sheet.getRange(2, COL.ID_APOLLO, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      const id = (ids[i][0] || "").toString().trim();
      if (id && telefones[id]) {
        sheet.getRange(i + 2, COL.TELEFONE).setValue(telefones[id]);
        preenchidos++;
      }
    }
  }

  props.setProperty("REQUESTS_PENDENTES", JSON.stringify(aindaPendentes));

  let semCelular = 0;
  if (!aindaPendentes.length && lastRow >= 2) {
    const telefones = sheet.getRange(2, COL.TELEFONE, lastRow - 1, 1).getValues();
    for (let i = 0; i < telefones.length; i++) {
      if ((telefones[i][0] || "").toString().indexOf("aguardando") === 0) {
        sheet.getRange(i + 2, COL.TELEFONE).setValue("(sem celular na base da Apollo)");
        semCelular++;
      }
    }
  }

  ui.alert(
    `Consultas concluídas: ${consultas}\n` +
    `Celulares preenchidos: ${preenchidos}\n` +
    `Ainda pendentes: ${aindaPendentes.length}\n` +
    (semCelular ? `Sem celular na base: ${semCelular}\n` : "") +
    "\n" +
    (aindaPendentes.length
      ? "Ainda há pedidos sendo processados pela Apollo. Espere alguns minutos e rode de novo."
      : "Tudo processado. As linhas marcadas como 'sem celular na base' não vão mudar - " +
        "a Apollo não tem esse número.")
  );
}

function consultarWebhookResult_(requestId) {
  const apiKey = getApiKey_();
  const url = "https://api.apollo.io/api/v1/webhook_result/" + encodeURIComponent(requestId);

  const resp = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { "X-Api-Key": apiKey, "Accept": "application/json" },
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  if (code === 404) return null;
  if (code !== 200) {
    throw new Error(`HTTP ${code}: ${resp.getContentText().substring(0, 150)}`);
  }

  return JSON.parse(resp.getContentText());
}

function extrairTelefonesDoPayload_(payload) {
  const encontrados = {};

  function melhorTelefone(obj) {
    const lista = obj.phone_numbers || obj.phone_number || [];
    if (Array.isArray(lista)) {
      for (let i = 0; i < lista.length; i++) {
        const item = lista[i];
        if (!item) continue;
        const tipo = (item.type || item.type_cd || "").toString().toLowerCase();
        const num = item.sanitized_number || item.raw_number || item.number;
        if (num && tipo.indexOf("mobile") !== -1) return num;
      }
      for (let i = 0; i < lista.length; i++) {
        const item = lista[i];
        const num = item && (item.sanitized_number || item.raw_number || item.number);
        if (num) return num;
      }
    }
    return obj.mobile_phone || obj.sanitized_phone || null;
  }

  function varrer(no) {
    if (!no || typeof no !== "object") return;

    if (Array.isArray(no)) {
      no.forEach(varrer);
      return;
    }

    if (no.id) {
      const tel = melhorTelefone(no);
      if (tel) encontrados[no.id.toString()] = tel;
    }

    Object.keys(no).forEach(k => varrer(no[k]));
  }

  varrer(payload);
  return encontrados;
}

function limparPendenciasCelular() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  let qtd = 0;
  try {
    qtd = JSON.parse(props.getProperty("REQUESTS_PENDENTES") || "[]").length;
  } catch (e) {
    qtd = 0;
  }

  const resp = ui.alert(
    "Limpar pendências de celular",
    `Existem ${qtd} request_id(s) guardados.\n\n` +
    "Apagar significa desistir de buscar esses celulares. Os créditos já " +
    "gastos na Apollo não voltam.\n\nDeseja apagar?",
    ui.ButtonSet.YES_NO
  );

  if (resp === ui.Button.YES) {
    props.setProperty("REQUESTS_PENDENTES", "[]");
    ui.alert("Pendências apagadas. Rode 'Buscar Contatos' de novo para gerar novos pedidos.");
  }
}

function diagnosticarCelular() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const linhas = [];

  linhas.push("Busca de celular: " + (buscaCelularAtiva_() ? "LIGADA" : "DESLIGADA"));
  linhas.push("webhook_url usado: " + (props.getProperty("WEBHOOK_URL") || WEBHOOK_URL_PADRAO));

  let pendentes = [];
  try {
    pendentes = JSON.parse(props.getProperty("REQUESTS_PENDENTES") || "[]");
  } catch (e) {
    pendentes = [];
  }
  linhas.push("request_ids guardados: " + pendentes.length);
  linhas.push("");

  if (!pendentes.length) {
    linhas.push("NENHUM request_id foi guardado.");
    linhas.push("Isso significa que a resposta do enriquecimento não trouxe esse");
    linhas.push("campo. Amostra da última resposta recebida:");
    linhas.push("");
    linhas.push(props.getProperty("ULTIMA_RESPOSTA_ENRIQ") || "(nenhuma registrada)");
  } else {
    pendentes.slice(0, 3).forEach(id => {
      linhas.push("--- request_id " + id + " ---");
      try {
        const url = "https://api.apollo.io/api/v1/webhook_result/" + encodeURIComponent(id);
        const resp = UrlFetchApp.fetch(url, {
          method: "get",
          headers: { "X-Api-Key": getApiKey_(), "Accept": "application/json" },
          muteHttpExceptions: true
        });
        linhas.push("HTTP " + resp.getResponseCode());
        linhas.push(resp.getContentText().substring(0, 300));
      } catch (err) {
        linhas.push("ERRO: " + err.message);
      }
      linhas.push("");
    });
    if (pendentes.length > 3) linhas.push("(mostrando os 3 primeiros de " + pendentes.length + ")");
  }

  ui.alert("Diagnóstico de celular", linhas.join("\n"), ui.ButtonSet.OK);
}

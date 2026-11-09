function enriquecerLote_(pessoas) {
  const apiKey = getApiKey_();
  const url = "https://api.apollo.io/api/v1/people/bulk_match";
  const querCelular = buscaCelularAtiva_();

  const payload = {
    reveal_personal_emails: true,
    reveal_phone_number: querCelular,
    details: pessoas.map(p => ({ id: p.id }))
  };

  if (querCelular) {
    payload.webhook_url = PropertiesService.getScriptProperties()
      .getProperty("WEBHOOK_URL") || WEBHOOK_URL_PADRAO;
  }

  const resp = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { "X-Api-Key": apiKey, "Accept": "application/json" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  if (code !== 200) {
    throw new Error(`Erro no enriquecimento (HTTP ${code}): ${resp.getContentText().substring(0, 200)}`);
  }

  contarEnriquecimento_(pessoas.length, querCelular);

  const data = JSON.parse(resp.getContentText());
  const matches = data.matches || [];

  const enriquecidas = pessoas.map((original, idx) => {
    const m = matches[idx] || {};
    const org = m.organization || null;

    return {
      id: original.id,
      name: m.name || original.name,
      title: m.title || original.title,
      linkedin_url: m.linkedin_url || original.linkedin_url,
      email: extrairEmail_(m),
      phone: extrairTelefone_(m, org, querCelular),
      organization: org,
      nivelCargo: original.nivelCargo || "",
      ordemCargo: original.ordemCargo,
      country: m.country || original.country || "",
      state: m.state || original.state || "",
      city: m.city || original.city || "",
      scoreNacionalidade: original.scoreNacionalidade,
      scoreLinhagem: original.scoreLinhagem,
      organization_name: (org && org.name) || original.organization_name || "",
      organization_id: (org && org.id) || original.organization_id || ""
    };
  });

  if (querCelular) {
    PropertiesService.getScriptProperties().setProperty(
      "ULTIMA_RESPOSTA_ENRIQ",
      resp.getContentText().substring(0, 400)
    );
    const reqId = extrairRequestId_(resp.getContentText());
    if (reqId) registrarRequestPendente_(reqId);
  }

  return {
    pessoas: enriquecidas,
    requestId: extrairRequestId_(resp.getContentText())
  };
}

function extrairRequestId_(textoResposta) {
  if (!textoResposta) return null;
  const m = textoResposta.match(/"request[_-]?ids?"\s*:\s*\[?\s*"?(-?[0-9a-zA-Z_-]+)"?/i);
  return m ? m[1] : null;
}

function extrairEmail_(match) {
  if (emailValido_(match.email)) return match.email;

  const listas = [match.contact_emails, match.personal_emails, match.emails];
  for (let i = 0; i < listas.length; i++) {
    const lista = listas[i];
    if (!Array.isArray(lista)) continue;
    for (let j = 0; j < lista.length; j++) {
      const item = lista[j];
      const valor = typeof item === "string" ? item : (item && (item.email || item.address));
      if (emailValido_(valor)) return valor;
    }
  }
  return null;
}

function emailValido_(email) {
  if (!email) return false;
  const e = email.toString().toLowerCase();
  if (e.indexOf("@") === -1) return false;
  if (e.indexOf("email_not_unlocked") !== -1) return false;
  if (e.indexOf("not_unlocked") !== -1) return false;
  if (e.indexOf("domain.com") !== -1 && e.indexOf("not") !== -1) return false;
  return true;
}

function extrairTelefone_(match, org, querCelular) {  const lista = match.phone_numbers || [];
  for (let i = 0; i < lista.length; i++) {
    const n = lista[i] && (lista[i].sanitized_number || lista[i].raw_number);
    if (n) return n;
  }

  if (querCelular) return "aguardando celular...";

  if (org) {
    const corporativo = org.sanitized_phone || org.phone ||
                        (org.primary_phone && org.primary_phone.number);
    if (corporativo) return corporativo + " (telefone da empresa)";
  }

  return "(não revelado)";
}

function classificarGamingPorPalavraChave_(pessoa) {
  const org = pessoa.organization || {};
  const texto = [
    org.industry || "",
    (org.industries || []).join(" "),
    (org.keywords || []).join(" ")
  ].join(" ").toLowerCase();

  if (!texto.trim()) return "Verificar manualmente (sem dados de setor)";

  return PALAVRAS_GAMING.some(p => texto.indexOf(p) !== -1) ? "Sim" : "Não";
}

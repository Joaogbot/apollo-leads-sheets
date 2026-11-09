function resolverViaWikidata_(termo) {
  const chave = termo.toLowerCase();
  if (CACHE_WIKIDATA.hasOwnProperty(chave)) return CACHE_WIKIDATA[chave];

  const entidade = buscarEntidadeWikidata_(termo);
  if (!entidade) {
    CACHE_WIKIDATA[chave] = null;
    return null;
  }

  const claims = obterClaimsWikidata_(entidade.id);
  if (!claims) {
    CACHE_WIKIDATA[chave] = null;
    return null;
  }

  const idDona = primeiroItemDeClaim_(claims, "P749") || primeiroItemDeClaim_(claims, "P127");

  if (idDona) {
    const claimsDona = obterClaimsWikidata_(idDona);
    const site = claimsDona ? primeiroValorDeClaim_(claimsDona, "P856") : null;

    let nomeDona = null;
    try {
      nomeDona = obterRotuloWikidata_(idDona);
    } catch (err) {
      nomeDona = null;
    }

    if (site) {
      const resultado = {
        dominio: limparDominio_(site),
        nome: null,
        origem: `Wikidata: ${termo} → ${nomeDona || idDona}`
      };
      CACHE_WIKIDATA[chave] = resultado;
      return resultado;
    }

    if (nomeDona) {
      const resultado = {
        dominio: null,
        nome: nomeDona,
        origem: `Wikidata: ${termo} → ${nomeDona} (por nome, sem site)`
      };
      CACHE_WIKIDATA[chave] = resultado;
      return resultado;
    }
  }

  const sitePropio = primeiroValorDeClaim_(claims, "P856");
  if (sitePropio) {
    const resultado = {
      dominio: limparDominio_(sitePropio),
      nome: null,
      origem: `Wikidata: site oficial de ${entidade.label || termo}`
    };
    CACHE_WIKIDATA[chave] = resultado;
    return resultado;
  }

  CACHE_WIKIDATA[chave] = null;
  return null;
}

function buscarEntidadeWikidata_(termo) {
  const idiomas = ordenarIdiomasPorEscrita_(termo);

  for (let i = 0; i < idiomas.length; i++) {
    const url = "https://www.wikidata.org/w/api.php" +
      "?action=wbsearchentities&format=json&type=item&limit=1" +
      "&language=" + idiomas[i] + "&uselang=" + idiomas[i] +
      "&search=" + encodeURIComponent(termo);

    const resp = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { "User-Agent": "apollo-leads-sheets/1.0" }
    });

    if (resp.getResponseCode() !== 200) continue;

    const lista = JSON.parse(resp.getContentText()).search || [];
    if (lista.length) {
      const achado = lista[0];
      achado.idiomaUsado = idiomas[i];
      return achado;
    }
  }

  return null;
}

function ordenarIdiomasPorEscrita_(termo) {
  const prioritarios = [];

  if (/[\uac00-\ud7af]/.test(termo)) {
    prioritarios.push("ko");
  }
  if (/[\u3040-\u30ff]/.test(termo)) {
    prioritarios.push("ja");
  }
  if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(termo)) {
    prioritarios.push("zh", "ja");
  }

  if (!prioritarios.length) return IDIOMAS_WIKIDATA;

  const fila = [];
  prioritarios.concat(IDIOMAS_WIKIDATA).forEach(idioma => {
    if (fila.indexOf(idioma) === -1) fila.push(idioma);
  });
  return fila;
}

function obterClaimsWikidata_(id) {
  const url = "https://www.wikidata.org/w/api.php" +
    "?action=wbgetentities&format=json&props=claims&ids=" + encodeURIComponent(id);

  const resp = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { "User-Agent": "apollo-leads-sheets/1.0" }
  });
  if (resp.getResponseCode() !== 200) return null;

  const data = JSON.parse(resp.getContentText());
  const ent = data.entities && data.entities[id];
  return (ent && ent.claims) ? ent.claims : null;
}

function obterRotuloWikidata_(id) {
  const url = "https://www.wikidata.org/w/api.php" +
    "?action=wbgetentities&format=json&props=labels&languages=" +
    IDIOMAS_WIKIDATA.join("%7C") + "&ids=" + encodeURIComponent(id);

  const resp = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true,
    headers: { "User-Agent": "apollo-leads-sheets/1.0" }
  });
  if (resp.getResponseCode() !== 200) return null;

  const data = JSON.parse(resp.getContentText());
  const labels = data.entities && data.entities[id] && data.entities[id].labels;
  if (!labels) return null;

  const ordem = ["pt", "en", "es", "de"].concat(IDIOMAS_WIKIDATA);
  for (let i = 0; i < ordem.length; i++) {
    const l = labels[ordem[i]];
    if (l && l.value) return l.value;
  }
  return null;
}

function primeiroItemDeClaim_(claims, propriedade) {
  const lista = claims[propriedade];
  if (!lista || !lista.length) return null;
  const v = lista[0].mainsnak && lista[0].mainsnak.datavalue && lista[0].mainsnak.datavalue.value;
  return (v && v.id) ? v.id : null;
}

function primeiroValorDeClaim_(claims, propriedade) {
  const lista = claims[propriedade];
  if (!lista || !lista.length) return null;
  const v = lista[0].mainsnak && lista[0].mainsnak.datavalue && lista[0].mainsnak.datavalue.value;
  return (typeof v === "string") ? v : null;
}

function buscarTodosCargos_(alvo) {
  const todos = [];
  const idsVistos = {};

  for (let i = 0; i < HIERARQUIA_CARGOS.length; i++) {
    let pessoas = [];
    try {
      pessoas = buscarPessoas_(alvo, HIERARQUIA_CARGOS[i].titulos);
    } catch (err) {
      continue;
    }
    pessoas.forEach(p => {
      if (!p.id || idsVistos[p.id]) return;
      idsVistos[p.id] = true;
      p.ordemCargo = i;
      p.nivelCargo = HIERARQUIA_CARGOS[i].nivel;
      todos.push(p);
    });
    Utilities.sleep(250);
  }

  try {
    const livres = buscarPessoas_(alvo, null);
    livres.forEach(p => {
      if (!p.id || idsVistos[p.id]) return;
      const nivel = classificarCargo_(p.title);
      if (nivel === -1) return;
      idsVistos[p.id] = true;
      p.ordemCargo = nivel;
      p.nivelCargo = HIERARQUIA_CARGOS[nivel].nivel + " (por palavra-chave)";
      todos.push(p);
    });
  } catch (err) {

  }

  return todos;
}

function classificarCargo_(titulo) {
  const t = normalizarNome_(titulo || "");
  if (!t) return -1;
  for (let i = 0; i < PALAVRAS_POR_NIVEL.length; i++) {
    const palavras = PALAVRAS_POR_NIVEL[i];
    for (let j = 0; j < palavras.length; j++) {
      if (t.indexOf(normalizarNome_(palavras[j])) !== -1) return i;
    }
  }
  return -1;
}

function buscarComFallback_(alvo) {
  const tentativas = [];
  let pessoas = buscarTodosCargos_(alvo);
  tentativas.push(descreverAlvo_(alvo) + ": " + pessoas.length);
  if (pessoas.length) return { pessoas: pessoas, alvoUsado: alvo, tentativas: tentativas };

  if (alvo.dominio && alvo.nome) {
    const alt = { nome: alvo.nome, origem: alvo.origem };
    pessoas = buscarTodosCargos_(alt);
    tentativas.push(descreverAlvo_(alt) + ": " + pessoas.length);
    if (pessoas.length) return { pessoas: pessoas, alvoUsado: alt, tentativas: tentativas };
  }

  if (alvo.nome && alvo.nome.toString().trim().split(/\s+/).length > 1) {
    const nucleo = nucleoNome_(alvo.nome);
    if (nucleo && nucleo !== normalizarNome_(alvo.nome)) {
      const alt2 = { nome: nucleo, origem: alvo.origem };
      pessoas = buscarTodosCargos_(alt2);
      tentativas.push(descreverAlvo_(alt2) + ": " + pessoas.length);
      if (pessoas.length) return { pessoas: pessoas, alvoUsado: alt2, tentativas: tentativas };
    }
  }

  return { pessoas: [], alvoUsado: alvo, tentativas: tentativas };
}

function descreverAlvo_(alvo) {
  if (alvo.dominios && alvo.dominios.length) {
    return "domínios " + alvo.dominios.join(", ");
  }
  return alvo.dominio ? "domínio " + alvo.dominio : "nome " + alvo.nome;
}

function buscarPessoasPorHierarquia_(alvo, modoSP) {
  const resultado = buscarComFallback_(alvo);
  const todos = resultado.pessoas;
  if (!todos.length) return [];

  const alvoUsado = resultado.alvoUsado;

  let doGrupo;
  if (alvoUsado.dominio || (alvoUsado.dominios && alvoUsado.dominios.length)) {
    const doms = (alvoUsado.dominios && alvoUsado.dominios.length)
      ? alvoUsado.dominios : [alvoUsado.dominio];
    const domsLimpos = {};
    doms.forEach(d => { if (d) domsLimpos[limparDominio_(d)] = true; });
    doGrupo = todos.filter(p => empregadorAtualBate_(p, domsLimpos, alvoUsado.nome));
  } else {
    const ancora = identificarEmpresaAlvo_(todos, alvoUsado);
    doGrupo = todos.filter(p => pertenceAoGrupo_(p, ancora));
  }

  if (modoSP) {
    doGrupo = doGrupo.filter(ehDeSaoPaulo_);
  }

  doGrupo.forEach(p => {
    p.scoreNacionalidade = calcularScoreNacionalidade_(p);
    p.scoreLinhagem = calcularScoreLinhagem_(p, alvo);
    p.scoreEmail = temEmailProvavel_(p) ? 0 : 1;
  });

  doGrupo.sort(function (a, b) {
    if (a.scoreEmail !== b.scoreEmail) return a.scoreEmail - b.scoreEmail;
    if (a.scoreNacionalidade !== b.scoreNacionalidade) return a.scoreNacionalidade - b.scoreNacionalidade;
    if (a.ordemCargo !== b.ordemCargo) return a.ordemCargo - b.ordemCargo;
    return a.scoreLinhagem - b.scoreLinhagem;
  });

  const selecionados = selecionarComEmail_(doGrupo);
  selecionados.alvoUsado = alvoUsado;
  selecionados.tentativas = resultado.tentativas;
  return selecionados;
}

function ehDeSaoPaulo_(pessoa) {
  const estado = (pessoa.state || "").toString().trim().toLowerCase();
  const cidade = (pessoa.city || "").toString().trim().toLowerCase();
  return estado === "são paulo" || estado === "sao paulo" ||
         cidade === "são paulo" || cidade === "sao paulo";
}

function selecionarComEmail_(ordenados) {
  const comEmail = [];

  for (let i = 0; i < ordenados.length && comEmail.length < MAX_CONTATOS_POR_EMPRESA; i += 5) {
    const onda = ordenados.slice(i, i + 5);
    const enriquecidos = enriquecerLote_(onda).pessoas;

    enriquecidos.forEach(p => {
      if (emailValido_(p.email) && comEmail.length < MAX_CONTATOS_POR_EMPRESA) {
        comEmail.push(p);
      }
    });
  }

  comEmail.jaEnriquecido = true;
  return comEmail;
}

function temEmailProvavel_(pessoa) {
  const s = (pessoa.email_status || "").toLowerCase();
  return s === "verified" || s === "likely" || s === "guessed" || s === "";
}

function calcularScoreNacionalidade_(pessoa) {
  if (ehBrasileiro_(pessoa)) return 0;
  const pais = (pessoa.country || "").toString().trim();
  if (!pais) return 0.5;
  return 1;
}

function ehBrasileiro_(pessoa) {
  const pais = (pessoa.country || "").toString().trim().toLowerCase();
  if (TERMOS_BRASIL.indexOf(pais) !== -1) return true;
  if (pais && pais.indexOf("braz") === -1 && pais.indexOf("bras") === -1) {
    return false;
  }
  const estado = (pessoa.state || "").toString().trim().toLowerCase();
  const cidade = (pessoa.city || "").toString().trim().toLowerCase();
  return ESTADOS_BR.indexOf(estado) !== -1 || CIDADES_BR.indexOf(cidade) !== -1;
}

function calcularScoreLinhagem_(pessoa, alvo) {
  const orgNome = (pessoa.organization_name || "").toString().trim().toLowerCase();
  if (!orgNome) return 0.5;

  if (/\b(brasil|brazil)\b/.test(orgNome)) return 0;

  const base = ((alvo.nome || alvo.dominio || "") + "").toLowerCase()
    .replace(/\.(com|com\.br|br|net|org|io)$/i, "");

  if (base && orgNome.indexOf(base) !== -1 && orgNome.length > base.length + 2) return 0;

  return 1;
}

function buscarPessoas_(alvo, titulos) {
  const apiKey = getApiKey_();
  const url = "https://api.apollo.io/api/v1/mixed_people/api_search";

  const payload = {
    per_page: 100
  };

  if (titulos && titulos.length) {
    payload.person_titles = titulos;
  }

  if (alvo.dominios && alvo.dominios.length) {
    payload.q_organization_domains_list = alvo.dominios;
  } else if (alvo.dominio) {
    payload.q_organization_domains_list = [alvo.dominio];
  } else {
    payload.q_organization_name = alvo.nome;
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
    throw new Error(`Erro na busca (HTTP ${code}): ${resp.getContentText().substring(0, 200)}`);
  }

  const people = JSON.parse(resp.getContentText()).people || [];
  return people.map(p => {
    const org = p.organization || {};
    return {
      id: p.id,
      name: p.name,
      title: p.title,
      linkedin_url: p.linkedin_url,
      email_status: p.email_status || "",
      country: p.country || "",
      state: p.state || "",
      city: p.city || "",
      organization_name: p.organization_name || org.name || "",
      organization_id: org.id || p.organization_id || "",
      organization_domain: limparDominio_(org.primary_domain || org.website_url || ""),
      organization_followers: org.num_linkedin_followers || 0
    };
  });
}

function empregadorAtualBate_(pessoa, dominiosAlvo, nomeAlvo) {
  const domPessoa = (pessoa.organization_domain || "").toLowerCase();
  if (domPessoa && dominiosAlvo[domPessoa]) return true;

  if (nomeAlvo) {
    const nucleo = nucleoNome_(nomeAlvo);
    if (nucleo && normalizarNome_(pessoa.organization_name || "").indexOf(nucleo) !== -1) {
      return true;
    }
  }
  return false;
}

function buscarCandidatasComNucleo_(nome) {
  let candidatas = listarEmpresasCandidatas_(nome);
  const nucleo = nucleoNome_(nome);
  if (nucleo && nucleo !== normalizarNome_(nome)) {
    const extras = listarEmpresasCandidatas_(nucleo);
    const vistos = {};
    candidatas.forEach(c => { if (c.dominio) vistos[limparDominio_(c.dominio)] = true; });
    extras.forEach(c => {
      const d = c.dominio ? limparDominio_(c.dominio) : null;
      if (d && !vistos[d]) { vistos[d] = true; candidatas.push(c); }
    });
  }
  return candidatas;
}

function candidatasParaAlvo_(candidatas, nome, origem) {
  const exatas = candidatasComNomeExato_(candidatas, nome);
  const escolhidaX = exatas.length ? maisPopular_(exatas) : maisPopular_(candidatas);

  let dominios;
  if (exatas.length) {
    dominios = coletarDominios_(exatas);
  } else {
    dominios = dominiosDasCandidatas_(candidatas, nome);
    const nucleo = nucleoNome_(nome);
    if (nucleo && nucleo.indexOf(" ") === -1) {
      const palpite = nucleo.replace(/\s+/g, "") + ".com.br";
      if (dominios.indexOf(palpite) === -1) dominios.push(palpite);
    }
  }

  const nomeFinal = (escolhidaX && escolhidaX.nome) || nome;
  return {
    alvo: {
      dominios: dominios,
      dominio: dominios[0],
      nome: nomeFinal,
      origem: origem + " → " + nomeFinal + (exatas.length ? " (match exato)" : " (Apollo)")
    },
    escolhidaX: escolhidaX,
    exata: exatas.length > 0
  };
}

function resolverNomeParaAlvo_(nome, origem) {
  const candidatas = buscarCandidatasComNucleo_(nome);
  if (candidatas.length) {
    const r = candidatasParaAlvo_(candidatas, nome, origem);
    return { alvo: r.alvo, candidatas: candidatas, escolhidaX: r.escolhidaX };
  }

  try {
    const wiki = resolverViaWikidata_(nome);
    if (wiki && wiki.dominio) {
      return {
        alvo: { dominios: [wiki.dominio], dominio: wiki.dominio, nome: wiki.nome, origem: wiki.origem },
        candidatas: [], escolhidaX: null
      };
    }
    if (wiki && wiki.nome) {

      const candDona = buscarCandidatasComNucleo_(wiki.nome);
      if (candDona.length) {
        const r = candidatasParaAlvo_(candDona, wiki.nome, wiki.origem);
        return { alvo: r.alvo, candidatas: candDona, escolhidaX: r.escolhidaX };
      }
      return { alvo: { nome: wiki.nome, origem: wiki.origem }, candidatas: [], escolhidaX: null };
    }
  } catch (err) {

  }

  return { alvo: { nome: nome, origem: origem + " (busca por nome)" }, candidatas: [], escolhidaX: null };
}

function candidatasComNomeExato_(candidatas, termoBuscado) {
  const alvo = compactarNome_(termoBuscado);
  if (!alvo) return [];
  return (candidatas || []).filter(c => c.dominio && compactarNome_(c.nome) === alvo);
}

function compactarNome_(nome) {
  return (nome || "").toString().toLowerCase().replace(/\s+/g, " ").trim();
}

function maisPopular_(candidatas) {
  let melhor = null;
  (candidatas || []).forEach(c => {
    if (!melhor || (c.seguidores || 0) > (melhor.seguidores || 0)) melhor = c;
  });
  return melhor;
}

function coletarDominios_(candidatas) {
  const vistos = {};
  const saida = [];
  (candidatas || []).forEach(c => {
    const d = c.dominio ? limparDominio_(c.dominio) : null;
    if (d && !vistos[d]) { vistos[d] = true; saida.push(d); }
  });
  return saida.slice(0, 10);
}

function dominiosDasCandidatas_(candidatas, termoBuscado) {
  if (!candidatas || !candidatas.length) return [];
  const nucleo = nucleoNome_(termoBuscado || "");

  const casam = candidatas.filter(c => {
    if (!c.dominio) return false;
    if (!nucleo) return true;
    return normalizarNome_(c.nome || "").indexOf(nucleo) !== -1;
  });

  const base = casam.length ? casam : candidatas.filter(c => c.dominio);

  base.sort((a, b) => {
    const aBr = /\.br$/.test(a.dominio) ? 0 : 1;
    const bBr = /\.br$/.test(b.dominio) ? 0 : 1;
    if (aBr !== bBr) return aBr - bBr;
    return (b.seguidores || 0) - (a.seguidores || 0);
  });

  const vistos = {};
  const saida = [];
  base.forEach(c => {
    const d = limparDominio_(c.dominio);
    if (d && !vistos[d]) { vistos[d] = true; saida.push(d); }
  });
  return saida.slice(0, 10);
}

function listarEmpresasCandidatas_(nome) {
  let candidatas = consultarEmpresasApollo_(nome);

  if (!candidatas.length) {
    const primeira = nome.split(/\s+/)[0];
    if (primeira && primeira.toLowerCase() !== nome.toLowerCase()) {
      candidatas = consultarEmpresasApollo_(primeira);
    }
  }

  return candidatas;
}

function consultarEmpresasApollo_(nome) {
  const apiKey = getApiKey_();
  const url = "https://api.apollo.io/api/v1/mixed_companies/search" +
    "?q_organization_name=" + encodeURIComponent(nome) + "&page=1&per_page=10";

  let resp;
  try {
    resp = UrlFetchApp.fetch(url, {
      method: "post",
      headers: { "X-Api-Key": apiKey, "Accept": "application/json" },
      muteHttpExceptions: true
    });
  } catch (err) {
    return [];
  }

  if (resp.getResponseCode() !== 200) return [];

  const data = JSON.parse(resp.getContentText());
  const orgs = (data.organizations || []).concat(data.accounts || []);

  const candidatas = [];
  orgs.forEach(o => {
    const dominio = (o.primary_domain || o.website_url || "").toString();
    if (!dominio) return;
    candidatas.push({
      dominio: limparDominio_(dominio),
      nome: o.name || nome,
      seguidores: o.num_linkedin_followers || 0,
      setor: o.industry || ""
    });
  });

  candidatas.sort((a, b) => b.seguidores - a.seguidores);
  return candidatas;
}

function resolverEmpresa_(termo, dePara) {
  if (pareceDominio_(termo)) {
    return {
      dominio: limparDominio_(termo),
      nome: null,
      origem: "Domínio informado"
    };
  }

  const destino = dePara[termo.toLowerCase()];
  if (destino) {
    if (pareceDominio_(destino)) {
      return {
        dominio: limparDominio_(destino),
        nome: null,
        origem: `De-Para: ${termo} → ${destino}`
      };
    }
    return {
      dominio: null,
      nome: destino,
      origem: `De-Para: ${termo} → ${destino}`
    };
  }

  return { dominio: null, nome: termo, origem: "Busca por nome" };
}

function pareceDominio_(texto) {
  return texto.indexOf(".") !== -1 && texto.indexOf(" ") === -1;
}

function limparDominio_(texto) {
  return texto
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/.*$/, "")
    .trim()
    .toLowerCase();
}

function identificarEmpresaAlvo_(pessoas, alvo) {

  const termo = nucleoNome_((alvo && alvo.nome) || "");

  const relevantes = pessoas.filter(p => {
    if (!termo) return true;
    return normalizarNome_(p.organization_name || "").indexOf(termo) !== -1;
  });
  const base = relevantes.length ? relevantes : pessoas;

  const porEmpresa = {};
  base.forEach(p => {
    const nome = (p.organization_name || "").toString().trim();
    if (!nome) return;
    const chave = nome.toLowerCase();
    if (!porEmpresa[chave]) porEmpresa[chave] = { nome: nome, seguidores: 0, qtd: 0 };
    porEmpresa[chave].seguidores = Math.max(porEmpresa[chave].seguidores, p.organization_followers || 0);
    porEmpresa[chave].qtd++;
  });

  let melhor = null;
  Object.keys(porEmpresa).forEach(k => {
    const e = porEmpresa[k];
    if (!melhor || e.seguidores > melhor.seguidores ||
        (e.seguidores === melhor.seguidores && e.qtd > melhor.qtd)) {
      melhor = e;
    }
  });

  if (!melhor) return null;

  const nomeVencedor = normalizarNome_(melhor.nome);
  if (termo && nomeVencedor.indexOf(termo) !== -1) return termo;
  return nucleoNome_(melhor.nome);
}

function nucleoNome_(nome) {
  const limpo = normalizarNome_(nome)
    .replace(/\b(the|of|and|ltda|sa|inc|corp|corporation|company|co|group|grupo|holding|do brasil|brasil|brazil)\b/g, " ")
    .trim();
  const palavras = limpo.split(/\s+/).filter(Boolean);
  return palavras.length ? palavras[0] : normalizarNome_(nome);
}

function pertenceAoGrupo_(pessoa, ancora) {
  if (!ancora) return true;
  const nome = normalizarNome_(pessoa.organization_name || "");
  return nome.indexOf(ancora) !== -1;
}

function normalizarNome_(texto) {
  return (texto || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

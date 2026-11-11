function onEdit(e) {
  if (!e || !e.range) return;
  const nome = e.range.getSheet().getName();
  if (nome === SHEET_ENDEMICO || nome === SHEET_NAO_ENDEMICO) registrarAutoria_(e);
  if (nome === SHEET_RESULTADOS) sincronizarStatusEnvio_(e);
}

function registrarAutoria_(e) {
  const aba = e.range.getSheet();
  if (e.range.getColumn() !== 1) return;

  const email = emailDoEditor_();
  const quando = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd HH:mm:ss");
  const primeira = e.range.getRow();
  const total = e.range.getNumRows();

  for (let i = 0; i < total; i++) {
    const linha = primeira + i;
    if (linha < 2) continue;
    const valor = aba.getRange(linha, 1).getValue();
    if (!valor || !valor.toString().trim()) continue;
    aba.getRange(linha, 2).setValue(email);
    aba.getRange(linha, 3).setValue(quando);
  }
}

function sincronizarStatusEnvio_(e) {
  const inicio = e.range.getColumn();
  const fim = inicio + e.range.getNumColumns() - 1;
  if (COL.STATUS_ENVIO < inicio || COL.STATUS_ENVIO > fim) return;

  const aba = e.range.getSheet();
  const primeira = Math.max(e.range.getRow(), 2);
  const ultima = e.range.getRow() + e.range.getNumRows() - 1;
  if (ultima < primeira) return;

  const dados = aba.getRange(primeira, 1, ultima - primeira + 1, TOTAL_COLUNAS).getValues();
  const atualizacoes = {};
  dados.forEach(linha => {
    const id = (linha[COL.ID_APOLLO - 1] || "").toString().trim();
    if (id) atualizacoes[id] = (linha[COL.STATUS_ENVIO - 1] || "").toString().trim();
  });
  atualizarStatusEnvioHistorico_(atualizacoes);
}

function emailDoEditor_() {
  try {
    const email = Session.getActiveUser().getEmail();
    return email || "(desconhecido)";
  } catch (err) {
    return "(desconhecido)";
  }
}

function autoresDaAba_(aba) {
  const mapa = {};
  if (!aba || aba.getLastRow() < 2) return mapa;
  const dados = aba.getRange(2, 1, aba.getLastRow() - 1, 2).getValues();
  dados.forEach(linha => {
    const empresa = (linha[0] || "").toString().trim();
    const autor = (linha[1] || "").toString().trim();
    if (empresa) mapa[empresa.toLowerCase()] = autor;
  });
  return mapa;
}

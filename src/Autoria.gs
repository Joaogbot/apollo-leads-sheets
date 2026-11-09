function onEdit(e) {
  if (!e || !e.range) return;
  const aba = e.range.getSheet();
  const nome = aba.getName();
  if (nome !== SHEET_ENDEMICO && nome !== SHEET_NAO_ENDEMICO) return;
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

function configurarEmail() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const respAssunto = ui.prompt(
    "Assunto do email",
    "Use {{empresa}} para inserir o nome da empresa.\n\nAtual: " +
      (props.getProperty("EMAIL_ASSUNTO") || "(vazio)"),
    ui.ButtonSet.OK_CANCEL
  );
  if (respAssunto.getSelectedButton() !== ui.Button.OK) return;

  const respCorpo = ui.prompt(
    "Corpo do email",
    "Use {{empresa}} e {{nome}} onde quiser.\n\nAtual: " +
      (props.getProperty("EMAIL_CORPO") || "(vazio)"),
    ui.ButtonSet.OK_CANCEL
  );
  if (respCorpo.getSelectedButton() !== ui.Button.OK) return;

  props.setProperty("EMAIL_ASSUNTO", respAssunto.getResponseText().trim());
  props.setProperty("EMAIL_CORPO", respCorpo.getResponseText().trim());
  ui.alert("Assunto e corpo salvos.");
}

function enviarEmailsEmMassa() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const assuntoTemplate = props.getProperty("EMAIL_ASSUNTO");
  const corpoTemplate = props.getProperty("EMAIL_CORPO");

  if (!assuntoTemplate || !corpoTemplate) {
    ui.alert("Configure o assunto e o corpo do email primeiro (menu Apollo Leads > Configurar Email).");
    return;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RESULTADOS);
  if (!sheet) {
    ui.alert(`Aba "${SHEET_RESULTADOS}" não encontrada. Rode "Buscar Contatos" primeiro.`);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    ui.alert("Nenhum contato na aba Resultados.");
    return;
  }

  const dados = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLUNAS).getValues();
  const restanteHoje = MailApp.getRemainingDailyQuota();

  if (restanteHoje === 0) {
    ui.alert("Sua cota diária de envio de email já acabou. Tente novamente amanhã.");
    return;
  }

  const confirmacao = ui.alert(
    "Confirmar envio",
    `Você está prestes a enviar até ${dados.length} emails (limite restante hoje: ${restanteHoje}).\n` +
    "Emails já marcados como 'Enviado' serão pulados. Deseja continuar?",
    ui.ButtonSet.YES_NO
  );
  if (confirmacao !== ui.Button.YES) return;

  let enviados = 0, pulados = 0, erros = 0;

  for (let i = 0; i < dados.length; i++) {
    const linha = i + 2;
    const empresa = dados[i][COL.EMPRESA_BUSCADA - 1];
    const nome = dados[i][COL.NOME - 1];
    const email = dados[i][COL.EMAIL - 1];
    const statusEnvio = dados[i][COL.STATUS_ENVIO - 1];

    if (!email || email.toString().indexOf("@") === -1 || email === "(não revelado)") {
      sheet.getRange(linha, COL.STATUS_ENVIO).setValue("Sem email válido");
      pulados++;
      continue;
    }

    if (statusEnvio === "Enviado") {
      pulados++;
      continue;
    }

    if (MailApp.getRemainingDailyQuota() === 0) {
      sheet.getRange(linha, COL.STATUS_ENVIO).setValue("Cota diária esgotada");
      break;
    }

    const assunto = assuntoTemplate
      .replace(/{{empresa}}/g, empresa || "")
      .replace(/{{nome}}/g, nome || "");
    const corpo = corpoTemplate
      .replace(/{{empresa}}/g, empresa || "")
      .replace(/{{nome}}/g, nome || "");

    try {
      MailApp.sendEmail(email, assunto, corpo);
      sheet.getRange(linha, COL.STATUS_ENVIO).setValue("Enviado");
      enviados++;
    } catch (err) {
      sheet.getRange(linha, COL.STATUS_ENVIO).setValue("Erro: " + err.message);
      erros++;
    }

    Utilities.sleep(1000);
  }

  ui.alert(`Concluído.\nEnviados: ${enviados}\nPulados: ${pulados}\nErros: ${erros}`);
}

import argparse
import os
import unicodedata

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pandas as pd

AQUI = os.path.dirname(__file__)
PROVEDORES_PESSOAIS = {
    "gmail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br",
    "yahoo.com", "yahoo.com.br", "live.com", "icloud.com", "bol.com.br", "uol.com.br",
    "terra.com.br", "me.com", "proton.me", "protonmail.com",
}


def normalizar(texto):
    t = str(texto or "").strip().lower()
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return t


def tem_email(valor):
    v = str(valor or "").strip().lower()
    return "@" in v and "sem email" not in v and "não revelado" not in v and "nao revelado" not in v


def classificar_email(valor):
    if not tem_email(valor):
        return "Sem email"
    dominio = str(valor).strip().lower().split("@")[-1]
    return "Pessoal" if dominio in PROVEDORES_PESSOAIS else "Corporativo"


def classificar_resolucao(texto):
    t = normalizar(texto)
    if "de-para" in t:
        return "De-Para (manual)"
    if "match exato" in t:
        return "Match exato"
    if "wikidata" in t:
        return "Wikidata"
    if "dominio informado" in t:
        return "Domínio digitado"
    if "escolhida" in t:
        return "Escolha na repescagem"
    if "apollo" in t or "grupo" in t or "mais relevante" in t:
        return "Apollo (popularidade)"
    return "Busca por nome"


def classificar_senioridade(cargo):
    t = normalizar(cargo)
    tokens = set(t.replace("-", " ").split())
    acronimos = {"ceo": "CEO", "cfo": "CFO", "cmo": "CMO", "coo": "COO", "cto": "CTO"}
    for sigla, rotulo in acronimos.items():
        if sigla in tokens:
            return rotulo
    frases = [
        ("chief executive", "CEO"), ("chief financial", "CFO"),
        ("chief marketing", "CMO"), ("chief operating", "COO"),
        ("founder", "Fundador"), ("fundador", "Fundador"),
        ("president", "Presidente"), ("presidente", "Presidente"),
        ("country manager", "Country Manager"),
        ("coordenador", "Coordenação"), ("coordinator", "Coordenação"),
        ("diretor", "Diretoria"), ("director", "Diretoria"),
        ("head", "Head"),
        ("gerente", "Gerência"), ("manager", "Gerência"),
        ("analista", "Analista"), ("analyst", "Analista"),
        ("especialista", "Especialista"),
    ]
    for chave, rotulo in frases:
        if chave in t:
            return rotulo
    return "Outro"


def origem_empresa(linha):
    real = normalizar(linha["Empresa real (Apollo)"])
    busca = normalizar(linha["Empresa (busca)"])
    if not real:
        return "Sem retorno"
    return "Empresa procurada" if busca and busca in real else "Outra do grupo"


def salvar_barras(serie, titulo, caminho, horizontal=False):
    fig, ax = plt.subplots(figsize=(8, 4.5))
    if horizontal:
        serie[::-1].plot.barh(ax=ax, color="#2f6f8f")
    else:
        serie.plot.bar(ax=ax, color="#2f6f8f")
        plt.xticks(rotation=30, ha="right")
    ax.set_title(titulo)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    fig.savefig(caminho, dpi=120)
    plt.close(fig)


def salvar_pizza(serie, titulo, caminho):
    fig, ax = plt.subplots(figsize=(6, 6))
    serie.plot.pie(ax=ax, autopct="%1.0f%%", ylabel="", colors=["#2f6f8f", "#c25b3a", "#8f8f8f", "#d9b24b"])
    ax.set_title(titulo)
    fig.tight_layout()
    fig.savefig(caminho, dpi=120)
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description="Análise dos resultados de prospecção do Apollo Leads.")
    parser.add_argument("--historico", default=os.path.join(AQUI, "dados_exemplo", "historico.csv"))
    parser.add_argument("--execucoes", default=os.path.join(AQUI, "dados_exemplo", "execucoes.csv"))
    parser.add_argument("--saida", default=os.path.join(AQUI, "saida"))
    args = parser.parse_args()

    dir_tab = os.path.join(args.saida, "tabelas")
    dir_graf = os.path.join(args.saida, "graficos")
    os.makedirs(dir_tab, exist_ok=True)
    os.makedirs(dir_graf, exist_ok=True)

    hist = pd.read_csv(args.historico)
    execucoes = pd.read_csv(args.execucoes)

    hist["Nome"] = hist["Nome"].fillna("").astype(str)
    contatos = hist[hist["Nome"].str.strip() != ""].copy()
    contatos["Classe email"] = contatos["Email"].map(classificar_email)
    contatos["Resolução"] = contatos["Como foi resolvida"].map(classificar_resolucao)
    contatos["Senioridade"] = contatos["Cargo"].map(classificar_senioridade)
    contatos["Origem empresa"] = contatos.apply(origem_empresa, axis=1)
    hist["Resolução"] = hist["Como foi resolvida"].map(classificar_resolucao)

    tabelas = {}

    cobertura = pd.DataFrame({
        "Contatos": contatos.groupby("Segmento").size(),
        "Com email": contatos[contatos["Classe email"] != "Sem email"].groupby("Segmento").size(),
    }).fillna(0).astype(int)
    cobertura["% com email"] = (cobertura["Com email"] / cobertura["Contatos"] * 100).round(1)
    empresas_tot = hist.groupby("Segmento")["Empresa (busca)"].nunique()
    empresas_com = contatos.groupby("Segmento")["Empresa (busca)"].nunique()
    cobertura["Empresas"] = empresas_tot
    cobertura["Empresas com contato"] = empresas_com.reindex(cobertura.index).fillna(0).astype(int)
    cobertura["% empresas cobertas"] = (cobertura["Empresas com contato"] / cobertura["Empresas"] * 100).round(1)
    tabelas["cobertura_por_segmento"] = cobertura

    geografia = contatos["País"].replace("", "Não informado").fillna("Não informado").value_counts()
    tabelas["distribuicao_por_pais"] = geografia.rename("Contatos").to_frame()

    qualidade = hist["Resolução"].value_counts()
    tabelas["qualidade_por_resolucao"] = qualidade.rename("Linhas").to_frame()

    classe_email = contatos["Classe email"].value_counts()
    tabelas["email_corporativo_vs_pessoal"] = classe_email.rename("Contatos").to_frame()

    senioridade = contatos["Senioridade"].value_counts()
    tabelas["cargos_por_senioridade"] = senioridade.rename("Contatos").to_frame()

    origem = contatos["Origem empresa"].value_counts()
    tabelas["empresa_procurada_vs_grupo"] = origem.rename("Contatos").to_frame()

    if "Solicitante" in contatos.columns:
        contatos["Solicitante"] = contatos["Solicitante"].fillna("(não informado)").replace("", "(não informado)")
        pedidos = pd.DataFrame({
            "Contatos": contatos.groupby("Solicitante").size(),
            "Empresas": contatos.groupby("Solicitante")["Empresa (busca)"].nunique(),
        }).sort_values("Contatos", ascending=False)
        tabelas["pedidos_por_solicitante"] = pedidos

    cred_por_origem = execucoes.groupby("Origem").agg(
        Execuções=("Busca ID", "count"),
        Empresas=("Empresas processadas", "sum"),
        Contatos=("Contatos retornados", "sum"),
        Créditos=("Créditos estimados", "sum"),
        Corrigidas=("Empresas corrigidas", "sum"),
    )
    tabelas["creditos_por_origem"] = cred_por_origem

    total_creditos = int(execucoes["Créditos estimados"].sum())
    total_contatos = int(execucoes["Contatos retornados"].sum())
    total_com_email = int((contatos["Classe email"] != "Sem email").sum())
    excedente = int(execucoes[execucoes["Origem"] == "busca corrigida"]["Créditos estimados"].sum())
    empresas_corrigidas = int(execucoes["Empresas corrigidas"].sum())
    economizados = int(execucoes["Créditos economizados"].sum()) if "Créditos economizados" in execucoes.columns else 0
    base_sem_cache = total_creditos + economizados
    eficiencia = pd.DataFrame({
        "Métrica": [
            "Créditos estimados no total",
            "Contatos retornados",
            "Contatos com email",
            "Créditos por contato retornado",
            "Créditos por contato com email",
            "Créditos gastos em busca corrigida (excedente)",
            "Empresas corrigidas pela repescagem",
            "Créditos economizados pelo reaproveitamento",
            "Economia sobre o gasto sem cache (%)",
        ],
        "Valor": [
            total_creditos,
            total_contatos,
            total_com_email,
            round(total_creditos / total_contatos, 2) if total_contatos else 0,
            round(total_creditos / total_com_email, 2) if total_com_email else 0,
            excedente,
            empresas_corrigidas,
            economizados,
            round(economizados / base_sem_cache * 100, 1) if base_sem_cache else 0,
        ],
    })
    tabelas["eficiencia_de_credito"] = eficiencia

    for nome, df in tabelas.items():
        df.to_csv(os.path.join(dir_tab, nome + ".csv"))

    salvar_barras(cobertura["% com email"], "Cobertura de email por segmento (%)", os.path.join(dir_graf, "cobertura_segmento.png"))
    salvar_barras(geografia, "Distribuição de contatos por país", os.path.join(dir_graf, "paises.png"), horizontal=True)
    salvar_barras(qualidade, "Qualidade por caminho de resolução", os.path.join(dir_graf, "resolucao.png"), horizontal=True)
    salvar_pizza(classe_email, "Email corporativo x pessoal", os.path.join(dir_graf, "email.png"))
    salvar_barras(senioridade, "Contatos por senioridade do cargo", os.path.join(dir_graf, "senioridade.png"), horizontal=True)
    salvar_pizza(origem, "Empresa procurada x outra do grupo", os.path.join(dir_graf, "origem.png"))
    salvar_barras(cred_por_origem["Créditos"], "Créditos estimados por origem da busca", os.path.join(dir_graf, "creditos.png"))

    graficos = {
        "cobertura_por_segmento": "cobertura_segmento.png",
        "distribuicao_por_pais": "paises.png",
        "qualidade_por_resolucao": "resolucao.png",
        "email_corporativo_vs_pessoal": "email.png",
        "cargos_por_senioridade": "senioridade.png",
        "empresa_procurada_vs_grupo": "origem.png",
        "creditos_por_origem": "creditos.png",
    }

    if "pedidos_por_solicitante" in tabelas:
        salvar_barras(tabelas["pedidos_por_solicitante"]["Contatos"], "Contatos por solicitante", os.path.join(dir_graf, "solicitantes.png"))
        graficos["pedidos_por_solicitante"] = "solicitantes.png"

    escrever_relatorio(os.path.join(args.saida, "relatorio.html"), tabelas, graficos)

    print("Análise concluída.")
    print("Tabelas em:", dir_tab)
    print("Gráficos em:", dir_graf)
    print("Relatório:", os.path.join(args.saida, "relatorio.html"))
    print()
    print(eficiencia.to_string(index=False))


def escrever_relatorio(caminho, tabelas, graficos):
    partes = [
        "<!doctype html><html lang='pt-br'><head><meta charset='utf-8'>",
        "<title>Análise Apollo Leads</title>",
        "<style>body{font-family:Arial,Helvetica,sans-serif;max-width:900px;margin:40px auto;padding:0 16px;color:#222}"
        "h1{border-bottom:2px solid #2f6f8f;padding-bottom:8px}h2{margin-top:40px;color:#2f6f8f}"
        "table{border-collapse:collapse;margin:12px 0}td,th{border:1px solid #ccc;padding:6px 10px;text-align:right}"
        "th{background:#f0f4f6}img{max-width:100%;margin:12px 0;border:1px solid #eee}</style></head><body>",
        "<h1>Análise dos resultados de prospecção</h1>",
        "<p>Gerado a partir do histórico de buscas e do registro de execuções.</p>",
    ]
    titulos = {
        "cobertura_por_segmento": "Cobertura por segmento",
        "distribuicao_por_pais": "Distribuição por país",
        "qualidade_por_resolucao": "Qualidade por caminho de resolução",
        "email_corporativo_vs_pessoal": "Email corporativo x pessoal",
        "cargos_por_senioridade": "Cargos por senioridade",
        "empresa_procurada_vs_grupo": "Empresa procurada x outra do grupo",
        "pedidos_por_solicitante": "Pedidos por solicitante",
        "creditos_por_origem": "Créditos por origem da busca",
        "eficiencia_de_credito": "Eficiência de crédito",
    }
    for chave, titulo in titulos.items():
        if chave not in tabelas:
            continue
        partes.append("<h2>" + titulo + "</h2>")
        partes.append(tabelas[chave].to_html())
        if chave in graficos:
            partes.append("<img src='graficos/" + graficos[chave] + "'>")
    partes.append("</body></html>")
    with open(caminho, "w", encoding="utf-8") as f:
        f.write("\n".join(partes))


if __name__ == "__main__":
    main()

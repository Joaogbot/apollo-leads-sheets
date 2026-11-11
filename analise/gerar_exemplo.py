import csv
import os
import random
from datetime import datetime, timedelta

random.seed(42)

PASTA = os.path.join(os.path.dirname(__file__), "dados_exemplo")

CABECALHO_HISTORICO = [
    "Busca ID", "Data/hora", "Modo", "Segmento", "Solicitante", "Domínio",
    "Empresa (busca)", "Empresa real (Apollo)", "Como foi resolvida", "Nome",
    "Cargo", "Nível do cargo", "País", "Email", "Telefone", "LinkedIn",
    "Relacionado a Games", "Status", "Status Envio", "ID Apollo",
]
CABECALHO_EXECUCOES = [
    "Busca ID", "Data/hora", "Modo", "Origem", "Empresas processadas",
    "Contatos enriquecidos", "Contatos retornados", "Telefones solicitados",
    "Créditos estimados", "Empresas corrigidas", "Créditos economizados",
]
TIME = ["ana@empresa.com.br", "bruno@empresa.com.br", "carla@empresa.com.br", "diego@empresa.com.br"]

EMPRESAS_E = [
    ("Riot Games", "Riot Games", "riotgames.com"),
    ("Ubisoft", "Ubisoft", "ubisoft.com"),
    ("Wildlife", "Wildlife Studios", "wildlifestudios.com"),
    ("Hoyoverse", "HoYoverse", "hoyoverse.com"),
    ("Level Up", "Level Up Games", "levelupgames.com.br"),
    ("Pixel Forge", "Pixel Forge Studio", "pixelforge.gg"),
    ("Nuvem Arcade", "Nuvem Arcade", "nuvemarcade.com.br"),
    ("Kobold Interactive", "Kobold Interactive", "kobold.games"),
    ("Tatu Games", "Tatu Games", "tatugames.com.br"),
    ("Orbital Plays", "Orbital Plays", "orbitalplays.com"),
    ("Capivara Studio", "Capivara Studio", "capivarastudio.com.br"),
    ("Neon Rift", "Neon Rift Entertainment", "neonrift.com"),
]
EMPRESAS_NE = [
    ("Itau", "Itaú Unibanco", "itau.com.br"),
    ("Coca-Cola", "Coca-Cola Brasil", "cocacola.com.br"),
    ("Rexona", "Unilever", "unilever.com"),
    ("Britania", "Britânia Eletrônicos", "britania.com.br"),
    ("Venum", "Venum", "venum.com"),
    ("Red Bull", "Red Bull", "redbull.com"),
    ("Banco Aurora", "Banco Aurora", "bancoaurora.com.br"),
    ("Sabor Tropical", "Sabor Tropical Alimentos", "sabortropical.com.br"),
    ("Conecta Telecom", "Conecta Telecom", "conectatelecom.com.br"),
    ("Moto Veloz", "Moto Veloz", "motoveloz.com.br"),
    ("Cafe Serra Alta", "Café Serra Alta", "serraalta.com.br"),
    ("Lumen Seguros", "Lumen Seguros", "lumenseguros.com.br"),
    ("Frescor", "Frescor Bebidas", "frescor.com.br"),
    ("Vitta Farma", "Vitta Farma", "vittafarma.com.br"),
]

CAMINHOS = [
    "Domínio informado",
    "De-Para: {b} → {d}",
    "Busca por nome → {r} (match exato)",
    "Busca por nome → {r} (Apollo)",
    "Busca por nome → {r} (Apollo) (+2 domínios do grupo)",
    "Wikidata: {b} → {r}",
]

CARGOS = [
    ("Head de Eventos", "1 - Eventos e patrocínio"),
    ("Coordenadora de Eventos", "1 - Eventos e patrocínio"),
    ("Brand Manager", "2 - Marketing de marca"),
    ("Gerente de Marketing", "2 - Marketing de marca"),
    ("Analista de Marketing", "2 - Marketing de marca"),
    ("CMO", "3 - Liderança de marketing"),
    ("Diretora de Marketing", "3 - Liderança de marketing"),
    ("CEO", "4 - Liderança geral"),
    ("Founder", "4 - Liderança geral"),
    ("Country Manager", "4 - Liderança geral"),
]

PAISES = ["Brazil", "Brazil", "Brazil", "Brazil", "United States", "United Kingdom", "Argentina", ""]
PROVEDORES_PESSOAIS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com.br"]
NOMES = ["Ana Souza", "Bruno Lima", "Carla Dias", "Diego Rocha", "Eduarda Alves",
         "Felipe Cruz", "Gabriela Melo", "Hugo Pereira", "Isabela Ramos", "João Castro",
         "Karina Luz", "Lucas Pinto", "Marina Teixeira", "Nelson Araújo", "Paula Nunes"]


def primeiro_nome_email(nome):
    partes = nome.lower().replace("ã", "a").replace("ç", "c").replace("é", "e").replace("í", "i").replace("ú", "u").split()
    return partes[0] + "." + partes[-1]


def sortear_status_envio(email, nivel, contactar):
    if "@" not in email or not contactar:
        return ""
    if random.random() > 0.8:
        return ""
    chance_resposta = 0.30 if nivel.startswith("1") else 0.20 if nivel.startswith("2") else 0.10
    if random.random() > chance_resposta:
        return "Enviado"
    if random.random() > 0.45:
        return "Respondeu"
    if random.random() > 0.35:
        return "Reunião marcada"
    return "Fechou patrocínio"


PERFIS = {}


def perfil_empresa(busca):
    if busca not in PERFIS:
        PERFIS[busca] = {
            "contatos": random.choices([0, 1, 2, 3, 4, 5], weights=[3, 1, 2, 2, 3, 5])[0],
            "taxa_email": random.choice([0.0, 0.5, 0.8, 0.95, 0.95]),
            "taxa_corporativo": random.choice([0.2, 0.85, 0.95, 0.95]),
            "contactar": random.random() < 0.7,
            "caminho": random.choice(CAMINHOS),
        }
    return PERFIS[busca]


def gerar_contatos_empresa(busca, real, dominio, segmento, com_telefone):
    perfil = perfil_empresa(busca)
    linhas = []
    n = perfil["contatos"]
    caminho = perfil["caminho"].format(b=busca, d=dominio, r=real)
    if n == 0:
        linhas.append([busca, real, caminho, "", "", "", "", "", "", "",
                       "N/A (não-endêmico)" if segmento == "NE" else "Não",
                       "Nenhum contato encontrado nos cargos-alvo", "", ""])
        return linhas
    usados = random.sample(NOMES, n)
    for nome in usados:
        cargo, nivel = random.choice(CARGOS)
        pais = random.choice(PAISES)
        if random.random() < perfil["taxa_email"]:
            if random.random() < perfil["taxa_corporativo"]:
                email = primeiro_nome_email(nome) + "@" + dominio
            else:
                email = primeiro_nome_email(nome) + "@" + random.choice(PROVEDORES_PESSOAIS)
        else:
            email = "(sem email)"
        telefone = ("+55 11 9" + str(random.randint(1000, 9999)) + "-" + str(random.randint(1000, 9999))) if com_telefone and random.random() < 0.5 else "(não revelado)"
        relacionado = ("Sim" if segmento == "E" else "N/A (não-endêmico)")
        linhas.append([busca, real, caminho, nome, cargo, nivel, pais, email, telefone,
                       "https://linkedin.com/in/" + primeiro_nome_email(nome).replace(".", ""),
                       relacionado, "OK", sortear_status_envio(email, nivel, perfil["contactar"]),
                       "apollo_" + str(random.randint(10**6, 10**7))])
    return linhas


def main():
    os.makedirs(PASTA, exist_ok=True)
    historico = []
    execucoes = []
    base = datetime(2026, 10, 20, 9, 0, 0)

    planos = [
        ("Brasil", "busca", EMPRESAS_NE[:8] + EMPRESAS_E[:6], False, 0, 0),
        ("Brasil", "busca", EMPRESAS_NE[8:], False, 0, 12),
        ("São Paulo", "busca", EMPRESAS_E[6:], True, 0, 0),
        ("Brasil", "repescagem", EMPRESAS_NE[:4], False, 0, 0),
        ("Brasil", "busca corrigida", EMPRESAS_NE[:2], False, 2, 0),
    ]

    for i, (modo, origem, empresas, com_tel, corrigidas, economizados) in enumerate(planos):
        dt = base + timedelta(days=i, minutes=i * 7)
        busca_id = "B" + dt.strftime("%Y%m%d-%H%M%S")
        data_hora = dt.strftime("%Y-%m-%d %H:%M:%S")
        retornados = 0
        for (busca, real, dominio) in empresas:
            segmento = "E" if (busca, real, dominio) in EMPRESAS_E else "NE"
            solicitante = random.choice(TIME)
            linhas = gerar_contatos_empresa(busca, real, dominio, segmento, com_tel)
            for l in linhas:
                if l[7]:
                    retornados += 1
                historico.append([busca_id, data_hora, modo, segmento, solicitante, dominio] + l)
        enriquecidos = retornados + random.randint(len(empresas), len(empresas) * 4)
        telefones = random.randint(2, 6) if com_tel else 0
        creditos = enriquecidos + telefones * 8
        execucoes.append([busca_id, data_hora, modo, origem, len(empresas),
                          enriquecidos, retornados, telefones, creditos, corrigidas, economizados])

    with open(os.path.join(PASTA, "historico.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(CABECALHO_HISTORICO)
        w.writerows(historico)

    with open(os.path.join(PASTA, "execucoes.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(CABECALHO_EXECUCOES)
        w.writerows(execucoes)

    print("Gerado:", len(historico), "linhas de histórico,", len(execucoes), "execuções em", PASTA)


if __name__ == "__main__":
    main()

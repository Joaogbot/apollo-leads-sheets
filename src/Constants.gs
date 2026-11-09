const SHEET_ENDEMICO = "Empresas E";
const SHEET_NAO_ENDEMICO = "Empresas NE";
const SHEET_RESULTADOS = "Resultados";
const SHEET_DEPARA = "De-Para";
const SHEET_DIAGNOSTICO = "Diagnóstico";
const SHEET_REPESCAGEM = "Repescagem";
const SHEET_HISTORICO = "Histórico";
const SHEET_EXECUCOES = "Execuções";

const CABECALHO_HISTORICO = [
  "Busca ID", "Data/hora", "Modo", "Segmento", "Solicitante", "Domínio",
  "Empresa (busca)", "Empresa real (Apollo)", "Como foi resolvida", "Nome",
  "Cargo", "Nível do cargo", "País", "Email", "Telefone", "LinkedIn",
  "Relacionado a Games", "Status", "Status Envio", "ID Apollo"
];
const CABECALHO_EXECUCOES = [
  "Busca ID", "Data/hora", "Modo", "Origem", "Empresas processadas",
  "Contatos enriquecidos", "Contatos retornados", "Telefones solicitados",
  "Créditos estimados", "Empresas corrigidas", "Créditos economizados"
];

const DIAS_REAPROVEITAMENTO = 90;
const MAX_CONTATOS_POR_EMPRESA = 5;

const HIERARQUIA_CARGOS = [
  {
    nivel: "1 - Eventos e patrocínio",
    titulos: [
      "Head of Events", "Events Manager", "Event Marketing Manager",
      "Sponsorship Manager", "Head of Partnerships", "Partnerships Manager",
      "Gerente de Eventos", "Gerente de Patrocínio", "Coordenador de Eventos",
      "Coordenadora de Eventos", "Analista de Eventos", "Supervisor de Eventos",
      "Diretor de Eventos", "Especialista em Eventos", "Gerente de Parcerias",
      "Coordenador de Patrocínio", "Head de Eventos", "Live Marketing"
    ]
  },
  {
    nivel: "2 - Marketing de marca",
    titulos: [
      "Brand Manager", "Marketing Manager", "Marketing Director",
      "Head of Marketing", "Gerente de Marketing", "Gerente de Marca",
      "Coordenador de Marketing", "Coordenadora de Marketing",
      "Analista de Marketing", "Supervisor de Marketing",
      "Especialista em Marketing", "Head de Marketing", "Gerente de Produto",
      "Product Marketing Manager", "Trade Marketing Manager",
      "Gerente de Trade Marketing", "Gerente de Comunicação",
      "Coordenador de Comunicação", "Marketing Coordinator"
    ]
  },
  {
    nivel: "3 - Liderança de marketing",
    titulos: [
      "CMO", "Chief Marketing Officer", "VP Marketing",
      "Vice President Marketing", "Diretor de Marketing",
      "Diretora de Marketing", "Diretor Comercial", "Diretor de Comunicação",
      "VP de Marketing", "Head Comercial", "Gerente Comercial"
    ]
  },
  {
    nivel: "4 - Liderança geral",
    titulos: [
      "CEO", "Chief Executive Officer", "Founder", "Co-Founder",
      "Owner", "Partner", "Managing Partner", "Sócio", "Sócia",
      "Diretor Geral", "Diretor Presidente", "Presidente", "Diretor Executivo",
      "Fundador", "Proprietário", "Country Manager", "General Manager"
    ]
  }
];

const PALAVRAS_POR_NIVEL = [
  ["event", "evento", "patrocin", "sponsor", "parceria", "partnership", "live marketing"],
  ["marketing", "marca", "brand", "comunica", "trade", "produto", "product"],
  ["cmo", "diretor de marketing", "diretora de marketing", "vp marketing", "comercial"],
  ["ceo", "founder", "fundador", "owner", "proprietar", "socio", "sócio", "presidente",
   "diretor geral", "diretor executivo", "country manager", "general manager", "partner"]
];

const PALAVRAS_GAMING = [
  "game", "games", "gaming", "video game", "videogame", "video games",
  "esports", "e-sports", "esport", "jogo eletrônico", "jogos eletrônicos",
  "jogos digitais", "game studio", "game developer", "game publisher",
  "gamer", "gamification", "jogos", "indie game", "mobile game"
];

const COL = {
  EMPRESA_BUSCADA: 1, EMPRESA_REAL: 2, COMO_RESOLVIDA: 3, NOME: 4, CARGO: 5,
  NIVEL_CARGO: 6, PAIS: 7, EMAIL: 8, TELEFONE: 9, LINKEDIN: 10,
  RELACIONADO_GAMES: 11, STATUS_BUSCA: 12, STATUS_ENVIO: 13, ID_APOLLO: 14
};

const TOTAL_COLUNAS = 14;
const IDIOMAS_WIKIDATA = ["pt", "en", "es", "de", "ja", "ko", "zh"];
const WEBHOOK_URL_PADRAO = "https://example.com/apollo-webhook";
const TERMOS_BRASIL = ["brazil", "brasil", "br"];

const ESTADOS_BR = [
  "são paulo", "sao paulo", "rio de janeiro", "minas gerais", "bahia", "paraná",
  "parana", "rio grande do sul", "pernambuco", "ceará", "ceara", "santa catarina",
  "goiás", "goias", "distrito federal", "espírito santo", "espirito santo",
  "amazonas", "pará", "para", "mato grosso", "mato grosso do sul", "maranhão",
  "maranhao", "paraíba", "paraiba", "rio grande do norte", "alagoas", "piauí",
  "piaui", "sergipe", "rondônia", "rondonia", "tocantins", "acre", "amapá",
  "amapa", "roraima"
];

const CIDADES_BR = [
  "são paulo", "sao paulo", "rio de janeiro", "belo horizonte", "brasília",
  "brasilia", "salvador", "fortaleza", "curitiba", "recife", "porto alegre",
  "campinas", "guarulhos", "florianópolis", "florianopolis"
];

const CACHE_WIKIDATA = {};

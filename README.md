# Apollo Leads no Google Sheets

Automação em Google Apps Script que transforma uma lista de nomes de empresas em uma base de contatos qualificados, usando a API do [Apollo.io](https://apollo.io).

Fiz isso para a prospecção de patrocinadores de uma feira de games e cultura geek. Os leads se dividem em dois grupos: os endêmicos, que são empresas do próprio universo de jogos, e os não endêmicos, que são marcas de fora do setor (bancos, alimentício, telecom) interessadas em alcançar esse mesmo público.

A premissa que guiou todo o projeto é que quem preenche a planilha no dia a dia não é da área técnica. O único trabalho da pessoa é digitar o nome da empresa numa aba e colher o resultado em outra.

## O que faz

A partir de uma lista de empresas numa aba do Google Sheets, o script resolve a empresa real por trás do nome digitado, busca contatos nos cargos relevantes (eventos, marketing e liderança), descarta quem não trabalha mais lá, escolhe até cinco contatos com e-mail por empresa, enriquece com e-mail, telefone e LinkedIn, classifica se a empresa é do setor de games e, se você quiser, dispara e-mails em massa com variáveis preenchidas. Tudo acontece dentro do Sheets, por um menu próprio chamado "Apollo Leads".

## Decisões técnicas que valem explicar

### Resolver a empresa certa a partir de um nome

O Apollo indexa empresas, não marcas, e a mesma marca costuma existir sob vários nomes e domínios. A resolução segue uma ordem, da fonte mais confiável para a menos:

1. Domínio digitado direto (por exemplo `unilever.com`): busca exata, sem ambiguidade.
2. Aba De-Para, um mapeamento manual (por exemplo "Rexona" aponta para `unilever.com`).
3. Busca por nome no Apollo, com match exato na frente da popularidade.
4. Wikidata, apenas quando o Apollo não encontra a empresa.

A busca por nome no Apollo é aproximada: pedir "Venum" devolve também "Venum Fight", "Venum Inc" e por aí vai. Por isso o passo 3 prioriza o match exato. Uma candidata cujo nome é idêntico ao que foi digitado, tolerando só espaços e maiúsculas, vence sem passar pela desambiguação. Quando não existe match exato, entra o critério de popularidade descrito abaixo.

O Wikidata só é consultado em último caso, para marcas que nem existem como empresa no Apollo. "Rexona" não é uma pessoa jurídica com funcionários, é uma marca da Unilever. Consultando as propriedades `P749` (organização controladora), `P127` (pertence a) e `P856` (site oficial), chego na dona e no domínio dela. A consulta percorre sete idiomas (pt, en, es, de, ja, ko, zh) e olha a escrita do termo para escolher o idioma certo primeiro: "넥슨" tenta coreano antes de tudo, "任天堂" tenta chinês e japonês antes dos ocidentais.

Cada linha do resultado traz uma coluna "Como foi resolvida", para a pessoa saber o quanto confiar naquele contato.

### Desambiguação por popularidade

"Britânia" pode ser a fabricante de eletrodomésticos ou a Britânia Foods. Sem match exato, o script ancora no termo buscado, mantém só as empresas cujo nome contém esse termo e, entre elas, fica com a mais popular no LinkedIn, medida pelo número de seguidores. Assim uma empresa maior e só de passagem relacionada, como a Nestlé aparecendo numa busca por "Cacau Show", não rouba o resultado por ter mais seguidores.

### Filtrar quem trabalha lá hoje

O parâmetro de domínio do Apollo casa com o emprego atual ou com um emprego anterior da pessoa. Buscar `coca-cola.com` me devolvia ex-funcionários que hoje estão em outra empresa, incluindo gente da Berkshire Hathaway, que é acionista da Coca-Cola. Levei um tempo para entender por que vinham nomes tão fora do lugar. A solução foi validar a empresa atual de cada contato contra o domínio alvo e descartar quem só passou por lá no passado.

### Escolher os cinco contatos

Um nome de empresa devolve dezenas de pessoas. A ordem de prioridade é esta:

| Prioridade | Critério | Regra |
|---|---|---|
| 1 | E-mail | Só entram contatos com e-mail verificável |
| 2 | Nacionalidade | Brasileiros primeiro |
| 3 | Cargo | Eventos e patrocínio, depois marca, depois liderança de marketing, depois liderança geral |
| 4 | Linhagem | Operação local antes da matriz global |

O alvo é cinco contatos com e-mail por empresa. Quem não tem e-mail fica de fora. Se a empresa só tem três com e-mail nos cargos certos, vêm três, e nunca completo a cota com contato sem e-mail nem com empresa de nome parecido.

Como o e-mail só se confirma depois do enriquecimento (a busca informa apenas o status, não o endereço em si), a seleção enriquece em ondas de cinco e para assim que fecha cinco com e-mail. Isso gasta o mínimo de créditos.

A nacionalidade é tratada por ordenação, não por filtro na origem. O parâmetro de localização do Apollo é rígido e exclui quem está sem país preenchido, o que zerava empresas com forte operação no Brasil. Então a busca traz todo mundo e coloca os brasileiros na frente. A modalidade "Buscar Contatos SP" é a exceção, porque ali o filtro por São Paulo é proposital e serve para marcar reuniões presenciais.

### Rede de segurança nos cargos

A lista de cargos alvo tem termos em inglês e em português, mas nenhuma lista cobre toda variação que aparece na prática, do tipo "Coordenadora de Eventos" ou "Gerente de Comunicação e Marca". Além da busca por títulos, o script sempre faz uma busca sem filtro de cargo e classifica os títulos por palavra-chave ali mesmo. Sem isso, uma empresa brasileira grande podia devolver só um punhado de pessoas com cargo em inglês e esconder centenas de candidatos bons.

### Custo de crédito moldando a arquitetura

Na API do Apollo, buscar é de graça e enriquecer é pago. Isso definiu o formato do algoritmo: ele varre os níveis de cargo sem gastar nada, ordena os candidatos e só enriquece em ondas até fechar os cinco com e-mail. Celular custa por volta de oito créditos contra um de um contato comum, então fica atrás de um interruptor no menu, com aviso antes de ligar.

### Telefones sem precisar de servidor

O Apollo não devolve o celular na resposta da requisição. Ele exige um `webhook_url` e entrega os dados lá alguns minutos depois, o que normalmente obrigaria a manter um servidor HTTPS no ar. Contornei isso com o endpoint `webhook_result/{request_id}`, que deixa buscar o resultado por consulta. A primeira etapa, no "Buscar Contatos", guarda o `request_id` e marca a linha como aguardando. A segunda etapa, no "Buscar celulares pendentes", consulta por aquele id e preenche a planilha. Quando não sobra nenhum pedido em aberto, as linhas que continuam aguardando viram "sem celular na base", porque o Apollo não tem aquele número e a linha nunca sairia desse estado sozinha.

### O bug do inteiro de 19 dígitos

O `request_id` do Apollo é um inteiro de cerca de 19 dígitos, como `8494388278862695123`. O JavaScript só representa inteiros exatos até `Number.MAX_SAFE_INTEGER`, que tem 16 dígitos. Jogar esse valor no `JSON.parse` arredonda os últimos dígitos sem avisar:

```js
JSON.parse('{"request_id":8494388278862695123}').request_id
// vira 8494388278862695000
```

O efeito eram consultas eternas respondendo `request_id_unknown`, sem nenhuma pista de que o id tinha sido corrompido. A correção foi extrair o valor do texto cru da resposta, antes do parse, e tratar sempre como string. Foi o bug que mais me custou para achar.

## Como o código está organizado

Em Apps Script todos os arquivos `.gs` de um projeto dividem o mesmo escopo global, então separei por responsabilidade em vez de deixar tudo num arquivo só:

| Arquivo | Responsabilidade |
|---|---|
| `Constants.gs` | Nomes de abas, hierarquia de cargos, palavras-chave e listas |
| `Menu.gs` | Monta o menu "Apollo Leads" no `onOpen` |
| `Configuracao.gs` | API Key, instalação da planilha e aba De-Para |
| `Busca.gs` | Orquestra a busca e escreve os resultados |
| `ResolucaoEmpresa.gs` | Nome digitado para empresa ou domínio, match exato e desambiguação |
| `Wikidata.gs` | Marca para empresa controladora, como último recurso |
| `BuscaPessoas.gs` | Busca de pessoas, ranking e seleção |
| `Enriquecimento.gs` | E-mail, telefone e classificação de setor |
| `Celular.gs` | Fluxo de celular em duas etapas |
| `Repescagem.gs` | Revisão humana da empresa escolhida e busca corrigida |
| `Diagnostico.gs` | Conferência de empresas sem gastar crédito |
| `Email.gs` | Disparo de e-mail em massa com variáveis |
| `appsscript.json` | Manifesto: fuso, runtime V8 e escopos de OAuth |

## Abas da planilha

| Aba | Papel |
|---|---|
| `Empresas E` | Empresas endêmicas, do universo de games |
| `Empresas NE` | Empresas não endêmicas |
| `De-Para` | Mapeamento manual de marca para empresa, com prioridade sobre o resto |
| `Resultados` | Saída com os contatos: e-mail, telefone, cargo e LinkedIn |
| `Repescagem` | Candidatas de cada nome, para revisar a escolha |
| `Diagnóstico` | Como cada empresa foi interpretada, sem gastar crédito |

Dá para preencher só uma das abas de entrada; a outra pode ficar vazia.

## Instalação

A planilha e o projeto de Apps Script ficam vinculados. No Sheets, abra Extensões e depois Apps Script.

### Com clasp

O [clasp](https://github.com/google/clasp) sincroniza os arquivos locais com o projeto na nuvem:

```bash
npm install -g @google/clasp
clasp login
cp .clasp.json.example .clasp.json
clasp push
```

Coloque no `.clasp.json` o `scriptId` do seu projeto, que fica em Configurações do projeto, dentro do editor de Apps Script.

### Na mão

Sem clasp, crie no editor um arquivo para cada `.gs` da pasta `src` e cole o conteúdo. Ative o manifesto `appsscript.json` em Configurações do projeto, na opção de mostrar o arquivo de manifesto, e cole o conteúdo também.

### Primeiro uso

Recarregue a planilha para o menu "Apollo Leads" aparecer na barra superior. Em "Instalar planilha" o script cria as abas e a formatação. Em "Configurar API Key (Apollo)" você cola a sua chave, que fica em Settings, Integrations, API dentro do Apollo. Na primeira execução o Google vai pedir para autorizar as permissões.

Você precisa de uma conta Apollo.io com acesso à API (os planos gratuitos costumam não ter) e de uma conta Google. O envio de e-mail usa a cota do Gmail da conta que autoriza o script, que é de cerca de 100 por dia em contas comuns e 1.500 por dia no Workspace.

## Ordem de uso no dia a dia

1. Preencha as abas de entrada.
2. Rode "Conferir lista de empresas", que é de graça e mostra o que não vai resolver bem.
3. Ajuste a aba De-Para só nos casos que apareceram marcados.
4. Rode "Buscar Contatos", que consome crédito do Apollo.
5. Se a busca de celular estiver ligada, rode "Buscar celulares pendentes".
6. Colha os resultados.

## Segurança e privacidade

As chaves de API ficam no `PropertiesService` do Apps Script, nunca no código. O `webhook_url` padrão aponta para um endereço inerte de propósito; não troque por webhook.site nem similares, porque os celulares dos contatos acabariam depositados num servidor público de terceiros. A base gerada tem dado pessoal (e-mail e telefone), então não versione a planilha nem exportações dela; o `.gitignore` já cobre `.csv`, `.xlsx` e `.tsv`. O `.clasp.json`, que guarda o id do projeto, também fica fora do versionamento. Para prospecção fria B2B, deixe no corpo do e-mail uma forma clara de descadastro.

## O que ainda não resolve

A cobertura do Wikidata é boa para marcas globais e irregular para empresas brasileiras de porte médio; a aba De-Para existe justamente para tapar esse buraco. O Apps Script corta a execução em seis minutos, então listas muito grandes, de umas cinquenta empresas para cima, podem precisar rodar em lotes. A classificação de setor usa palavra-chave sobre o dado de indústria do Apollo: é rápida e de graça, mas menos precisa do que seria com um modelo de linguagem.

## Licença

MIT. Veja o arquivo [LICENSE](LICENSE).

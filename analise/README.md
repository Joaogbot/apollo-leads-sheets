# Análise dos resultados

Esta pasta lê o que a automação já coletou e devolve as tabelas e os gráficos que respondem às perguntas de negócio: onde a cobertura de email é boa, quanto se gastou de crédito, quais cargos aparecem, de onde vêm os contatos.

## De onde vêm os dados

A planilha acumula dois registros a cada busca:

- a aba **Histórico**, com uma linha por contato devolvido, carimbada com a busca, a data, o modo, o segmento, o solicitante (quem digitou a empresa) e o domínio resolvido;
- a aba **Execuções**, com uma linha por busca, trazendo empresas processadas, contatos enriquecidos, telefones solicitados, crédito estimado e empresas corrigidas na repescagem.

Para analisar os dados reais, exporte cada uma dessas abas como CSV (no Sheets, Arquivo, Fazer download, Valores separados por vírgula) e aponte o script para esses arquivos.

A base real tem email e telefone de pessoas, então ela não entra no repositório. O que está versionado aqui é um conjunto de dados sintético, gerado por `gerar_exemplo.py`, com a mesma estrutura da base real. Assim dá para rodar a análise e ver o resultado sem expor ninguém.

## Como rodar

```bash
pip install -r requirements.txt
python gerar_exemplo.py
python analisar.py
```

Para rodar sobre o seu export real:

```bash
python analisar.py --historico caminho/historico.csv --execucoes caminho/execucoes.csv --saida saida
```

## O que sai

Tudo vai para a pasta `saida`:

- `tabelas/` com um CSV por recorte;
- `graficos/` com os gráficos em PNG;
- `relatorio.html`, que junta tabela e gráfico de cada recorte numa página só.

## O que é medido

- **Cobertura por segmento**: contatos, contatos com email e empresas cobertas, separando endêmicas de não endêmicas.
- **Distribuição por país**: de onde vêm os contatos devolvidos.
- **Qualidade por resolução**: por qual caminho cada empresa foi resolvida (domínio, De-Para, match exato, popularidade, Wikidata), que serve de leitura de confiança do dado.
- **Email corporativo x pessoal**: separa domínio próprio de provedor gratuito como gmail ou hotmail.
- **Cargos por senioridade**: quantos CEO, CMO, diretoria, gerência e assim por diante.
- **Empresa procurada x outra do grupo**: se o contato veio da empresa digitada ou de outra do mesmo conglomerado.
- **Pedidos por solicitante**: quantos contatos e quantas empresas cada pessoa do time pediu.
- **Eficiência de crédito**: crédito estimado no total, por contato e por contato com email, o excedente gasto nas buscas corrigidas pela repescagem, e o crédito economizado quando uma empresa buscada há pouco é reaproveitada do histórico em vez de consultada de novo.

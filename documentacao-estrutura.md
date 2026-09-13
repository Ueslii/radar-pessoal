# Radar do Weslley — documentação para replicar

## 1. O arquivo

`radar-do-weslley.html` é exatamente o arquivo publicado como Artifact — HTML/CSS/JS num arquivo só, sem build step. As únicas chamadas que não funcionam fora do claude.ai são as de `window.claude.use("db")` (comentadas abaixo). O resto (fontes do Google, layout, tema claro/escuro, sparkline em SVG) é HTML/CSS/JS puro e roda em qualquer lugar.

Pontos de entrada no código para achar rápido:
- `iniciar()` (final do `<script>`): resolve `db = await window.claude.use("db")` e assina 3 documentos.
- `renderCarreira()`, `renderMercado()`: leem os objetos `snap`/`config`/`cand` (em memória) e desenham o DOM. Não dependem do Claude — só precisam receber os mesmos formatos de objeto.
- Botões Pendente/Inscrito/Descartar e o formulário de tickers: chamam `db.doc(...).set(...)`.

## 2. Estrutura do banco (3 documentos JSON)

O Claude Artifact db é um documento-store tipo Firestore: coleção `painel`, 3 documentos. Cada leitura no painel é um `onSnapshot` (realtime); para replicar fora, um `fetch` simples nesses 3 arquivos/endpoints já basta (o realtime é só um bônus).

### `painel/snapshot` — dados de mercado e vagas (escrito só pela rotina de atualização)

```json
{
  "atualizadoEm": "2026-09-11T19:13:11Z",
  "origem": "tarefa agendada",
  "mercado": {
    "ibovespa": { "valor": 188268.59, "variacao": 1.42, "data": "2026-09-10", "nota": "maior fechamento em 4 meses" },
    "ifix":     { "valor": 3746.97,  "variacao": 0.06, "data": "2026-09-10" },
    "dolar": {
      "valor": 5.0918, "variacao": -0.45, "data": "2026-09-11", "tipo": "PTAX venda",
      "serie": [ { "d": "2026-08-03", "v": 5.0723 }, { "d": "2026-09-11", "v": 5.0918 } ]
    },
    "selic":   { "valor": 14.00, "data": "2026-09-11" },
    "ipca12m": { "valor": 4.22, "ref": "ago/2026" },
    "watchlist": [
      { "ticker": "ITUB4", "nome": "Itaú Unibanco PN", "preco": 42.32, "variacao": 1.76, "data": "2026-09-10" }
    ],
    "fontes": [ { "nome": "Banco Central (SGS) — PTAX, Selic, IPCA", "url": "https://dadosabertos.bcb.gov.br/" } ]
  },
  "carreira": {
    "buscadoEm": "2026-09-11T19:10:00Z",
    "oportunidades": [
      {
        "id": "ifood-ifuture-2027",
        "empresa": "iFood", "programa": "iFuture 2027",
        "trilha": "Tecnologia — eng. de software, dados, produto/design",
        "prazo": "2026-09-11", "formatura": "jul/2027 a dez/2029",
        "modalidade": "Remoto ou híbrido", "bolsa": "não divulgada", "carga": "30h/semana",
        "link": "https://carreiras.ifood.com.br/job/8728486002/",
        "encaixe": "sim", "motivo": "Formatura dentro da janela e aceita remoto.",
        "fonte": "https://jcconcursos.com.br/..."
      }
    ]
  }
}
```

Campo por campo que importa pra lógica:
- `variacao` sempre em % (número, não string), 2 casas.
- `dolar.serie`: array cronológico `{d: "AAAA-MM-DD", v: número}` — vira o gráfico sparkline no front. Guarda ~30 pregões.
- `oportunidades[].encaixe`: `"sim" | "verificar" | "nao"` — controla a cor do selo.
- `oportunidades[].id`: slug estável (não muda entre atualizações) — é a chave que liga uma vaga ao status salvo em `candidaturas`.

### `painel/config` — preferências do usuário (escrito pelo próprio painel quando você edita os tickers)

```json
{
  "watchlist": ["ITUB4", "PETR4", "VALE3", "BBDC4", "ABEV3"],
  "watchlistExemplo": true,
  "perfil": {
    "curso": "ADS", "formatura": "dez/2027", "cidade": "Teixeira de Freitas (BA)",
    "modalidade": "remoto de preferência; híbrido fora da Bahia marcado como 'verificar'",
    "modalidadeExemplo": true
  }
}
```

`watchlist` é lida pela rotina de atualização para saber quais tickers buscar preço. `perfil` é só exibido — não filtra nada sozinho hoje (o filtro de encaixe é decidido pela IA na hora de pesquisar).

### `painel/candidaturas` — o que você marcou no painel

```json
{ "status": { "ifood-ifuture-2027": "inscrito", "localiza-estagio-tech-2027": "pendente" } }
```

Mapa `id da vaga → "pendente" | "inscrito" | "descartado"`. É o único documento escrito pelos cliques do usuário (não pela rotina).

## 3. Como a "pesquisa" (rotina de atualização) funciona

Não é uma API de dados — é um agente que roda de seg a sex às 07:30 (horário de Brasília) fazendo isto:

1. **Lê o estado atual**: os 3 documentos acima (pra saber a watchlist configurada e não perder o status das candidaturas).
2. **Mercado** — busca em fontes públicas:
   - Dólar PTAX venda, Selic meta e IPCA 12 meses: API do Banco Central (SGS), sem autenticação:
     - `https://api.bcb.gov.br/dados/serie/bcdata.sgs.1/dados?formato=json&dataInicial=DD/MM/AAAA&dataFinal=DD/MM/AAAA` (série 1 = dólar)
     - `https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json` (série 432 = Selic meta)
     - `https://api.bcb.gov.br/dados/serie/bcdata.sgs.13522/dados/ultimos/1?formato=json` (série 13522 = IPCA 12 meses)
   - Ibovespa, IFIX e os preços da watchlist: **não têm API pública gratuita e estável** — a rotina faz busca textual (ex.: "Ibovespa fechamento 10 de setembro 2026") e extrai o número de notícias de fechamento de mercado (fontes como Diário do Grande ABC, Fundos Explorer). Isso é o elo mais frágil pra replicar: fora do Claude você vai precisar de uma API paga/registrada (B3, Yahoo Finance, brapi.dev, Alpha Vantage) ou manter esse scraping textual.
3. **Carreira** — não existe uma lista central de "vagas de estágio 2027". A rotina faz 2–4 buscas (ex.: "programa de estágio 2027 tecnologia inscrições abertas") e, para cada resultado novo, abre a página oficial e extrai manualmente: prazo, janela de formatura exigida, modalidade, bolsa, link. Decide `encaixe` comparando a janela de formatura e a modalidade com o perfil salvo em `config.perfil`.
4. **Grava** o novo `painel/snapshot` (nunca mexe em `candidaturas`).
5. Se algum prazo com `encaixe` "sim"/"verificar" fecha em ≤2 dias e ainda está "pendente", isso vira um aviso.

Ou seja: para replicar 100% fora do Claude, o pedaço fácil é o macro (BCB tem API real). O pedaço difícil — Ibovespa/IFIX/ações em tempo real e "vagas de estágio abertas agora" — hoje depende de um modelo de linguagem pesquisando e lendo páginas, porque não há uma API única e gratuita pra isso. Alternativas prontas: `brapi.dev` (cotações B3, tem plano grátis) resolve a parte de mercado; a parte de vagas normalmente vira um scraper dedicado por empresa, ou você aceita manter esse pedaço manual/via LLM mesmo fora daqui.

## 4. Para rodar 100% fora do Claude

Trocar, no HTML, o bloco `iniciar()`:
- em vez de `db.doc("painel/snapshot").onSnapshot(...)`, um `fetch('/api/snapshot').then(r=>r.json())` apontando pra um endpoint seu que devolve exatamente o JSON do item 2.
- os `db.doc(...).set(...)` dos botões e do formulário viram `fetch('/api/config', {method:'POST', body: JSON.stringify(...)})`.
- a atualização automática vira um cron (Vercel Cron, GitHub Actions, etc.) rodando o mesmo roteiro do item 3 e gravando no seu banco (Supabase serve bem, já é sua stack).

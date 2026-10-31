# Founder Studio API

API em TypeScript e Express que recebe uma URL e encaminha a solicitação a módulos de scraping de Instagram ou Twitter/X. Usa Playwright, dotenv e CORS. A coleta depende do acesso e das respostas das plataformas externas.

## API

- `GET /health`: responde com status e timestamp do servidor.
- `POST /api/scrape`: recebe JSON com `url` textual e encaminha ao scraper escolhido. A rota responde 400 para campo ausente/tipo inválido ou plataforma não reconhecida e 500 para exceções da coleta.
- Porta padrão `3001`, alterável pela variável de ambiente `PORT`; dotenv é carregado no início.
- CORS permite `http://localhost:5173` e `http://127.0.0.1:5173`, com métodos GET/POST. Essa configuração não substitui autenticação.

## Desenvolvimento

Os scripts de desenvolvimento estão no [package.json](package.json). Com Node.js e npm compatíveis, instale as dependências na raiz do projeto:

```sh
npm install
npm run dev
```

Para compilar e iniciar a versão compilada:

```sh
npm run build
npm start
```

`dev` usa nodemon/ts-node; `build` compila TypeScript e `start` executa `dist/server.js`. O manifesto não fixa a versão do Node. Confira a compatibilidade do ambiente, as dependências de navegador do Playwright e o acesso às plataformas antes de usar a coleta.

## Limites atuais

A detecção de plataforma usa expressões regulares sobre a string completa, sem validação estrita de hostname. O servidor e a rota de scraping não incluem middleware de autenticação nem limitação de requisições. A rota registra a URL e um resumo do resultado em logs; esses pontos precisam de tratamento antes de expor o serviço publicamente.

O manifesto não define um script `test`. O arquivo `test-scraper.ts` é separado do fluxo de desenvolvimento descrito acima; executar scrapers envolve serviços externos.

O campo `license` do manifesto declara ISC.

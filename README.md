# Clareza / Lab

Protótipo de pesquisa em Next.js para estruturação assistida de prompts educacionais e revisão humana de respostas de LLMs. O projeto parte da documentação do TCC; não representa resultados experimentais nem confirma automaticamente a veracidade de respostas.

## Requisitos

- Node.js 20.9 ou superior
- Uma API compatível com o endpoint OpenAI Chat Completions

## Começar

```sh
npm install
cp .env.example .env.local
```

Edite `.env.local` e informe as configurações do provedor:

```dotenv
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sua-chave
LLM_MODEL=nome-do-modelo-disponivel-na-sua-conta
LLM_TIMEOUT_MS=45000
```

Inicie o servidor de desenvolvimento:

```sh
npm run dev
```

Abra `http://localhost:3000`. As credenciais são lidas exclusivamente pela rota de servidor `/api/execute`; não use prefixos `NEXT_PUBLIC_` para segredos. Sem chave ou modelo configurados, a aplicação informa o erro e não simula uma resposta.

## Fluxo implementado

1. Descreva a intenção e escolha TAG, CLEAR ou RACE. A recomendação é uma heurística local explicável, não uma classificação feita por LLM.
2. Preencha os campos obrigatórios, adicione evidências se desejar e gere o prompt. O texto consolidado pode ser editado antes do envio.
3. Envie o prompt ao provedor configurado no servidor e escolha zero, uma ou duas revisões Self-Refine. As versões ficam disponíveis para comparação.
4. Revise as frases candidatas, marque afirmações confirmadas/incorretas/não verificáveis e avalie a aderência ao escopo.
5. Se desejar, habilite o histórico local e exporte os registros em JSON. O salvamento é opcional, limitado ao navegador atual e não sincroniza com servidor.

## Limites importantes

- A separação de frases e a sugestão de categoria são heurísticas. Não há verificação factual automatizada, busca na web, RAG nem julgamento por um segundo modelo.
- “Não confirmada” não significa “falsa”. Acurácia, taxa de incorretas e aderência só são calculadas após anotações humanas; a densidade usa uma estimativa de tokens baseada em palavras separadas por espaços.
- O histórico guarda prompt e resposta em `localStorage` quando habilitado e mascara formatos comuns de e-mail e telefone na exportação. As marcações de revisão ainda não são incluídas no histórico. A máscara não garante anonimização completa; revise e remova outros dados identificáveis antes de compartilhar o arquivo exportado.
- As chamadas ao provedor podem ter custo e estão sujeitas a limites e políticas do serviço escolhido. Forneça somente dados que você tem autorização para enviar.
- O protótipo limita tamanho do prompt, tempo e revisões, mas não inclui rate limiting distribuído por usuário/IP; publique atrás de uma camada de proteção adequada.
- Este protótipo não implementa autenticação, banco de dados, RAG ou conformidade jurídica certificada com a LGPD.

## Comandos

```sh
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Os testes usam `node:test` com suporte a TypeScript via `tsx`. Adicione testes `*.test.ts` em `tests/` e execute-os com `npm test`.

## Estrutura

- `app/page.tsx`: interface e fluxo de revisão humana.
- `app/api/execute/route.ts`: validação da solicitação e orquestração no servidor.
- `lib/frameworks.ts`: definição configurável de TAG, CLEAR e RACE.
- `lib/provider.ts`: adaptador para provedores compatíveis com Chat Completions.
- `lib/analysis.ts`: segmentação heurística e cálculo dos indicadores após revisão.

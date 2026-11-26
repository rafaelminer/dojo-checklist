# Dojo Checklist

Checklist operacional do Dojo com **fotos como prova**, **conferência da gerência** e **chat da equipe**. Interface escura (tema Dojo), responsiva, com modo claro opcional.

## Rodando localmente

Requisitos: Node.js 20+ (testado em Node 24).

```bash
npm install
npm run dev
```

Abra o endereço mostrado pelo Vite (normalmente `http://localhost:5173`).

Outros comandos:

```bash
npm run typecheck   # TypeScript
npm run build       # gera dist/
npm run preview     # serve dist/ com o mesmo backend local
```

## Logins de exemplo

| Login | Senha | Perfil |
| --- | --- | --- |
| `gerencia` | `dojo123` | Gerência (conferência, módulos e cadastro de funcionários) |
| `wesley` | `dojo123` | Hot Sushi |
| `lais` | `dojo123` | Quiosque |
| `paola` | `dojo123` | Copa |

A gerência pode **editar login e senha** de qualquer pessoa, inclusive da equipe inicial, em **Conferência → Cadastro de funcionários**. Novos funcionários criados por lá entram na lista de pessoas, no seletor de conferência, no chat e no grupo escolhido.

## Permissões

- **Funcionário:** vê apenas o próprio checklist. Abas: Checklist, Chat e Módulos (módulos em somente leitura).
- **Gerência:** não tem aba de Checklist. Abas: Chat, Conferência e Módulos.
  - Confere as produções enviadas, aprova ou pede correção escrevendo uma **observação**.
  - Aprovação/correção é registrada no histórico e enviada no chat.
  - É a única que inclui/edita/exclui módulos e cadastra/edita funcionários.

## Chat

- Conversas 1:1 entre qualquer pessoa e Gerência e entre colegas.
- Grupos: **Cozinha**, **Copa** e **Quiosque** (`grupo:cozinha`, `grupo:copa`, `grupo:quiosque`).
- Botões de aprovar/pedir correção aparecem apenas na conversa 1:1 com a Gerência.
- Funcionários cadastrados com grupo entram automaticamente no grupo correspondente.

## Mensagens automáticas diárias

Um cron da Vercel (`vercel.json`, todo dia às 12:00 UTC = 09:00 de Brasília) chama `/api/daily` e envia pelo chat:

- **Lembrete diário** para cada pessoa e para os grupos Cozinha/Copa/Quiosque.
- **Produção de ontem** para cada pessoa, com os itens feitos e quem mais fez os mesmos itens.

O resumo usa o catálogo de itens sincronizado no Supabase (`dojo_item_catalog`). Ambos os envios são deduplicados por data, então não repetem se o dia já foi processado. Cada mensagem também dispara notificação push.

A função exige o header `Authorization: Bearer <CRON_SECRET>`; configure `CRON_SECRET` na Vercel. Para testar manualmente:

```bash
curl -X POST https://dojo-checklist.vercel.app/api/daily \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Recursos de operação

- **Tarefas avulsas:** gerência cria com responsável, data e hora limite; aparece no checklist da pessoa; vencida fica vermelha e o cron diário avisa responsável e gerência.
- **Logbook da gerência:** registro estruturado por turno (ocorrências, decisões, visitas).
- **Treinamentos:** atribuição por pessoa, conclusão pelo funcionário e aprovação pela gerência.
- **Instruções padrão dos itens:** gerência edita em Módulos → “Instruções padrão dos itens”; o texto aparece no card do item.
- **Próximas pendências:** no topo do dashboard da gerência.
- **Alerta de item crítico:** itens de Limpeza/Organização/temperatura marcados como “Não feito” avisam gerência e grupo automaticamente.
- **Sugestão por histórico:** calcula a quantidade média dos últimos dias da semana iguais e oferece “Usar” no card do item.
- **Produção compartilhada:** mostra, para cada colega que faz os mesmos itens, o progresso de hoje de ambos e o que falta a cada um.
- **Dependência entre itens:** itens como Salmão Maki, Nigiri finalizado e Nigiri de camarão só podem ser marcados como Feito depois de suas etapas anteriores.
- **Comando de voz:** botão “Falar ou anotar item” no checklist; abre um painel com reconhecimento em pt-BR e um campo de texto alternativo que funciona em qualquer navegador (ex.: “Ebi Hot 12”). Marca como Feito e salva a quantidade em um único registro.
- **Ficha do produto:** toque no nome do item para ver foto de referência, padrão, instrução, sugestão, que foi feito ontem e colegas que fazem o mesmo item.
- **QR por estação:** gerência gera um QR por pessoa/posto; ao escanear, o app abre com o login preenchido.
- **Compartilhar relatório:** usa o menu de compartilhar do celular (WhatsApp incluído), com download como fallback.
- **Passagem de turno automática:** botão “Puxar pendências” preenche o recado com pendências, faltas, temperaturas fora da faixa, tarefas atrasadas e não feitos.
- **Confirmação de leitura:** mensagens da gerência podem ser confirmadas pelo destinatário; a gerência vê “Lido por …”.
- O chat carrega até 1000 mensagens (antes eram só 100).
- **PDF:** botão “PDF” gera o relatório em A4 (biblioteca carregada sob demanda).
- **Navegação do dashboard:** atalhos Conferência / Equipe / Qualidade rolam até a área correspondente.
- **Senhas com hash:** funcionários cadastrados agora têm Senha SHA-256; cadastros antigos em texto puro continuam funcionando por compatibilidade.
- **Limpeza:** busca ⌘K sem botão visível e banner inalcançável da gerência removidos; Módulos mostra só coleções úteis.
- **ErrorBoundary:** erro de renderização mostra tela de recarga em vez de página em branco.
- **Push:** inscrições inválidas (404/410/400) são removidas automaticamente.

## Notificações push

O app registra um service worker (`public/sw.js`) e envia notificações reais quando uma mensagem chega, mesmo com o app fechado.

- **iPhone:** abra o site no **Safari** → botão Compartilhar → **Adicionar à Tela Inicial** → abra o ícone instalado.
- **Android:** abra no **Chrome** → menu → **Instalar app** / **Adicionar à tela inicial**.
- No app, toque no **sino** no cabeçalho e permita notificações. O registro é salvo em `dojo_push_subscriptions` no Supabase.

Variáveis de ambiente necessárias no servidor (Vercel):

```bash
vercel env add VITE_VAPID_PUBLIC_KEY -e production -e preview -e development
vercel env add VAPID_PUBLIC_KEY -e production -e preview -e development
vercel env add VAPID_PRIVATE_KEY -e production -e preview -e development
vercel env add VAPID_SUBJECT -e production -e preview -e development
vercel env add SUPABASE_URL -e production -e preview -e development
vercel env add SUPABASE_ANON_KEY -e production -e preview -e development
```

`VITE_VAPID_PUBLIC_KEY` e `VAPID_PUBLIC_KEY` recebem a **mesma** chave pública. A chave privada fica só no servidor. A função `api/push.js` envia o push para as inscrições do destinatário (ou do grupo) e nunca para quem enviou.

## Fotos

Tirar foto (câmera), escolher da galeria, pré-visualizar, excluir e desfazer exclusão. Fotos são comprimidas antes de salvar no registro.

## Backend / persistência

O app suporta três modos, em ordem de prioridade:

1. **Produção (recomendado):** `VITE_ACTIONS_URL=/api/actions`. O navegador chama a função da Vercel (`api/actions.js`), que usa `SUPABASE_SERVICE_ROLE_KEY` no servidor. A chave anon não é necessária.
2. **Modo antigo (dev):** `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` chamam o PostgREST direto. Só use se as políticas RLS permitirem.
3. **Local:** sem nenhuma dessas variáveis, o plugin do Vite responde `POST /actions` e grava em `.data/db.json`.

### Fechar o banco (depois do deploy)

Rode `supabase/migrations/20261126000000_lockdown.sql` no SQL Editor do Supabase. Ele revoga `anon`/`authenticated` na tabela `records`, deixando só `service_role`. O cron e o push já usam `service_role`.

**Status:** lockdown já aplicado no projeto de produção via Supabase CLI (`supabase db push --remote --include-all`). Acesso direto com a chave anon retorna `401 permission denied`; o app continua funcionando pelo proxy.

### Configurando o Supabase

1. No projeto Supabase, abra **SQL Editor** e rode o arquivo [`supabase/migrations/20261125000000_records.sql`](supabase/migrations/20261125000000_records.sql). Ele cria a tabela `records` (`id`, `collection`, `value jsonb`) e políticas RLS.
2. Copie `.env.example` para `.env.local` e preencha:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

3. Rode `npm run dev` (ou `npm run build`). O status no login deve mostrar **Conectado**.

A chave `anon` é pública por design; o controle de acesso (gerência vs. funcionário) é feito na interface. As políticas RLS do SQL acima liberam leitura/escrita para `anon` — se quiser restringir, troque `using (true)` por regras com `auth.uid()` e implemente login via Supabase Auth.

### Contrato antigo (ainda usado no modo local)

```
POST actions
{ "action": "records.list" | "records.create" | "records.replace" | "records.delete", "args": { "collection": "...", ... } }
→ { "data": ... }
```

Coleções usadas: `dojo_entries`, `dojo_chat`, `dojo_submissions`, `dojo_temps`, `dojo_shifts`, `dojo_action_plans`, `dojo_handovers`, `dojo_shortages`, `dojo_weekly`, `dojo_expiries`, `dojo_maintenance`, `dojo_credentials`, `checklists`, `checklist_items`, `task_templates`.

## Estrutura

```
index.html
.env.example                         # modelo das variáveis Supabase
src/main.tsx                          # ponto de entrada
src/App.tsx                           # aplicação + adaptador Supabase/local
src/index.css                         # tokens de tema + estilos (Tailwind v4)
src/vite-env.d.ts                     # tipagem das variáveis de ambiente
vite.config.ts                        # Vite + React + Tailwind + backend local /actions
supabase/migrations/...records.sql    # tabela records + RLS
tsconfig.json
```

## Publicando no GitHub

```bash
git init
git add .
git commit -m "Dojo Checklist"
git branch -M main
git remote add origin https://github.com/<seu-usuario>/<seu-repo>.git
git push -u origin main
```

Para GitHub Pages, rode `npm run build` e publique `dist/`. Lembre-se de disponibilizar a rota `actions` no mesmo domínio (ou ajuste o `fetch` em `src/App.tsx` para a URL do seu backend).

### Deploy na Vercel

O `.env.local` vale apenas na sua máquina. Na Vercel, configure as variáveis no projeto (painel **Settings → Environment Variables** ou CLI):

```bash
vercel env add VITE_SUPABASE_URL -e production -e preview -e development
vercel env add VITE_SUPABASE_ANON_KEY -e production -e preview -e development
vercel --prod
```

As variáveis são lidas durante o build — depois de alterá-las, faça um novo deploy. Sem elas, o app cai no modo local e a rota `actions` retorna 404 ("Conexão: erro").

## Licença

MIT — veja `LICENSE`.

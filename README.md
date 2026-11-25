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

## Fotos

Tirar foto (câmera), escolher da galeria, pré-visualizar, excluir e desfazer exclusão. Fotos são comprimidas antes de salvar no registro.

## Backend / persistência

O app suporta dois modos, escolhidos automaticamente:

1. **Supabase (produção):** se `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` estiverem preenchidos, `src/App.tsx` chama o PostgREST diretamente na tabela `records`.
2. **Local (dev):** sem essas variáveis, um plugin do Vite (`vite.config.ts`) responde `POST /actions` e grava em `.data/db.json` (ignorado pelo Git).

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

## Licença

MIT — veja `LICENSE`.

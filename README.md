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

O app chama:

```
POST actions
{ "action": "records.list" | "records.create" | "records.replace" | "records.delete", "args": { "collection": "...", ... } }
```

com resposta `{ "data": ... }`.

Para `npm run dev` e `npm run preview`, este repositório inclui um plugin do Vite (`vite.config.ts`) que responde a essa rota e grava em `.data/db.json` (ignorado pelo Git). Em produção, substitua esse endpoint pelo seu backend — o front-end não muda, pois a URL é relativa (`actions`).

Coleções usadas: `dojo_entries`, `dojo_chat`, `dojo_submissions`, `dojo_temps`, `dojo_shifts`, `dojo_action_plans`, `dojo_handovers`, `dojo_shortages`, `dojo_weekly`, `dojo_expiries`, `dojo_maintenance`, `dojo_credentials`, `checklists`, `checklist_items`, `task_templates`.

## Estrutura

```
index.html
src/main.tsx      # ponto de entrada
src/App.tsx       # aplicação (estado, permissões, chat, fotos, módulos)
src/index.css     # tokens de tema + estilos (Tailwind v4)
vite.config.ts    # Vite + React + Tailwind + backend local /actions
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

# Política de Privacidade e LGPD — Dojo Checklist

**Controlador:** Dojo Checklist (operação interna do restaurante)  
**Aplicação:** https://dojo-checklist.vercel.app  
**Última atualização:** 27/11/2026

## 1. Dados coletados

| Categoria | Exemplos | Finalidade |
| --- | --- | --- |
| Identificação funcional | nome, login, senha (hash SHA-256), unidade, setor, turno, grupo do chat | autenticar e mostrar só o que é da pessoa |
| Execução de checklist | status dos itens, quantidade produzida, justificativas, horários, quem alterou | registrar a operação e conferir a produção |
| Evidências | fotos tiradas ou enviadas, fotos de referência, assinatura desenhada | comprovar a execução e conferir o padrão |
| Comunicação | mensagens do chat 1:1 e dos grupos, confirmações de leitura, ocorrências | coordenar a equipe e registrar pendências |
| Qualidade | respostas de auditoria, notas, pareceres, validade de produtos, temperaturas | controlar padrão, riscos e conformidade |
| Estoque e recebimento | itens contados, saldo esperado, quantidade recebida, divergências | controlar insumos e perdas |
| Técnicos | token de sessão (JWT, em `sessionStorage`), tema, preferências | manter a sessão e a interface |

## 2. Base legal e finalidade

Os dados são tratados para **execução de contrato e interesses legítimos da operação** (organização da rotina, rastreabilidade, conferência da gerência e comunicação interna). Não há publicidade, perfilamento comercial nem compartilhamento com terceiros para fins de marketing.

## 3. Compartilhamento

- **Supabase** (infraestrutura de banco e autenticação): hospedagem dos registros e gerenciamento de usuários.
- **Vercel** (hospedagem da aplicação e das funções de proxy): execução do app e do backend.
- **Provedores de push** (Web Push/FCM): entrega das notificações aos aparelhos autorizados.
- **WhatsApp**: apenas quando a pessoa aciona o botão de alerta, que abre uma conversa com texto preenchido. Nenhum envio é feito automaticamente sem ação do usuário.

Não vendemos nem cedemos dados.

## 4. Segurança

- Acesso ao banco apenas por **JWT validado** no proxy; a chave `service_role` fica exclusivamente no servidor.
- Políticas RLS revogam acesso direto de `anon`/`authenticated` à tabela de registros.
- Senhas armazenadas com hash SHA-256; sessão em `sessionStorage` (encerrada ao sair).
- HTTPS em todas as conexões.

## 5. Retenção e exclusão

- Registros operacionais são mantidos enquanto necessários à gestão da operação e à conferência histórica.
- O app oferece exportação de relatórios para conferência e auditoria.
- Fotos e assinaturas devem ser excluídas quando deixarem de ser necessárias; a gerência pode solicitar a remoção de qualquer registro ao administrador do sistema.
- Não há, nesta versão, rotina automática de exclusão por prazo. Recomenda-se definir a política de retenção da operação (ex.: 12 ou 24 meses) e aplicá-la ao backend.

## 6. Direitos do titular

O titular pode solicitar confirmação do tratamento, acesso aos dados, correção, portabilidade, anonimização, bloqueio ou exclusão, além de informações sobre compartilhamentos. Solicitações devem ser feitas ao gestor da operação, que as encaminhará ao administrador do sistema.

## 7. Cookies e armazenamento local

Não usamos cookies de rastreamento. O app usa `localStorage` para tema e fila offline, e `sessionStorage` para o token de sessão.

## 8. Alterações

Esta política pode ser atualizada. A versão vigente fica sempre disponível em `/privacidade.html` e neste repositório.

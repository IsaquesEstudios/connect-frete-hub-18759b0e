# Script SQL para baixar a CPU do banco

O relatório aponta três custos que se somam a cada consulta: chaves estrangeiras sem índice, funções de autenticação (`auth.uid()`) reavaliadas linha a linha dentro das políticas de segurança e políticas permissivas duplicadas para a mesma ação. Com a CPU saturada, as consultas estouram o tempo limite — e o login, que lê o perfil, é o primeiro a falhar.

Vou entregar um único arquivo, `docs/sql/performance-cpu.sql`, para você rodar uma vez no editor SQL do banco (blyx). Nenhuma alteração será aplicada daqui.

## Conteúdo do script

**1. Índices nas chaves estrangeiras sinalizadas pelo Advisor**
- `broadcast_messages.tag_id`
- `conversation_tags.tag_id`
- `messages.from_user_id` e `messages.to_user_id` (complementando os índices compostos que já existem)

**2. Índices de apoio para as telas mais pesadas**
- `conversation_tags(conversation_id)` — filtro de etiquetas no painel
- `profiles(type)` e `profiles(last_seen_at DESC)` — tabela de usuários e métricas
- `broadcast_messages(sent_at DESC)` — histórico de envios em massa (hoje dá timeout)

**3. Reescrita das políticas RLS**

Todas as políticas de `profiles`, `messages`, `tags`, `conversation_tags` e `broadcast_messages` passam a usar `(select auth.uid())` no lugar de `auth.uid()`. O Postgres então avalia o valor uma única vez por consulta, em vez de uma vez por linha — é o item de maior ganho conforme a tabela de mensagens cresce.

As regras de acesso permanecem exatamente as mesmas (dono do registro ou staff via `private.is_staff`); muda só a forma de avaliação.

**4. Consolidação de políticas duplicadas**

Em `tags` existem hoje duas políticas permissivas de SELECT para o mesmo papel (`tags_select_access` e o SELECT embutido em `tags_staff_manage`). O mesmo padrão aparece nas demais tabelas com política `ALL` + políticas específicas. O script substitui cada par por uma política única por ação, mantendo a permissão final idêntica.

**5. Fechamento**
- `ANALYZE` nas tabelas alteradas, para o planejador usar os novos índices imediatamente.
- Uma consulta de verificação (`pg_stat_statements` ordenado por tempo total) para você comparar antes/depois.

## Como rodar

O script é idempotente (`IF NOT EXISTS` / `DROP POLICY IF EXISTS` seguido de `CREATE POLICY`) e pode ser executado inteiro de uma vez. Os índices usam `CREATE INDEX` normal (bloqueio curto); se preferir zero bloqueio, indico a variante `CONCURRENTLY` em comentário no próprio arquivo.

## Se a CPU não cair o suficiente

Depois de aplicar, me envie de novo o topo do `pg_stat_statements`. Se o tempo continuar concentrado nas mesmas consultas mesmo com os índices, o gargalo é o tamanho da instância e o caminho passa a ser aumentar o compute do banco.

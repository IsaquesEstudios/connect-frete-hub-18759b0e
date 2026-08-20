# Reduzir o consumo de CPU do banco (e destravar o login)

O diagnóstico que você recebeu é coerente com o que o app faz hoje: o banco está gastando CPU em cada requisição por causa de políticas de segurança reavaliadas linha a linha e chaves estrangeiras sem índice. Quando a CPU satura, as consultas batem timeout — e o login é justamente uma consulta ao perfil, por isso ele falha primeiro.

Importante: o banco usado pelo app é o externo (projeto próprio), então eu não consigo aplicar migrações por aqui. Vou preparar um script SQL revisado e você roda uma vez no editor SQL do seu banco.

## O que será feito

### 1. Script SQL de performance (`docs/sql/performance-cpu.sql`)

- Índices nas chaves estrangeiras apontadas pelo Advisor: `broadcast_messages` e `conversation_tags`.
- Reescrita das políticas RLS que usam `auth.uid()` / `auth.role()` diretamente para a forma `(select auth.uid())`. Isso faz o Postgres avaliar o valor **uma vez por consulta** em vez de uma vez por linha — é o item de maior impacto quando as tabelas crescem.
- Consolidação de políticas permissivas duplicadas (mesma ação + mesmo papel) em uma única política por ação, nas tabelas `profiles`, `messages`, `tags`, `conversation_tags` e `broadcast_messages`.
- Índices de apoio para as consultas mais quentes (mensagens por conversa/destinatário, perfis por tipo/último login), complementando o que já existe em `docs/sql/messages-indexes.sql`.
- `ANALYZE` nas tabelas alteradas ao final.

Antes de escrever as políticas definitivas eu preciso ler as políticas atuais do seu banco — o script incluirá, no topo, uma consulta de inspeção (`pg_policies`) para você me enviar o resultado, ou você me envia agora e eu já entrego o script final sem etapa intermediária.

### 2. Reduzir a pressão vinda do app

- Revisar as revalidações periódicas do painel (`refreshCurrentUser` a cada 60s por aba aberta) e alinhar com o realtime, evitando consulta redundante quando a aba está inativa.
- Conferir se alguma listagem administrativa ainda faz varredura sem limite/índice (métricas, usuários, envios em massa) e ajustar a consulta para usar os novos índices.

### 3. Verificação

- Depois de aplicar o SQL, comparar novamente o `pg_stat_statements` (tempo total e média por consulta) e confirmar que os `statement timeout` sumiram dos logs.
- Testar o login do cliente afetado.

## Se a CPU continuar alta

Se após os índices e o ajuste de RLS o uso continuar próximo do teto, o gargalo passa a ser tamanho da instância: aí o caminho é aumentar o plano/compute do banco. Isso é uma decisão sua, e eu aviso com base nos números pós-otimização.

## Detalhes técnicos

- Alterações de schema no banco externo só podem ser aplicadas manualmente por você; nenhuma migração será executada daqui.
- Os arquivos tocados no projeto: novo `docs/sql/performance-cpu.sql` e, se necessário, ajustes pontuais em `src/routes/_app/route.tsx` e nas funções de consulta em `src/lib/data/`.

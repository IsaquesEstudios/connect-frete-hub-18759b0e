-- ============================================================================
-- SV Logística — Limpeza das políticas RLS antigas (rodar DEPOIS do
-- docs/sql/performance-cpu.sql, no SQL Editor do banco externo)
-- ----------------------------------------------------------------------------
-- O script de performance criou UMA política por ação/tabela. Sobraram as
-- políticas antigas (bc_admin_*, ctags_*, msg_user_*, profiles_read, etc.),
-- que continuam sendo avaliadas em toda consulta e mantêm o custo alto.
--
-- Este bloco remove, nas 5 tabelas otimizadas, tudo o que NÃO faz parte do
-- conjunto novo. As permissões finais continuam as mesmas: dono do registro
-- ou equipe (private.is_staff cobre admin e colaborador).
-- Idempotente: pode rodar mais de uma vez.
-- ============================================================================

DO $$
DECLARE
  r record;
  keep text[] := ARRAY[
    -- profiles
    'profiles_select_access','profiles_insert_access','profiles_update_access','profiles_delete_access',
    -- messages
    'messages_select_access','messages_insert_access','messages_update_access','messages_delete_access',
    -- tags
    'tags_select_access','tags_insert_staff','tags_update_staff','tags_delete_staff',
    -- conversation_tags
    'conversation_tags_select_staff','conversation_tags_insert_staff',
    'conversation_tags_update_staff','conversation_tags_delete_staff',
    -- broadcast_messages
    'broadcast_messages_select_staff','broadcast_messages_insert_staff',
    'broadcast_messages_update_staff','broadcast_messages_delete_staff'
  ];
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles','messages','tags','conversation_tags','broadcast_messages')
      AND NOT (policyname = ANY (keep))
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    RAISE NOTICE 'Removida política antiga: %.%', r.tablename, r.policyname;
  END LOOP;
END
$$;

ANALYZE public.profiles;
ANALYZE public.messages;
ANALYZE public.tags;
ANALYZE public.conversation_tags;
ANALYZE public.broadcast_messages;


-- ============================================================================
-- VERIFICAÇÃO (deve voltar 0 linhas)
-- ============================================================================
-- SELECT tablename, cmd, count(*)
-- FROM pg_policies
-- WHERE schemaname = 'public' AND permissive = 'PERMISSIVE'
-- GROUP BY 1,2 HAVING count(*) > 1
-- ORDER BY 1,2;
--
-- Conferir o conjunto final:
-- SELECT tablename, cmd, policyname FROM pg_policies
-- WHERE schemaname='public' ORDER BY tablename, cmd;
-- ============================================================================

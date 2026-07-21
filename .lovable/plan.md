## Diagnóstico

O email não fica em `profiles` — vive em `auth.users` do banco externo (blyx). As telas de perfil (ChatWindow, AdminEditUserDialog, tabela de Usuários) buscam via server function `getExternalUserEmailsForIds`/`getExternalUserEmails`, que usa `process.env.EXT_SUPABASE_SERVICE_ROLE_KEY` no servidor.

Hoje o `ChatWindow` faz:

```ts
getExternalUserEmailsForIds(...).then(...).catch(() => undefined);
```

Ou seja: se a chamada falhar (por qualquer motivo), o erro é engolido e o campo mostra "Não informado". Como acontece em **todos os lugares que você clica**, a hipótese mais provável é que a server function esteja falhando de forma sistemática no ambiente publicado (Coolify) — normalmente porque a env var `EXT_SUPABASE_SERVICE_ROLE_KEY` não está setada no container, ou a chave está inválida/rotacionada, ou o bearer do usuário não chega.

## Passos do plano

1. **Instrumentar a causa real (rápido, não invasivo).**
   - Em `src/components/chat/ChatWindow.tsx`, `src/components/admin/AdminEditUserDialog.tsx` e `src/routes/_app/usuarios.tsx`: trocar `.catch(() => undefined)` por um `.catch(err => console.warn("[emails]", err))` que também exibe um `toast` discreto na primeira falha por sessão, mostrando a mensagem retornada pelo servidor (ex.: "Configuração do servidor ausente", "Sessão inválida", etc.). Isso resolve a regra do projeto de sempre mostrar o motivo real do erro.

2. **Melhorar as mensagens do servidor** em `src/lib/data/emails.functions.ts` para distinguir:
   - `EXT_SUPABASE_SERVICE_ROLE_KEY` ausente → "Configuração do servidor ausente: EXT_SUPABASE_SERVICE_ROLE_KEY".
   - Falha 401/403 do Admin API → mensagem explícita (ex.: "Chave de serviço rejeitada pelo banco externo").
   - Assim, o toast do passo 1 vira acionável.

3. **Fallback quando o servidor não pode fornecer email.**
   - Para o próprio usuário logado, já temos o email na sessão — garantir que `other.email` já venha preenchido quando `other.id === me.id` (não passar pela server function).
   - Nos demais casos, se a server function falhar, exibir "Email indisponível (verifique EXT_SUPABASE_SERVICE_ROLE_KEY no servidor)" em vez de "Não informado", para deixar claro que o problema é de configuração e não de dado faltante.

4. **Checagem operacional (a ser feita por você, sem alterar código):**
   - Confirmar no Coolify que a env var `EXT_SUPABASE_SERVICE_ROLE_KEY` está setada no serviço em produção (o valor no painel de Secrets do Lovable Cloud não é propagado automaticamente para a VPS).
   - Se estiver ausente/desatualizada, adicionar/atualizar e redeploy.

## Escopo

Somente:
- `src/components/chat/ChatWindow.tsx`
- `src/components/admin/AdminEditUserDialog.tsx`
- `src/routes/_app/usuarios.tsx`
- `src/lib/data/emails.functions.ts`

Nenhuma mudança em regras de negócio, RLS, schema ou fluxo de auth.

## Resultado esperado

- Você passa a ver, no primeiro clique em um perfil, um toast com o motivo real do "Não informado" (ex.: "Configuração do servidor ausente: EXT_SUPABASE_SERVICE_ROLE_KEY").
- Após corrigir a env var no Coolify e redeploy, os emails passam a aparecer em todos os perfis (chat, edição admin, tabela de usuários).

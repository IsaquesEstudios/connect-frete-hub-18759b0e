## Plano

1. **Corrigir o ID da conversa salvo no banco**
   - Ajustar o envio de mensagem para que conversas entre admin/colaborador e usuário usem o mesmo padrão que a tela do usuário consegue ler: `USUARIO__STAFF`.
   - Evitar que o banco salve apenas `EMP-0001` / `MOT-0001`, porque isso pode deixar a resposta fora da conversa aberta pelo usuário.

2. **Compatibilizar mensagens antigas e novas**
   - Manter a leitura aceitando os formatos antigos e novos para não “sumir” histórico já existente.
   - Ao listar a conversa com o admin, incluir também mensagens enviadas por colaboradores/admins diferentes quando for o atendimento compartilhado.

3. **Melhorar o feedback quando o envio falhar**
   - Trocar o erro silencioso no console por uma notificação clara na tela, explicando se foi permissão, sessão expirada ou outro erro do banco.

4. **Validar o fluxo**
   - Conferir no código e no banco se a mensagem enviada pelo admin fica vinculada ao usuário correto.
   - Testar o cenário: admin responde um usuário e a conversa do usuário lista a resposta no chat correto.

## Detalhes técnicos

- Arquivo principal: `src/lib/data/supabaseRepository.ts`.
- Possível ajuste pontual em `ChatWindow.tsx` / `UserChatPanel.tsx` se a listagem ainda depender de um ID fixo.
- Não vou alterar outras áreas do sistema fora do fluxo de chat.
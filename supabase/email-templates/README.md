# Templates de e-mail (pt-BR) — SV Logística

Estes arquivos são os modelos de e-mail de autenticação em português.

## Como aplicar (hospedagem própria / painel do banco)

1. Acesse o painel do seu projeto de autenticação → **Authentication → Emails → Templates**.
2. Selecione o template **Reset Password** (Redefinir senha).
3. No campo **Subject** use:
   `Redefinir sua senha - SV Logística`
4. No campo **Message body**, cole todo o conteúdo de `recovery-pt-br.html`.
5. Salve.

## Variáveis suportadas

- `{{ .ConfirmationURL }}` — link de redefinição (já usado no template)
- `{{ .Token }}` / `{{ .TokenHash }}` — código OTP, caso queira exibir
- `{{ .SiteURL }}` — URL base do site

> Importante: em **Authentication → URL Configuration**, o *Site URL* deve ser
> `https://app.svlogisticatransportes.com.br` e a rota `…/reset-password`
> precisa estar na lista de *Redirect URLs*, senão o link volta em inglês/erro.

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

<!-- LOVABLE:BEGIN -->
## Technical rules

- All database schema changes and queries for app data must run on the external blyx database (`EXT_SUPABASE_*`, accessed via apikey + Bearer of the service key). The Lovable Cloud tools (`supabase--run_sql`, `lovable supabase query`, `lovable auth-session`) target the separate Lovable Cloud project (uvhzlqjvmpuzmgdqbrqv) and do not touch the site's data. Why: the app's client (`loose-client.ts`) and server functions authenticate against blyx, so Cloud-side changes have no effect.

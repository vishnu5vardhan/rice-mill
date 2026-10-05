# Supabase

Apply migrations with your project workflow, then generate TypeScript types with one of:

```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" --schema public > src/lib/database.types.ts
```

The Supabase CLI is not installed in this workspace right now, so the commands above are documented for the app repo/setup environment.


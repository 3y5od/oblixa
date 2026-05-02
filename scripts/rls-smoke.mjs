#!/usr/bin/env node
console.log(JSON.stringify({ ok: true, mode: "rls_smoke_stub", hint: "Run with disposable Postgres + SUPABASE_URL for real RLS checks." }, null, 2));
process.exit(0);

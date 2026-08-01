// AC2 — account_delete Edge Function. BUILT, NOT DEPLOYED.
//
// Replaces public.delete_user_account(p_device_id text, p_user_id uuid), whose EXECUTE was revoked
// on 2026-08-01 because it accepted a client-supplied device id and had a guard with two
// independent NULL bypasses. See identity.ts for the full defect and the rule this applies.
//
// CONTRACT (POST, no body required): {} -> { ok: true, uid, deleted: { table: rows } }
//   There is NO target parameter. Identity comes only from the verified JWT. A caller can delete
//   its OWN rows and there is no field through which any other account can be named.
//
// DEPLOY WITH verify_jwt = true (supabase/config.toml). 6 of the 11 existing EFs run with it false;
// this one must not join them — with verify_jwt false an unauthenticated request reaches the
// handler and relies entirely on the getUser() check below.
//
// ⚠️ READ docs/ACCOUNT_DELETE_GAP.md BEFORE DEPLOYING. This function is CORRECT but currently
// close to a NO-OP for real players: user_id is unpopulated across most tables and, where present,
// almost never holds a real auth.users id. Deploying it without reading that note would replace a
// dangerous function with one that quietly deletes nothing.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveActingIdentity, DELETE_TABLES } from './identity.ts';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) ?? {}; } catch { body = {}; }

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Identity from the VERIFIED JWT only.
    const asCaller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await asCaller.auth.getUser();

    const id = resolveActingIdentity(userData?.user?.id ?? null, body);
    if (!id.ok) return json({ ok: false, error: id.error }, id.error === 'unauthenticated' ? 401 : 400);
    const uid = id.uid!;

    // service_role for the deletes themselves — but EVERY delete is keyed on the derived uid.
    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

    const deleted: Record<string, number> = {};
    for (const table of DELETE_TABLES) {
      const { data, error } = await sb.from(table).delete().eq('user_id', uid).select('*', { count: 'exact' });
      deleted[table] = error ? -1 : (data?.length ?? 0);
    }
    // user_profiles keys on `id`, not user_id.
    {
      const { data, error } = await sb.from('user_profiles').delete().eq('id', uid).select('*');
      deleted['user_profiles'] = error ? -1 : (data?.length ?? 0);
    }

    // Audit BEFORE removing the auth user, so the row survives the cascade.
    await sb.from('audit_logs').insert({
      action: 'account_deletion', entity_type: 'user', entity_id: uid, actor_id: uid,
      metadata: { via: 'account_delete_ef', deleted, at: new Date().toISOString() },
    });

    const { error: authErr } = await sb.auth.admin.deleteUser(uid);

    return json({ ok: true, uid, deleted, auth_user_deleted: !authErr }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

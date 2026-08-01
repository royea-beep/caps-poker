// AC2 — account_merge Edge Function. BUILT, NOT DEPLOYED.
//
// ═══ THE HONEST ANSWER FIRST ═══
// The old merge_guest_to_user(p_device_id, p_user_id) CANNOT be safely rebuilt in its old form.
// Z2 established there is NO trustworthy device -> owner mapping anywhere: push_tokens has 0 rows
// with a user_id, leaderboard.user_id matches auth.users 0 times, and device ids are harvestable by
// anyone. So a function that merges "this device" into "this user" has no way to know the caller
// owns that device. **A merge keyed on a device id is unbuildable, and it should not come back.**
//
// ═══ WHAT IS BUILDABLE ═══
// The caller CAN prove ownership of two IDENTITIES, because at merge time it holds BOTH tokens:
// the anonymous session it has been playing under, and the new session it just signed into. So the
// merge is keyed on two VERIFIED JWTs, never on a device id:
//
//   Authorization: Bearer <NEW session JWT>     -> the destination uid
//   X-Prior-Session: Bearer <ANON session JWT>  -> the source uid
//
// Both are verified server-side against auth. A caller can only merge accounts it can currently
// authenticate as, which is exactly the property the device id never had.
//
// ═══ THE BETTER FIX, RECORDED SO IT IS NOT MISSED ═══
// This EF should be a MIGRATION AID, not a permanent feature. The reason a merge is needed at all
// is that the app calls signInWithGoogle(), which creates a NEW user and abandons the anonymous
// uid. Supabase supports `auth.linkIdentity()`, which attaches Google to the EXISTING anonymous
// user and KEEPS THE SAME uid — after which there is nothing to merge, by construction. Moving the
// client to linkIdentity removes this function's reason to exist. Prefer that.
//
// CONTRACT (POST, no body): {} -> { ok: true, from, to, moved: { table: rows } }
// NO device parameter. NO target parameter. DEPLOY WITH verify_jwt = true.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { resolveActingIdentity, DELETE_TABLES } from '../account_delete/identity.ts';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-prior-session',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s: number) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'content-type': 'application/json' } });

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);

  try {
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) ?? {}; } catch { body = {}; }

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const verify = async (header: string) => {
      const c = createClient(url, anonKey, {
        global: { headers: { Authorization: header } }, auth: { persistSession: false },
      });
      const { data } = await c.auth.getUser();
      return data?.user?.id ?? null;
    };

    // DESTINATION — the session the caller is now using.
    const toId = resolveActingIdentity(await verify(req.headers.get('Authorization') ?? ''), body);
    if (!toId.ok) return json({ ok: false, error: toId.error }, toId.error === 'unauthenticated' ? 401 : 400);

    // SOURCE — proven by presenting the prior session's token, not by naming a device.
    const priorHeader = req.headers.get('X-Prior-Session') ?? '';
    if (!priorHeader) return json({ ok: false, error: 'prior_session_required' }, 400);
    const fromUid = await verify(priorHeader);
    if (!fromUid) return json({ ok: false, error: 'prior_session_invalid' }, 401);

    if (fromUid === toId.uid) return json({ ok: true, from: fromUid, to: toId.uid, moved: {}, note: 'same_identity_noop' }, 200);

    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
    const moved: Record<string, number> = {};
    for (const table of DELETE_TABLES) {
      const { data, error } = await sb.from(table).update({ user_id: toId.uid }).eq('user_id', fromUid).select('*');
      moved[table] = error ? -1 : (data?.length ?? 0);
    }

    await sb.from('audit_logs').insert({
      action: 'account_merge', entity_type: 'user', entity_id: toId.uid, actor_id: toId.uid,
      metadata: { via: 'account_merge_ef', from: fromUid, moved, at: new Date().toISOString() },
    });

    return json({ ok: true, from: fromUid, to: toId.uid, moved }, 200);
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

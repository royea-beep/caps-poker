-- ============================================================================================
-- THE 06:00 HEBREW MORNING REPORT — off the dead app_config keys, onto the devices.
--
-- It printed:  '📱 Build: ' || app_config.current_version || ' (' || app_config.current_build || ')'
-- which rendered "2.7.0 (465)". 465 is a hand-maintained key that stopped being updated in the
-- same May 2026 lapse that froze build_history — wrong by 43 builds against the phone's 508.
--
-- Replaced with get_live_build(), which derives the answer from what installed binaries report.
-- An unknown build now prints "לא ידוע" and a stale one is flagged "⚠️ מידע ישן", because a
-- report that says "I don't know" is recoverable and one that states a wrong number is not.
--
-- ONLY the build lines changed. Bugs, crashes, pipeline, economy and the pending-sessions list
-- are reproduced verbatim from the live definition, and the `json` return type is preserved
-- (CREATE OR REPLACE cannot change it, and the WhatsApp sender reads `message`).
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.get_daily_digest()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_message TEXT;
  v_build   jsonb := public.get_live_build();
BEGIN
  v_message := '☀️ *CAPS דוח בוקר — ' || to_char(now(), 'DD/MM') || '*' || E'\n\n';

  v_message := v_message || '🐛 באגים: ' ||
    (SELECT COUNT(*) FROM bug_reports WHERE status = 'open') || ' פתוחים, ' ||
    (SELECT COUNT(*) FROM bug_reports WHERE status = 'resolved' AND created_at > now() - interval '24 hours') || ' נסגרו אתמול' || E'\n';

  v_message := v_message || '💥 קריסות: ' ||
    (SELECT COUNT(*) FROM crash_reports WHERE status NOT IN ('fixed','dismissed') AND error_message NOT LIKE '%dirty%') || ' אמיתיות, ' ||
    (SELECT COUNT(*) FROM crash_reports WHERE created_at > now() - interval '24 hours' AND error_message LIKE '%dirty%') || ' false+' || E'\n';

  v_message := v_message || '🔧 Pipeline: ' ||
    (SELECT COUNT(*) FROM whatsapp_sessions WHERE status IN ('bug_sent','crash_pending')) || ' ממתינים, ' ||
    (SELECT COUNT(*) FROM whatsapp_sessions WHERE status IN ('bug_approved','crash_approved')) || ' בתיקון' || E'\n';

  v_message := v_message || '💰 כלכלה: ' ||
    (SELECT SUM(total_chips) FROM leaderboard) || ' chips, ' ||
    (SELECT COUNT(*) FROM leaderboard) || ' שחקנים' || E'\n';

  -- BUILD: was app_config.current_version + app_config.current_build = "2.7.0 (465)". Both are
  -- hand-maintained keys that stopped being updated in May; 465 was wrong by 43 builds. Now the
  -- devices answer, and an unknown or stale answer SAYS SO rather than printing a number.
  v_message := v_message || '📱 Build: ' ||
    COALESCE(v_build->>'version', '?') || ' (' ||
    COALESCE(v_build->>'build_number', 'לא ידוע') || ')' ||
    CASE WHEN (v_build->>'stale')::bool THEN ' ⚠️ מידע ישן' ELSE '' END || E'\n\n';

  v_message := v_message || '📋 *ממתינים לתשובה:*' || E'\n';

  v_message := v_message || COALESCE(
    (SELECT string_agg(
      '#' || report_number || ' — ' ||
      CASE media_type WHEN 'bug' THEN '🐛' ELSE '💥' END || ' ' ||
      SUBSTRING(raw_input FROM 'AI Summary:\*?\n?(.{1,60})'),
      E'\n' ORDER BY report_number
    ) FROM whatsapp_sessions
    WHERE status IN ('bug_sent', 'crash_pending', 'bug_needs_info')
    ), 'אין ממתינים! 🎉'
  );

  RETURN json_build_object(
    'message', v_message,
    'bugs_open', (SELECT COUNT(*) FROM bug_reports WHERE status = 'open'),
    'crashes_real', (SELECT COUNT(*) FROM crash_reports WHERE status NOT IN ('fixed','dismissed') AND error_message NOT LIKE '%dirty%'),
    'pending_sessions', (SELECT COUNT(*) FROM whatsapp_sessions WHERE status IN ('bug_sent','crash_pending','bug_needs_info')),
    'build', (v_build->>'build_number'),
    'build_source', (v_build->>'source')
  );
END; $fn$;

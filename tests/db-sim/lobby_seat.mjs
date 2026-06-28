/**
 * tests/db-sim/lobby_seat.mjs — exercises the seat-collision bug class
 * the strategist patched on Jun 26: join_table used to set
 * seat_index=current_players, which collided after any mid-waiting leave
 * and threw the next joiner with a unique-constraint 500. The fix is now
 * "smallest free seat" + returning seat_index in the response.
 *
 * This sim:
 *   1) creates a public 4-seat table.
 *   2) seats A=0, B=1, C=2 via join_table.
 *   3) seats B leaves.
 *   4) seats D — asserts D's seat_index is 1 (the freed gap), NOT 3.
 *   5) cleanup: leave_table + finish_table + delete club_game_results.
 */
export default async function lobbySeatSim({ sb, runId, asserts, register }) {
  const tag = (i) => `simdev_${runId}_${i}`;
  const name = (i) => `SIM_${runId}_${i}`;

  // 1. open hostless public table
  const { data: tbl, error: e1 } = await sb.rpc('ensure_public_lobby');
  asserts.truthy(tbl?.ok, 'ensure_public_lobby ok');
  if (e1) return;

  const { data: open } = await sb.rpc('list_public_tables');
  const table4 = (open || []).find((t) => t.max_players === 4 && t.current_players === 0);
  asserts.truthy(!!table4, 'found an empty 4-seat public table');
  if (!table4) return;
  register('game_rooms', table4.id);

  const room = table4.room_code;

  // 2. seat 3 players
  const seated = [];
  for (let i = 0; i < 3; i++) {
    const { data: r } = await sb.rpc('join_table', {
      p_room_code: room, p_player_id: null, p_display_name: name(i), p_device_id: tag(i),
    });
    asserts.truthy(r?.ok, `join_table seat ${i} ok`);
    asserts.eq(r?.seat_index, i, `join_table seat ${i} returns seat_index=${i}`);
    seated.push(r);
  }

  // 3. middle player leaves
  const { error: leaveErr } = await sb.rpc('leave_table', {
    p_room_code: room, p_player_id: null, p_device_id: tag(1),
  });
  asserts.eq(leaveErr, null, 'leave_table seat 1 ok');

  // 4. new player should fill seat 1 (smallest free), NOT seat 3
  const { data: r3 } = await sb.rpc('join_table', {
    p_room_code: room, p_player_id: null, p_display_name: name(3), p_device_id: tag(3),
  });
  asserts.truthy(r3?.ok, 'join_table after leave ok');
  asserts.eq(r3?.seat_index, 1, 'new joiner fills the freed gap (seat 1)');

  // 5. cleanup — vacate everyone, then finish the table so the pool replenishes
  for (const i of [0, 2, 3]) {
    await sb.rpc('leave_table', { p_room_code: room, p_player_id: null, p_device_id: tag(i) });
  }
  await sb.rpc('finish_table', { p_room_code: room });
}

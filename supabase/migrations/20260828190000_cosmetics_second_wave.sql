-- ============================================================================================
-- THE APPROVED SINK: THREE MORE COSMETICS. NOTHING THAT TOUCHES PLAY.
--
-- PRICED AGAINST THE MEASURED FLOAT, NOT INTUITION (real devices, harness excluded, 2026-08-28):
--     average balance 2,270 · median balance 2,530
--     cosmetics catalogue before: 1,150  = 51% of an average balance
--     cosmetics catalogue after : 2,250  = 99% of an average balance, 89% of the median
--
-- That is the pricing argument. At 1,150 a typical player could own EVERY cosmetic in the game
-- out of chips they already had, twice over — owning everything cost nothing they would miss. At
-- 2,250 the full set costs essentially one entire balance, so completing the catalogue becomes
-- something a player earns rather than something they already have.
--
-- Each new item is priced ABOVE its predecessor in the same family (150->250, 200->350,
-- 300->500): the first of each family stays the cheap entry point.
--
-- NOTHING THAT IS FREE TODAY BECOMES PAID. Every addition is a NEW row unlocking a NEW item.
-- CLASSIC emotes, the twelve base avatars, the CLASSIC card back and the CLASSIC/FIVE-O themes
-- are untouched, and so are the three first-wave purchases.
--
-- NO FOURTH TABLE THEME, DELIBERATELY. constants/visualThemes.ts holds exactly three themes and
-- all three are already reachable. A fourth would mean authoring new felt, panel and cue tokens,
-- and those are settled and out of bounds. Three families get a second item; the table-theme
-- family does not, and inventing paint to fill the gap would have been the wrong trade.
-- ============================================================================================
INSERT INTO chip_config (event_type, chips, xp, description, description_he, category, is_active, is_permanent)
VALUES
  ('buy_emotes_deadpan',      -250, 0, 'Emote pack: Deadpan',  'חבילת אימוג''ים: דדפן',  'purchase', true, true),
  ('buy_avatar_mythic',       -350, 0, 'Avatar set: Mythic',   'סט אווטארים: מיתי',      'purchase', true, true),
  ('buy_card_back_graphite',  -500, 0, 'Card back: Graphite',  'גב קלף: גרפיט',          'purchase', true, true)
ON CONFLICT (event_type) DO UPDATE
  SET chips = EXCLUDED.chips, description = EXCLUDED.description,
      description_he = EXCLUDED.description_he, category = EXCLUDED.category,
      is_active = EXCLUDED.is_active, is_permanent = EXCLUDED.is_permanent;

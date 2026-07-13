-- Demo family seed
-- Password for demo user: demo1234
-- Hash: pbkdf2$100000$... generated at install time via seed script if needed.
-- Precomputed for password "demo1234" with fixed salt for reproducibility.

DELETE FROM cook_logs WHERE family_id = 'fam_demo_001';
DELETE FROM recipes WHERE family_id = 'fam_demo_001';
DELETE FROM sessions WHERE user_id = 'user_demo_owner';
DELETE FROM users WHERE id = 'user_demo_owner';
DELETE FROM families WHERE id = 'fam_demo_001';

INSERT INTO families (id, name, household_size, is_suspended, is_demo, created_at, updated_at)
VALUES (
  'fam_demo_001',
  'デモ家',
  4,
  0,
  1,
  '2026-07-28T00:00:00.000Z',
  '2026-07-28T00:00:00.000Z'
);

-- password: demo1234  (pbkdf2$100000$salt$hash) — placeholder replaced by seed.mjs
INSERT INTO users (id, family_id, login_id, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES (
  'user_demo_owner',
  'fam_demo_001',
  'demo',
  'pbkdf2$100000$AQIDBAUGBwgJCgsMDQ4PEA==$e/NCueltBBSvHBHLWewhYQcCd8+17U6p9jiqFYYFrJg=',
  'デモ調理者',
  'owner',
  1,
  '2026-07-28T00:00:00.000Z',
  '2026-07-28T00:00:00.000Z'
);

INSERT INTO recipes (
  id, family_id, name, source_url, ingredients_json, instructions_json,
  source_servings, servings_label, notes, image_key, tags_json,
  is_hall_of_fame, is_archived, created_at, updated_at
) VALUES (
  'recipe_demo_nikujaga',
  'fam_demo_001',
  '肉じゃが',
  'https://example.com/nikujaga',
  '["じゃがいも 1.5個","豚肉 100g","玉ねぎ 0.5個","しらたき 0.5袋","砂糖 大さじ0.5","醤油 大さじ1"]',
  '["材料を切る","豚肉を炒める","野菜を加えて煮る","味付けして煮詰める"]',
  2,
  '2人分基準',
  'うちは砂糖控えめ',
  NULL,
  '["定番","和食"]',
  0,
  0,
  '2026-07-28T00:00:00.000Z',
  '2026-07-28T00:00:00.000Z'
);

INSERT INTO cook_logs (
  id, family_id, recipe_id, cooked_at, cook_note, created_by_user_id, created_at, updated_at
) VALUES (
  'cooklog_demo_001',
  'fam_demo_001',
  'recipe_demo_nikujaga',
  '2026-07-27',
  '今日は玉ねぎ多めにした',
  'user_demo_owner',
  '2026-07-27T12:00:00.000Z',
  '2026-07-27T12:00:00.000Z'
);

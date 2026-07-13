-- Phase 1+2 seed
-- Passwords: demo / demoreviewer / admin すべて demo1234（placeholder は gen-seed.mjs が置換）

DELETE FROM recipe_categories;
DELETE FROM cook_log_ratings;
DELETE FROM cook_logs WHERE family_id = 'fam_demo_001';
DELETE FROM recipes WHERE family_id = 'fam_demo_001';
DELETE FROM sessions WHERE user_id IN ('user_demo_owner', 'user_demo_reviewer');
DELETE FROM users WHERE family_id = 'fam_demo_001';
DELETE FROM families WHERE id = 'fam_demo_001';
DELETE FROM admin_sessions;
DELETE FROM admin_audit_logs;
DELETE FROM admin_users WHERE id = 'admin_001';
DELETE FROM categories;

INSERT INTO categories (id, code, name, sort_order, is_active, created_at, updated_at) VALUES
('cat_rice', 'rice', 'ご飯もの', 10, 1, '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z'),
('cat_noodle', 'noodle', '麺', 20, 1, '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z'),
('cat_soup', 'soup', '汁物・スープ', 30, 1, '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z'),
('cat_meat', 'meat', '肉料理', 40, 1, '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z'),
('cat_fish', 'fish', '魚料理', 50, 1, '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z'),
('cat_veg', 'vegetable', '野菜・サラダ', 60, 1, '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z'),
('cat_egg', 'egg', '卵料理', 70, 1, '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z'),
('cat_fried', 'fried', '揚げ物', 80, 1, '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z'),
('cat_stir', 'stirfry', '炒め物', 90, 1, '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z'),
('cat_simmer', 'simmered', '煮物', 100, 1, '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z'),
('cat_dessert', 'dessert', 'お菓子・デザート', 110, 1, '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z'),
('cat_other', 'other', 'その他', 200, 1, '2026-07-28T00:00:00.000Z', '2026-07-28T00:00:00.000Z');

INSERT INTO admin_users (id, login_id, password_hash, created_at)
VALUES (
  'admin_001',
  'admin',
  'pbkdf2$100000$AQIDBAUGBwgJCgsMDQ4PEA==$e/NCueltBBSvHBHLWewhYQcCd8+17U6p9jiqFYYFrJg=',
  '2026-07-28T00:00:00.000Z'
);

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

INSERT INTO users (id, family_id, login_id, password_hash, display_name, role, is_active, created_at, updated_at)
VALUES
(
  'user_demo_owner',
  'fam_demo_001',
  'demo',
  'pbkdf2$100000$AQIDBAUGBwgJCgsMDQ4PEA==$e/NCueltBBSvHBHLWewhYQcCd8+17U6p9jiqFYYFrJg=',
  'デモ調理者',
  'owner',
  1,
  '2026-07-28T00:00:00.000Z',
  '2026-07-28T00:00:00.000Z'
),
(
  'user_demo_reviewer',
  'fam_demo_001',
  'demoreviewer',
  'pbkdf2$100000$AQIDBAUGBwgJCgsMDQ4PEA==$e/NCueltBBSvHBHLWewhYQcCd8+17U6p9jiqFYYFrJg=',
  'デモ家族',
  'reviewer',
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

INSERT INTO recipe_categories (recipe_id, category_id) VALUES
('recipe_demo_nikujaga', 'cat_simmer'),
('recipe_demo_nikujaga', 'cat_meat');

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

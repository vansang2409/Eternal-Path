CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username varchar(32) NOT NULL UNIQUE,
  email varchar(255) NOT NULL UNIQUE,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email varchar(255);
UPDATE accounts SET email = username || '@local.prototype' WHERE email IS NULL;
ALTER TABLE accounts ALTER COLUMN email SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_unique_idx ON accounts(email);

CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id uuid NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  level integer NOT NULL DEFAULT 1,
  exp integer NOT NULL DEFAULT 0,
  hp integer NOT NULL DEFAULT 110,
  max_hp integer NOT NULL DEFAULT 110,
  attack integer NOT NULL DEFAULT 12,
  defense integer NOT NULL DEFAULT 5,
  gold integer NOT NULL DEFAULT 0,
  unspent_points integer NOT NULL DEFAULT 0,
  achievements jsonb NOT NULL DEFAULT '[]'::jsonb,
  map_id varchar(64) NOT NULL DEFAULT 'greenwood',
  last_seen_at timestamptz,
  position_x integer NOT NULL DEFAULT 224,
  position_y integer NOT NULL DEFAULT 224,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY,
  character_id uuid NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  rarity varchar(16) NOT NULL CHECK (rarity IN ('common', 'rare', 'epic')),
  kind varchar(16) NOT NULL DEFAULT 'equipment' CHECK (kind IN ('equipment', 'consumable')),
  slot varchar(16) CHECK (slot IN ('weapon', 'helmet', 'armor', 'boots', 'ring')),
  stats jsonb NOT NULL DEFAULT '{}',
  heal integer,
  value integer NOT NULL DEFAULT 0,
  equipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS value integer NOT NULL DEFAULT 0;
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS kind varchar(16) NOT NULL DEFAULT 'equipment';
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS heal integer;
ALTER TABLE inventory_items ALTER COLUMN slot DROP NOT NULL;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS unspent_points integer NOT NULL DEFAULT 0;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS achievements jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS inventory_items_character_idx ON inventory_items(character_id);
CREATE UNIQUE INDEX IF NOT EXISTS equipped_slot_unique_idx
  ON inventory_items(character_id, slot)
  WHERE equipped = true;

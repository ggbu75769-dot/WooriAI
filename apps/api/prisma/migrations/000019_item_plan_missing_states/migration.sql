-- Add the two Release 4 states omitted by migration 000015. Legacy values stay
-- readable for one compatibility release; current clients no longer create them.
ALTER TYPE user_item_plan_state ADD VALUE IF NOT EXISTS 'gift_expected';
ALTER TYPE user_item_plan_state ADD VALUE IF NOT EXISTS 'replacement_needed';

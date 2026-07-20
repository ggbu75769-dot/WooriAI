-- Run after 000019 commits the new enum values.
UPDATE user_item_plans SET state = 'planned' WHERE state = 'need';
UPDATE user_item_plans SET state = 'replacement_needed' WHERE state = 'replaced';

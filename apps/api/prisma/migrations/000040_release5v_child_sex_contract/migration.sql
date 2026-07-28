CREATE TYPE child_sex AS ENUM ('male', 'female', 'unknown');

ALTER TABLE children
  ADD COLUMN gender_legacy_text VARCHAR(20);

UPDATE children
SET gender_legacy_text = gender,
    gender = 'unknown'
WHERE gender IS NOT NULL
  AND gender NOT IN ('male', 'female', 'unknown');

ALTER TABLE children
  ALTER COLUMN gender TYPE child_sex
  USING gender::child_sex;

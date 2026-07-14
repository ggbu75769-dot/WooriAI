CREATE TABLE user_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type payment_method NOT NULL,
  label varchar(80) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_payment_methods_user_label UNIQUE (user_id, label)
);

CREATE INDEX idx_user_payment_methods_user_active_order
  ON user_payment_methods(user_id, active, display_order);

CREATE UNIQUE INDEX uq_user_payment_methods_one_default
  ON user_payment_methods(user_id)
  WHERE is_default = true AND active = true;

ALTER TABLE expenses
  ADD COLUMN payment_method_id uuid REFERENCES user_payment_methods(id) ON DELETE SET NULL;

CREATE INDEX idx_expenses_payment_method_id ON expenses(payment_method_id);

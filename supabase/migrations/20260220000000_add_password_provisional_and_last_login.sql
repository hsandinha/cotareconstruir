-- Add fields to support provisional passwords and last-login tracking

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS users_last_login_at_idx ON public.users (last_login_at DESC);
CREATE INDEX IF NOT EXISTS users_must_change_password_idx ON public.users (must_change_password);

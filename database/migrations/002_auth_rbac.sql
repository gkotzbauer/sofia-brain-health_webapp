-- Adds real authentication (email + password) and role-based access control.
-- Replaces the previous name-only "authentication" scheme.

CREATE TYPE user_role AS ENUM ('user', 'clinician', 'admin');

ALTER TABLE users
  ADD COLUMN email VARCHAR(255) UNIQUE,
  ADD COLUMN password_hash VARCHAR(255),
  ADD COLUMN role user_role NOT NULL DEFAULT 'user';

CREATE INDEX idx_users_email ON users(email);

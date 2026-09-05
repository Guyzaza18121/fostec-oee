CREATE DATABASE fostec_oee;

\c fostec_oee

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS input_stock;
CREATE SCHEMA IF NOT EXISTS loadcell_in;
CREATE SCHEMA IF NOT EXISTS sorting_cleaning;
CREATE SCHEMA IF NOT EXISTS loadcell_out;
CREATE SCHEMA IF NOT EXISTS packaging;
CREATE SCHEMA IF NOT EXISTS qc_stock;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(80) UNIQUE NOT NULL,
  password_hash text NOT NULL,
  display_name varchar(120),
  role varchar(30) NOT NULL DEFAULT 'operator',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loadcell_in.measurements (
  id bigserial PRIMARY KEY,
  process_id integer NOT NULL DEFAULT 2,
  machine_code varchar(80) NOT NULL DEFAULT 'loadcell_in',
  value_kg numeric(12,3) NOT NULL,
  input_maximum_kg numeric(12,3),
  input_total_kg numeric(14,3),
  status varchar(30) NOT NULL DEFAULT 'OFF',
  source varchar(40) NOT NULL DEFAULT 'node-red',
  recorded_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loadcell_in_measurements_recorded_at
ON loadcell_in.measurements (recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_loadcell_in_measurements_machine_time
ON loadcell_in.measurements (machine_code, recorded_at DESC);


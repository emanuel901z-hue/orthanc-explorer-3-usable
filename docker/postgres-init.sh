#!/bin/bash
# Creates the second database (dicom_emulator) alongside the default (orthanc).
# Runs automatically on first postgres startup via docker-entrypoint-initdb.d/.
# Idempotent: safe to run even if the database already exists.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  SELECT 'CREATE DATABASE dicom_emulator'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'dicom_emulator')\gexec
  GRANT ALL PRIVILEGES ON DATABASE dicom_emulator TO $POSTGRES_USER;
EOSQL

#!/bin/bash
# Creates the second database (dicom_emulator) alongside the default (orthanc).
# Runs automatically on first postgres startup via docker-entrypoint-initdb.d/.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE DATABASE dicom_emulator;
  GRANT ALL PRIVILEGES ON DATABASE dicom_emulator TO $POSTGRES_USER;
EOSQL

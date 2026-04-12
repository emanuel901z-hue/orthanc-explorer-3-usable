# Test DICOM Data

Local-only test fixtures used to seed the dev Orthanc stack. **No real PHI
may ever be placed in this directory** — only publicly redistributable
anonymized sample datasets.

`.dcm` files are gitignored (`test-data/*.dcm` in `.gitignore`); only this
README is tracked.

## Seed file

`sample.dcm` — a ~38 KB anonymized CT slice from the [pydicom test data](https://github.com/pydicom/pydicom/tree/main/src/pydicom/data/test_files)
(`CT_small.dcm`). MIT-licensed, intentionally crafted for test use.

## Download

From the project root:

```bash
mkdir -p test-data
curl -L -o test-data/sample.dcm \
  https://github.com/pydicom/pydicom/raw/main/src/pydicom/data/test_files/CT_small.dcm
```

Verify it is a real DICOM file (magic `DICM` at offset 128):

```bash
dd if=test-data/sample.dcm bs=1 skip=128 count=4 2>/dev/null && echo
# -> DICM
```

## Load into Orthanc

With the dev stack running, use the `seed` profile:

```bash
docker compose -f docker-compose.dev.yml --profile seed up seeder
curl -s http://localhost:8042/studies
# -> ["<study-uuid>"]
```

## Reseed

```bash
docker compose -f docker-compose.dev.yml down -v    # wipes orthanc-data volume
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml --profile seed up seeder
```

## Adding more fixtures

Drop additional anonymized `.dcm` files here. They will be ignored by git.
If you need to extend the seeder to load multiple files, change the
`command:` in the `seeder` service in `docker-compose.dev.yml` to loop
over `/seed/*.dcm`.

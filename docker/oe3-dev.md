# OE3 Local Dev Stack

Three-service Compose stack used by the SPA in `authMode: "none"` during
development. No real PHI allowed — test fixtures only (see `test-data/`).

## Services

| Service          | Image                                         | Purpose                                                              | Exposed ports |
| ---------------- | --------------------------------------------- | -------------------------------------------------------------------- | ------------- |
| `orthanc`        | `orthancteam/orthanc:latest-full`             | Core Orthanc + DICOMweb plugin, anonymous access for dev             | 8042, 4242    |
| `oauth-plugin`   | `rhavekost/orthanc-dicomweb-oauth:latest`     | DICOMweb-OAuth proxy (dev mode, no real auth yet)                    | —             |
| `azure-emulator` | `rhavekost/azure-dicom-service-emulator:latest` | Stand-in for Azure Health Data Services DICOM API                  | 8080          |

CORS is open (`*`) on Orthanc via `ORTHANC__HTTP_HEADERS` so the Vite dev
server (`http://localhost:5173`) can hit `http://localhost:8042` directly.

## Bring the stack up

```bash
docker compose -f docker-compose.dev.yml up -d
# Wait a few seconds for Orthanc to initialize, then smoke test:
curl -s http://localhost:8042/system | head -30
```

Expected: JSON containing `"Name":"OE3 Dev"` and a `"Version"` field.

## Verify DICOMweb + CORS

```bash
curl -s -i http://localhost:8042/dicom-web/studies | head -20
curl -s -i -X OPTIONS http://localhost:8042/studies \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: GET" | head -20
```

Expected: first returns `[]` (empty study list). Second returns 200/204
with `Access-Control-Allow-Origin: *`.

## Reset

```bash
docker compose -f docker-compose.dev.yml down -v   # -v wipes the orthanc-data volume
```

## Logs

```bash
docker compose -f docker-compose.dev.yml logs -f orthanc
```

## Seeder

Test data is loaded via an optional profile (see Task 0.2 / `test-data/README.md`):

```bash
docker compose -f docker-compose.dev.yml --profile seed up seeder
```

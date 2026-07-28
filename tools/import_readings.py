#!/usr/bin/env python3
"""
Voltara CSV reading importer.

Usage:
    python3 tools/import_readings.py <path-to-csv> <base-url>

Example:
    python3 tools/import_readings.py /data/readings.csv http://localhost:8080

The CSV must have a header row with columns:
    meter_id,kwh,demand_kw,taken_at

The script posts the file as multipart/form-data to /api/readings/import and
prints a one-line summary including the number of rows imported and errors.
"""

import csv
import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path


def post_csv(csv_path: Path, base_url: str) -> dict:
    """Read CSV at csv_path and POST it as multipart/form-data."""
    boundary = "----VoltaraImportBoundary"

    file_bytes = csv_path.read_bytes()

    payload = b""
    payload += b"--" + boundary.encode() + b"\r\n"
    payload += (
        b'Content-Disposition: form-data; name="file"; filename="'
        + csv_path.name.encode()
        + b'"\r\n'
    )
    payload += b"Content-Type: text/csv\r\n\r\n"
    payload += file_bytes
    payload += b"\r\n"
    payload += b"--" + boundary.encode() + b"--\r\n"

    url = base_url.rstrip("/") + "/api/readings/import"
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "Accept": "application/json",
        },
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=300) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: python3 tools/import_readings.py <csv-file> <base-url>", file=sys.stderr)
        return 1

    csv_path = Path(sys.argv[1])
    base_url = sys.argv[2]

    if not csv_path.is_file():
        print(f"error: file not found: {csv_path}", file=sys.stderr)
        return 1

    try:
        result = post_csv(csv_path, base_url)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        print(f"error: import failed ({exc.code}): {body}", file=sys.stderr)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"error: import failed: {exc}", file=sys.stderr)
        return 1

    imported = result.get("imported", 0)
    errors = result.get("errors", [])
    print(f"imported: {imported}, errors: {len(errors)}")
    for err in errors:
        row = err.get("row", "?")
        message = err.get("message", "unknown error")
        print(f"  row {row}: {message}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

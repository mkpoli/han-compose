"""Extract only stroke-chain claims and image citations from the RCC public JSON export.

Save https://rare.glyphatlas.org/api/export?format=json as a local JSON file.
For revision counts, supply the JSON audit slices obtained from the public
history cursor. Original image bytes are neither downloaded nor included.
"""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
import re
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

RCC = "https://rare.glyphatlas.org"
CHAIN = re.compile(r"#\([^()\s]+\)")


def source_url(url):
    if not url:
        return None
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, "", ""))


def evidence(sighting, entry_url):
    return {
        "url": f"{entry_url}#sighting-{sighting['id']}",
        "title": sighting.get("title"),
        "author": sighting.get("author"),
        "date": sighting.get("original_date") or sighting.get("report_date"),
        "publisher": sighting.get("publisher"),
        "page": sighting.get("page"),
        "source": source_url(sighting.get("url")),
        "images": [{
            "url": f"{RCC}/media/v2/{image['image_key']}",
            "mark": json.loads(image["box"] or "[]"),
        } for image in sighting.get("media", [])],
    }


def catalogue(original, history):
    export = json.loads(original)
    rows = []
    matches = [row for audit in history for row in audit["matching"]]
    for entry in export["entries"]:
        claims = [claim for claim in entry["claims"] if claim["kind"] in ("ids", "composition")
                  and CHAIN.search(claim["value"])]
        if not claims:
            continue
        url = f"{RCC}/en/entry/{entry['id']}"
        rows.append({
            "code": entry["code"],
            "url": url,
            "created": entry["created_at"],
            "credited_to": entry["created_by_name"],
            "history": f"{url}/history",
            "historical_revisions": sorted(row["revision"] for row in matches if row["entry"] == entry["id"]),
            "primary_ids": entry["ids"],
            "claims": [{"ids": claim["value"], "chains": CHAIN.findall(claim["value"]),
                        "layout": (claim["data"] or {}).get("layout")} for claim in claims],
            "sightings": [evidence(sighting, url) for sighting in entry["evidence"]],
        })
    revision = export["dataset"]["revision"]
    audit = {
        "url": f"{RCC}/en/history",
        "through": revision,
        "pages": sum(len(part["pages"]) for part in history),
        "public_rows": sum(page["public_rows"] for part in history for page in part["pages"]),
        "matching_rows": len(matches),
    } if history else None
    return {
        "source": {
            **export["dataset"],
            "url": f"{RCC}/api/export?format=json",
            "sha256": sha256(original).hexdigest(),
        },
        "history": audit,
        "records": rows,
    }


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("export", type=Path)
    cli.add_argument("--history", type=Path, nargs="*", default=[])
    cli.add_argument("--output", type=Path, default=Path("data/rcc-chain-evidence.json"))
    args = cli.parse_args()
    data = catalogue(args.export.read_bytes(), [json.loads(path.read_bytes()) for path in args.history])
    args.output.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf8")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Bump the ?v=NNNNNN cache-busting number on every page, after a change to
style.css, clay.js or docs/docs.js:

    python tools/bump_version.py

It adds 1 to the number and writes it into every .html file in the site,
docs pages included, so browsers fetch the new CSS and JS.
"""
import re
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
pages = [p for p in SITE.rglob("*.html") if ".git" not in p.parts]
found = {int(n) for p in pages for n in re.findall(r"\?v=(\d+)", p.read_text(encoding="utf-8"))}
if not found:
    raise SystemExit("No ?v= numbers found.")
new = max(found) + 1
for p in pages:
    s = p.read_text(encoding="utf-8")
    t = re.sub(r"\?v=\d+", f"?v={new}", s)
    if t != s:
        p.write_text(t, encoding="utf-8")
print(f"?v={new} on {len(pages)} pages")

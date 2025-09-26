# Bundle Miner (Reddit + Stack Overflow)

A small Python tool that fetches public tech discussions (Reddit and Stack Overflow), extracts atomic tech items using OpenAI (with a regex fallback), and mines common bundles via co‑occurrence.

Outputs both JSON and CSV with bundle name, items, support metrics, and a short AI summary.

## Requirements

- Python 3.9+
- pip
- An OpenAI API key in environment variable `OPENAI_API_KEY` (optional; fallback extractor will be used if not set)

Install deps:

```pwsh
pip install -r scripts/bundle_miner/requirements.txt
```

## Quick start (end‑to‑end)

This fetches from a couple of subreddits and tags, extracts items, mines bundles, and writes outputs to `scripts/bundle_miner/out`.

```pwsh
python scripts/bundle_miner/main.py full \
  --reddit r/devops r/programming \
  --so-tags python devops \
  --limit 30 \
  --model gpt-4o-mini
```

Outputs:
- `out/raw_posts.json` — source posts
- `out/extracted_items.json` — per‑post extracted items
- `out/bundles.json` — bundles with metrics and AI summaries
- `out/bundles.csv` — same as CSV

## Commands

- Crawl only:
```pwsh
python scripts/bundle_miner/main.py crawl --reddit r/devops r/programming --so-tags python reactjs --limit 20
```
- Mine from existing `raw_posts.json`:
```pwsh
python scripts/bundle_miner/main.py mine --input scripts/bundle_miner/out/raw_posts.json --min-support 3 --min-pair 3
```
- Summarize existing bundles (add names and descriptions):
```pwsh
python scripts/bundle_miner/main.py summarize --input scripts/bundle_miner/out/bundles.json --model gpt-4o-mini
```

## Notes

- The tool is respectful: uses public JSON endpoints and StackExchange API without keys at a light rate. For larger crawls, add your StackExchange key and backoff.
- If `OPENAI_API_KEY` is not set, the extractor falls back to a simple ruleset to identify common technologies and frameworks.
- You can change thresholds using CLI flags `--min-support`, `--min-pair`, and `--top-k`.

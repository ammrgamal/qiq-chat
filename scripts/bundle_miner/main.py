#!/usr/bin/env python3
import os, sys, json, time, argparse, itertools, math
from collections import Counter, defaultdict
from typing import List, Dict, Any, Tuple

import requests
from tqdm import tqdm

# --- Helpers ---
BASE_DIR = os.path.dirname(__file__)
OUT_DIR = os.path.join(BASE_DIR, 'out')
os.makedirs(OUT_DIR, exist_ok=True)

OPENAI_KEY = os.environ.get('OPENAI_API_KEY')
OPENAI_MODEL_DEFAULT = 'gpt-4o-mini'

HEADERS = { 'User-Agent': 'qiq-bundle-miner/1.0 (https://quickitquote.com)' }

def save_json(fp: str, obj: Any):
    with open(fp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)

def load_json(fp: str):
    with open(fp, 'r', encoding='utf-8') as f:
        return json.load(f)

# --- Source fetchers ---

def fetch_reddit_subreddit(sub: str, limit: int=30) -> List[Dict[str, Any]]:
    # Use Reddit JSON listing (no auth for light usage)
    url = f"https://www.reddit.com/{sub}/.json?limit={limit}"
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    data = r.json()
    posts = []
    for ch in data.get('data', {}).get('children', []):
        d = ch.get('data', {})
        posts.append({
            'source': 'reddit',
            'subreddit': d.get('subreddit'),
            'title': d.get('title') or '',
            'body': d.get('selftext') or '',
            'url': 'https://www.reddit.com' + (d.get('permalink') or ''),
        })
    return posts


def fetch_stackoverflow(tag: str, pagesize: int=20) -> List[Dict[str, Any]]:
    # StackExchange API (no key; be gentle). Fetches with body excerpts.
    url = 'https://api.stackexchange.com/2.3/search/advanced'
    params = {
        'order': 'desc', 'sort': 'relevance', 'tagged': tag, 'site': 'stackoverflow',
        'filter': '!)rTkra3bK2SYPDk7k2Fq*EIVdQn3c2kzFj',  # includes body/excerpt
        'pagesize': pagesize
    }
    r = requests.get(url, params=params, headers=HEADERS, timeout=25)
    r.raise_for_status()
    j = r.json()
    out = []
    for it in j.get('items', []):
        out.append({
            'source': 'stackoverflow',
            'title': it.get('title') or '',
            'body': (it.get('body_markdown') or it.get('body') or it.get('excerpt') or ''),
            'url': it.get('link') or ''
        })
    return out

# --- AI extraction ---

TECH_HINTS = [
    'python','java','node.js','node','javascript','typescript','react','vue','angular','svelte','next.js','nuxt','django','flask','fastapi',
    'spring','spring boot','kotlin','swift','go','golang','rust','dotnet','c#','c++','docker','kubernetes','helm','terraform','ansible',
    'aws','azure','gcp','linux','postgres','mysql','mongodb','redis','rabbitmq','kafka','elasticsearch','clickhouse','spark','hadoop',
    'airflow','dbt','supabase','firebase','tailwind','bootstrap','storybook','vitest','jest','pytest','cypress','playwright'
]

STOP_WORDS = set(['and','or','with','for','to','from','in','on','of','the','a','an','using','via','as'])


def fallback_extract_items(text: str) -> List[str]:
    t = (text or '').lower()
    items = set()
    for hint in TECH_HINTS:
        if hint in t:
            items.add(hint)
    # naive token scan for simple single-word techs
    tokens = [w.strip('.,:;()[]{}!"\'\'').lower() for w in t.split()]
    for w in tokens:
        if w in TECH_HINTS and w not in STOP_WORDS:
            items.add(w)
    return sorted(items)


def openai_extract_items(posts: List[Dict[str, Any]], model: str) -> List[List[str]]:
    if not OPENAI_KEY:
        return [fallback_extract_items((p.get('title','') + '\n' + p.get('body',''))) for p in posts]
    url = 'https://api.openai.com/v1/chat/completions'
    headers = { 'authorization': f'Bearer {OPENAI_KEY}', 'content-type': 'application/json' }
    out = []
    for p in tqdm(posts, desc='AI extract'):
        text = (p.get('title','') + '\n' + p.get('body',''))[:6000]
        payload = {
            'model': model or OPENAI_MODEL_DEFAULT,
            'temperature': 0.2,
            'messages': [
                { 'role':'system', 'content': 'Extract a list of atomic technologies/tools/libraries/frameworks mentioned. Return ONLY JSON: {"items": ["..."]}. Keep 3-12 items; lowercase; concise.' },
                { 'role':'user', 'content': text }
            ],
            'response_format': { 'type':'json_object' }
        }
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=40)
            if r.status_code == 429:
                time.sleep(3)
                r = requests.post(url, headers=headers, json=payload, timeout=40)
            r.raise_for_status()
            j = r.json()
            content = j.get('choices',[{}])[0].get('message',{}).get('content','{}')
            data = json.loads(content)
            items = [str(x).strip().lower() for x in data.get('items', []) if x]
            if not items:
                items = fallback_extract_items(text)
            out.append(sorted(set(items)))
        except Exception:
            out.append(fallback_extract_items(text))
    return out

# --- Bundling ---

def build_bundles(extracted: List[List[str]], min_support: int=3, min_pair: int=3, top_k: int=50):
    # Support per item
    item_counts = Counter()
    for items in extracted:
        item_counts.update(set(items))
    # Pair counts
    pair_counts = Counter()
    for items in extracted:
        uniq = sorted(set(items))
        for a, b in itertools.combinations(uniq, 2):
            pair_counts[(a,b)] += 1
    # Candidate bundles by greedy clustering on pair counts
    # Seed by top pairs >= min_pair
    seeds = [ab for ab,c in pair_counts.most_common() if c >= min_pair]
    bundles = []
    seen_sets = []
    for a,b in seeds:
        bundle = set([a,b])
        # try to add items that co-occur with all current members
        for x,_ in item_counts.most_common():
            if x in bundle: continue
            ok = True
            for y in list(bundle):
                key = tuple(sorted([x,y]))
                if pair_counts.get(key, 0) < min_pair:
                    ok = False; break
            if ok: bundle.add(x)
        # filter by min_support per member
        if all(item_counts[i] >= min_support for i in bundle):
            # dedupe similar sets by Jaccard
            keep = True
            for s in seen_sets:
                inter = len(bundle & s)
                union = len(bundle | s)
                if union and inter/union >= 0.8:
                    keep = False; break
            if keep:
                seen_sets.append(bundle)
                bundles.append(sorted(bundle))
        if len(bundles) >= top_k:
            break
    metrics = {
        'item_support': item_counts,
        'pair_support': pair_counts
    }
    return bundles, metrics

# --- Summarization ---

def summarize_bundles(bundles: List[List[str]], model: str) -> List[Dict[str, Any]]:
    def local_name(items: List[str]) -> str:
        if not items: return 'Bundle'
        core = [w for w in items if w not in STOP_WORDS][:3]
        return ' + '.join(core).title()
    results = []
    if not OPENAI_KEY:
        for items in bundles:
            results.append({
                'name': local_name(items),
                'items': items,
                'summary': 'Commonly co-mentioned tools in public developer threads.',
                'use_cases': ['learning path', 'starter stack', 'tool comparison']
            })
        return results
    url = 'https://api.openai.com/v1/chat/completions'
    headers = { 'authorization': f'Bearer {OPENAI_KEY}', 'content-type': 'application/json' }
    for items in tqdm(bundles, desc='AI summarize'):
        prompt = {
            'items': items,
            'instructions': 'Propose a short bundle name (<=6 words), a 2-3 sentence summary, and 2-4 practical use cases. JSON keys: name, summary, use_cases.'
        }
        payload = {
            'model': model or OPENAI_MODEL_DEFAULT,
            'temperature': 0.4,
            'messages': [
                { 'role':'system', 'content': 'You name and summarize technology bundles for a product research team.' },
                { 'role':'user', 'content': json.dumps(prompt) }
            ],
            'response_format': { 'type':'json_object' }
        }
        try:
            r = requests.post(url, headers=headers, json=payload, timeout=40)
            if r.status_code == 429:
                time.sleep(3)
                r = requests.post(url, headers=headers, json=payload, timeout=40)
            r.raise_for_status()
            data = r.json()['choices'][0]['message']['content']
            j = json.loads(data)
            results.append({
                'name': j.get('name') or local_name(items),
                'items': items,
                'summary': j.get('summary') or 'Commonly co-mentioned tools in public developer threads.',
                'use_cases': j.get('use_cases') or ['learning path','starter stack']
            })
        except Exception:
            results.append({
                'name': local_name(items),
                'items': items,
                'summary': 'Commonly co-mentioned tools in public developer threads.',
                'use_cases': ['learning path', 'starter stack']
            })
    return results

# --- IO ---

def write_csv(bundles_info: List[Dict[str, Any]], fp: str):
    import csv
    with open(fp, 'w', newline='', encoding='utf-8') as f:
        w = csv.writer(f)
        w.writerow(['name','items','summary','use_cases'])
        for b in bundles_info:
            w.writerow([b.get('name',''), ', '.join(b.get('items',[])), b.get('summary',''), '; '.join(b.get('use_cases',[]))])

# --- CLI ---

def cmd_full(args):
    posts = []
    for sub in (args.reddit or []):
        posts.extend(fetch_reddit_subreddit(sub, args.limit))
    for tag in (args.so_tags or []):
        posts.extend(fetch_stackoverflow(tag, args.limit))
    save_json(os.path.join(OUT_DIR, 'raw_posts.json'), posts)

    extracted = openai_extract_items(posts, args.model)
    save_json(os.path.join(OUT_DIR, 'extracted_items.json'), [{'url':p.get('url',''), 'items':it} for p,it in zip(posts, extracted)])

    bundles, metrics = build_bundles(extracted, args.min_support, args.min_pair, args.top_k)
    bundles_info = summarize_bundles(bundles, args.model)
    save_json(os.path.join(OUT_DIR, 'bundles.json'), bundles_info)
    write_csv(bundles_info, os.path.join(OUT_DIR, 'bundles.csv'))
    print(f"Wrote {len(posts)} posts, {sum(len(x) for x in extracted)} items, {len(bundles_info)} bundles → {OUT_DIR}")


def cmd_crawl(args):
    posts = []
    for sub in (args.reddit or []):
        posts.extend(fetch_reddit_subreddit(sub, args.limit))
    for tag in (args.so_tags or []):
        posts.extend(fetch_stackoverflow(tag, args.limit))
    save_json(os.path.join(OUT_DIR, 'raw_posts.json'), posts)
    print(f"Wrote {len(posts)} posts → {OUT_DIR}/raw_posts.json")


def cmd_mine(args):
    posts = load_json(args.input)
    extracted = openai_extract_items(posts, args.model)
    save_json(os.path.join(OUT_DIR, 'extracted_items.json'), [{'url':p.get('url',''), 'items':it} for p,it in zip(posts, extracted)])
    bundles, metrics = build_bundles(extracted, args.min_support, args.min_pair, args.top_k)
    save_json(os.path.join(OUT_DIR, 'bundles_raw.json'), bundles)
    print(f"Bundles: {len(bundles)} (raw)")


def cmd_summarize(args):
    bundles = load_json(args.input)
    bundles_info = summarize_bundles(bundles, args.model)
    save_json(os.path.join(OUT_DIR, 'bundles.json'), bundles_info)
    write_csv(bundles_info, os.path.join(OUT_DIR, 'bundles.csv'))
    print(f"Summarized {len(bundles_info)} bundles → bundles.json/csv")


def build_parser():
    p = argparse.ArgumentParser(description='Bundle Miner')
    sub = p.add_subparsers(dest='cmd')

    pf = sub.add_parser('full', help='crawl + extract + mine + summarize')
    pf.add_argument('--reddit', nargs='*', default=['r/devops'])
    pf.add_argument('--so-tags', nargs='*', default=['python'])
    pf.add_argument('--limit', type=int, default=20)
    pf.add_argument('--model', default=OPENAI_MODEL_DEFAULT)
    pf.add_argument('--min-support', type=int, default=3)
    pf.add_argument('--min-pair', type=int, default=3)
    pf.add_argument('--top-k', type=int, default=50)
    pf.set_defaults(func=cmd_full)

    pc = sub.add_parser('crawl', help='only fetch raw posts')
    pc.add_argument('--reddit', nargs='*')
    pc.add_argument('--so-tags', nargs='*')
    pc.add_argument('--limit', type=int, default=20)
    pc.set_defaults(func=cmd_crawl)

    pm = sub.add_parser('mine', help='extract+mine from raw_posts.json')
    pm.add_argument('--input', required=True)
    pm.add_argument('--model', default=OPENAI_MODEL_DEFAULT)
    pm.add_argument('--min-support', type=int, default=3)
    pm.add_argument('--min-pair', type=int, default=3)
    pm.add_argument('--top-k', type=int, default=50)
    pm.set_defaults(func=cmd_mine)

    ps = sub.add_parser('summarize', help='add names/summaries to bundles.json')
    ps.add_argument('--input', required=True)
    ps.add_argument('--model', default=OPENAI_MODEL_DEFAULT)
    ps.set_defaults(func=cmd_summarize)

    return p


def main(argv=None):
    argv = argv or sys.argv[1:]
    p = build_parser()
    args = p.parse_args(argv)
    if not args.cmd:
        p.print_help(); return 1
    return args.func(args)

if __name__ == '__main__':
    sys.exit(main())

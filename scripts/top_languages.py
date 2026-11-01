"""Gera assets/top-langs.svg com as linguagens mais usadas nos meus repositórios.

Lê a árvore de arquivos de cada repo (inclusive privados) e soma o tamanho dos
arquivos por linguagem, ignorando builds, dependências e arquivos gerados — por
isso o resultado é mais fiel que o card de linguagens padrão do GitHub.

Uso: GH_TOKEN=<token com leitura dos repos> python scripts/top_languages.py
"""

import json
import os
import re
import sys
import urllib.request
from pathlib import Path

USER = "Fernando-dev-ssd"
OUTPUT = Path(__file__).resolve().parent.parent / "assets" / "top-langs.svg"
TOP_N = 8
MIN_SHARE = 0.01  # esconde linguagens com menos de 1%
SKIP_REPOS = {USER}
MAX_FILE_BYTES = 300_000  # arquivos maiores que isso quase sempre são gerados

IGNORED_PATH = re.compile(
    r"(^|/)(build|dist|out|node_modules|vendor|venv|\.venv|__pycache__|\.expo|android/app/build)(/|$)"
    r"|\.min\.(js|css)$|(^|/)js/react/"
)

EXTENSIONS = {
    ".py": "Python",
    ".js": "JavaScript", ".mjs": "JavaScript", ".cjs": "JavaScript", ".jsx": "JavaScript",
    ".ts": "TypeScript", ".tsx": "TypeScript",
    ".html": "HTML",
    ".css": "CSS", ".scss": "CSS",
    ".kt": "Kotlin", ".kts": "Kotlin",
    ".java": "Java",
    ".dart": "Dart",
    ".sql": "SQL",
    ".sh": "Shell",
    ".ps1": "PowerShell",
}

# Cores oficiais do GitHub Linguist
COLORS = {
    "Python": "#3572A5",
    "JavaScript": "#f1e05a",
    "TypeScript": "#3178c6",
    "HTML": "#e34c26",
    "CSS": "#663399",
    "Kotlin": "#A97BFF",
    "Java": "#b07219",
    "Dart": "#00B4AB",
    "SQL": "#e38c00",
    "Shell": "#89e051",
    "PowerShell": "#012456",
}


def api(path):
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        sys.exit("Defina GH_TOKEN com um token que tenha leitura dos repositórios.")
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.load(resp)


def owned_repos():
    repos, page = [], 1
    while True:
        batch = api(f"/user/repos?affiliation=owner&per_page=100&page={page}")
        repos += batch
        if len(batch) < 100:
            return [r for r in repos if not r["fork"] and not r["archived"] and r["name"] not in SKIP_REPOS]
        page += 1


def count_languages(repos):
    totals = {}
    for repo in repos:
        if repo["size"] == 0:
            continue
        tree = api(f"/repos/{repo['full_name']}/git/trees/{repo['default_branch']}?recursive=1")
        for item in tree["tree"]:
            if item["type"] != "blob" or item["size"] > MAX_FILE_BYTES or IGNORED_PATH.search(item["path"]):
                continue
            lang = EXTENSIONS.get(Path(item["path"]).suffix.lower())
            if lang:
                totals[lang] = totals.get(lang, 0) + item["size"]
    return totals


def render_svg(totals):
    grand_total = sum(totals.values())
    top = [kv for kv in sorted(totals.items(), key=lambda kv: kv[1], reverse=True) if kv[1] / grand_total >= MIN_SHARE]
    top = top[:TOP_N]
    total = sum(size for _, size in top)
    width, bar_x, bar_w = 495, 25, 445

    bar, x = [], bar_x
    for lang, size in top:
        w = bar_w * size / total
        bar.append(f'<rect x="{x:.2f}" y="58" width="{w:.2f}" height="10" fill="{COLORS.get(lang, "#8b949e")}"/>')
        x += w

    legend = []
    for i, (lang, size) in enumerate(top):
        col, row = i % 2, i // 2
        lx, ly = 25 + col * 230, 98 + row * 26
        legend.append(
            f'<g class="item" style="animation-delay:{150 + i * 120}ms" transform="translate({lx},{ly})">'
            f'<circle cx="5" cy="-4" r="5" fill="{COLORS.get(lang, "#8b949e")}"/>'
            f'<text x="18" y="0" class="lang">{lang}</text>'
            f'<text x="200" y="0" class="pct" text-anchor="end">{100 * size / total:.1f}%</text></g>'
        )

    height = 98 + ((len(top) + 1) // 2) * 26 + 6
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-label="Linguagens mais usadas">
  <style>
    .title {{ font: 600 18px 'Segoe UI', Ubuntu, sans-serif; fill: #58a6ff; }}
    .lang {{ font: 400 13px 'Segoe UI', Ubuntu, sans-serif; fill: #c9d1d9; }}
    .pct {{ font: 600 13px 'Segoe UI', Ubuntu, sans-serif; fill: #8b949e; }}
    .item {{ opacity: 0; animation: fadeIn .4s ease-in-out forwards; }}
    .bar {{ animation: grow 1s ease-in-out forwards; transform-origin: left; transform: scaleX(0); }}
    @keyframes fadeIn {{ to {{ opacity: 1; }} }}
    @keyframes grow {{ to {{ transform: scaleX(1); }} }}
  </style>
  <rect x="0.5" y="0.5" width="{width - 1}" height="{height - 1}" rx="6" fill="#0a0a1e" stroke="#1e1e3a"/>
  <text x="25" y="38" class="title">Linguagens mais usadas</text>
  <clipPath id="round"><rect x="{bar_x}" y="58" width="{bar_w}" height="10" rx="5"/></clipPath>
  <g class="bar" clip-path="url(#round)">
    {"".join(bar)}
  </g>
  {"".join(legend)}
</svg>
"""


def main():
    totals = count_languages(owned_repos())
    if not totals:
        sys.exit("Nenhuma linguagem encontrada — o token tem acesso aos repositórios?")
    OUTPUT.write_text(render_svg(totals), encoding="utf-8")
    for lang, size in sorted(totals.items(), key=lambda kv: kv[1], reverse=True):
        print(f"{lang:12} {size:>10,} bytes")


if __name__ == "__main__":
    main()

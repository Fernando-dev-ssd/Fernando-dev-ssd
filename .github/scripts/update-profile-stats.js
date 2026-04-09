const fs = require("fs");
const path = require("path");

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN;

if (!USERNAME || !TOKEN) {
  throw new Error("GH_USERNAME ou GH_TOKEN ausente.");
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "User-Agent": USERNAME,
  Accept: "application/vnd.github+json",
};

async function fetchJson(url, extra = {}) {
  const res = await fetch(url, { headers: { ...headers, ...(extra.headers || {}) } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ${res.status} em ${url}\n${text}`);
  }
  return res.json();
}

async function fetchGraphQL(query, variables = {}) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (!res.ok || json.errors) {
    throw new Error(`GraphQL error: ${JSON.stringify(json.errors || json)}`);
  }
  return json.data;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatNumber(num) {
  return new Intl.NumberFormat("pt-BR").format(num);
}

function buildStatsSvg(data) {
  const {
    totalStars,
    totalCommits,
    totalPRs,
    totalIssues,
    totalRepos,
    rank,
  } = data;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  width="467"
  height="195"
  viewBox="0 0 467 195"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-labelledby="titleId descId"
>
  <title id="titleId">${escapeXml(USERNAME)}'s GitHub Stats</title>
  <desc id="descId">Total Stars Earned: ${totalStars}, Total Commits: ${totalCommits}, Total PRs: ${totalPRs}, Total Issues: ${totalIssues}, Public Repositories: ${totalRepos}</desc>
  <style>
    .header {
      font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif;
      fill: #2f80ed;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    .stat {
      font: 600 14px 'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif;
      fill: #434d58;
    }
    .stagger {
      opacity: 0;
      animation: fadeInAnimation 0.3s ease-in-out forwards;
    }
    .rank-text {
      font: 800 24px 'Segoe UI', Ubuntu, Sans-Serif;
      fill: #434d58;
      animation: scaleInAnimation 0.3s ease-in-out forwards;
    }
    .icon {
      fill: #4c71f2;
      display: block;
    }
    .rank-circle-rim {
      stroke: #2f80ed;
      fill: none;
      stroke-width: 6;
      opacity: 0.2;
    }
    .rank-circle {
      stroke: #2f80ed;
      stroke-dasharray: 250;
      fill: none;
      stroke-width: 6;
      stroke-linecap: round;
      opacity: 0.8;
      transform-origin: -10px 8px;
      transform: rotate(-90deg);
      animation: rankAnimation 1s forwards ease-in-out;
    }
    @keyframes rankAnimation {
      from { stroke-dashoffset: 251.32741228718345; }
      to { stroke-dashoffset: 40; }
    }
    @keyframes scaleInAnimation {
      from { transform: translate(-5px, 5px) scale(0); }
      to { transform: translate(-5px, 5px) scale(1); }
    }
    @keyframes fadeInAnimation {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  </style>

  <rect
    data-testid="card-bg"
    x="0.5"
    y="0.5"
    rx="4.5"
    height="99%"
    stroke="#e4e2e2"
    width="466"
    fill="#fffefe"
    stroke-opacity="1"
  />

  <g data-testid="card-title" transform="translate(25, 35)">
    <text x="0" y="0" class="header">${escapeXml(USERNAME)}'s GitHub Stats</text>
  </g>

  <g data-testid="main-card-body" transform="translate(0, 55)">
    <g data-testid="rank-circle" transform="translate(390.5, 47.5)">
      <circle class="rank-circle-rim" cx="-10" cy="8" r="40" />
      <circle class="rank-circle" cx="-10" cy="8" r="40" />
      <g class="rank-text">
        <text x="-5" y="3" alignment-baseline="central" dominant-baseline="central" text-anchor="middle">${rank}</text>
      </g>
    </g>

    <svg x="0" y="0">
      <g class="stagger" style="animation-delay: 450ms" transform="translate(25, 0)">
        <text class="stat" x="0" y="12.5">⭐ Total Stars Earned:</text>
        <text class="stat" x="220" y="12.5">${formatNumber(totalStars)}</text>
      </g>

      <g class="stagger" style="animation-delay: 600ms" transform="translate(25, 25)">
        <text class="stat" x="0" y="12.5">🧠 Total Commits:</text>
        <text class="stat" x="220" y="12.5">${formatNumber(totalCommits)}</text>
      </g>

      <g class="stagger" style="animation-delay: 750ms" transform="translate(25, 50)">
        <text class="stat" x="0" y="12.5">🔀 Total PRs:</text>
        <text class="stat" x="220" y="12.5">${formatNumber(totalPRs)}</text>
      </g>

      <g class="stagger" style="animation-delay: 900ms" transform="translate(25, 75)">
        <text class="stat" x="0" y="12.5">🐞 Total Issues:</text>
        <text class="stat" x="220" y="12.5">${formatNumber(totalIssues)}</text>
      </g>

      <g class="stagger" style="animation-delay: 1050ms" transform="translate(25, 100)">
        <text class="stat" x="0" y="12.5">📦 Public Repositories:</text>
        <text class="stat" x="220" y="12.5">${formatNumber(totalRepos)}</text>
      </g>
    </svg>
  </g>
</svg>`;
}

function buildLangsSvg(languages) {
  const total = Object.values(languages).reduce((acc, val) => acc + val, 0) || 1;
  const top = Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({
      name,
      value,
      percent: +(value / total * 100).toFixed(2),
    }));

  const colors = {
    Python: "#3572A5",
    JavaScript: "#f1e05a",
    HTML: "#e34c26",
    Flutter: "#02569B",
    Dart: "#00B4AB",
    Android: "#3DDC84",
    Kotlin: "#A97BFF",
    TypeScript: "#3178c6",
    CSS: "#663399",
    Shell: "#89e051",
    Java: "#b07219",
    "C#": "#178600",
    Lua: "#000080",
  };

  let x = 0;
  const barWidth = 250;
  const bars = top.map((lang, index) => {
    const width = +(barWidth * (lang.percent / 100)).toFixed(2);
    const rect = `
      <rect
        mask="url(#rect-mask)"
        data-testid="lang-progress"
        x="${x}"
        y="0"
        width="${width}"
        height="8"
        fill="${colors[lang.name] || "#2f80ed"}"
        class="lang-progress"
        style="animation-delay:${300 + index * 80}ms"
      />`;
    x += width;
    return rect;
  }).join("");

  const left = top.slice(0, 3);
  const right = top.slice(3, 6);

  function renderList(items, offsetX) {
    return items.map((lang, i) => `
      <g transform="translate(${offsetX}, ${i * 25})">
        <g class="stagger" style="animation-delay: ${450 + i * 150}ms">
          <circle cx="5" cy="6" r="5" fill="${colors[lang.name] || "#2f80ed"}" />
          <text data-testid="lang-name" x="15" y="10" class="lang-name">
            ${escapeXml(lang.name)} ${lang.percent}%
          </text>
        </g>
      </g>
    `).join("");
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg
  width="300"
  height="165"
  viewBox="0 0 300 165"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-labelledby="titleId descId"
>
  <title id="titleId"></title>
  <desc id="descId"></desc>
  <style>
    .header {
      font: 600 18px 'Segoe UI', Ubuntu, Sans-Serif;
      fill: #2f80ed;
      animation: fadeInAnimation 0.8s ease-in-out forwards;
    }
    @keyframes slideInAnimation {
      from { width: 0; }
      to { width: calc(100% - 100px); }
    }
    @keyframes growWidthAnimation {
      from { width: 0; }
      to { width: 100%; }
    }
    .lang-name {
      font: 400 11px "Segoe UI", Ubuntu, Sans-Serif;
      fill: #434d58;
    }
    .stagger {
      opacity: 0;
      animation: fadeInAnimation 0.3s ease-in-out forwards;
    }
    #rect-mask rect {
      animation: slideInAnimation 1s ease-in-out forwards;
    }
    .lang-progress {
      animation: growWidthAnimation 0.6s ease-in-out forwards;
    }
    @keyframes fadeInAnimation {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  </style>

  <rect
    data-testid="card-bg"
    x="0.5"
    y="0.5"
    rx="4.5"
    height="99%"
    stroke="#e4e2e2"
    width="299"
    fill="#fffefe"
    stroke-opacity="1"
  />

  <g data-testid="card-title" transform="translate(25, 35)">
    <text x="0" y="0" class="header">Most Used Languages</text>
  </g>

  <g data-testid="main-card-body" transform="translate(0, 55)">
    <svg data-testid="lang-items" x="25">
      <mask id="rect-mask">
        <rect x="0" y="0" width="250" height="8" fill="white" rx="5"/>
      </mask>

      ${bars}

      <g transform="translate(0, 25)">
        ${renderList(left, 0)}
        ${renderList(right, 150)}
      </g>
    </svg>
  </g>
</svg>`;
}

async function main() {
  const user = await fetchJson(`https://api.github.com/users/${USERNAME}`);
  const repos = await fetchJson(`https://api.github.com/users/${USERNAME}/repos?per_page=100&sort=updated`);

  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const totalRepos = user.public_repos || repos.length;

  const languages = {};
  for (const repo of repos) {
    if (repo.fork) continue;
    const repoLangs = await fetchJson(repo.languages_url);
    for (const [lang, bytes] of Object.entries(repoLangs)) {
      languages[lang] = (languages[lang] || 0) + bytes;
    }
  }

  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          totalCommitContributions
          totalIssueContributions
          totalPullRequestContributions
        }
      }
    }
  `;

  const gql = await fetchGraphQL(query, { login: USERNAME });

  const totalCommits = gql.user.contributionsCollection.totalCommitContributions || 0;
  const totalIssues = gql.user.contributionsCollection.totalIssueContributions || 0;
  const totalPRs = gql.user.contributionsCollection.totalPullRequestContributions || 0;

  const rank = totalCommits > 500 ? "A+" : totalCommits > 100 ? "A" : totalCommits > 30 ? "B" : "C";

  const assetsDir = path.join(process.cwd(), "assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  fs.writeFileSync(
    path.join(assetsDir, "github-stats.svg"),
    buildStatsSvg({ totalStars, totalCommits, totalPRs, totalIssues, totalRepos, rank }),
    "utf8"
  );

  fs.writeFileSync(
    path.join(assetsDir, "top-langs.svg"),
    buildLangsSvg(languages),
    "utf8"
  );

  console.log("SVGs atualizados com sucesso.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import {
  CATEGORY_META,
  Finding,
  ReviewReport,
  SEVERITY_RANK,
  Severity,
} from '@pr-review-insight/core';
import { HEADERS } from '../markdown/render';

/**
 * Self-contained `code-report.html` artifact: inline CSS/JS, zero external
 * requests, opens from file://, dark-mode aware, with a filterable table.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#cf222e',
  major: '#bc4c00',
  minor: '#9a6700',
  info: '#656d76',
};

function findingRow(f: Finding): string {
  const where = f.range ? `${f.file}:${f.range.start}` : f.file;
  return (
    `<tr data-category="${f.category}" data-severity="${f.severity}" data-new="${f.isNew ? '1' : '0'}">` +
    `<td><code>${escapeHtml(where)}</code></td>` +
    `<td>${CATEGORY_META[f.category].emoji} ${escapeHtml(CATEGORY_META[f.category].label)}</td>` +
    `<td><span class="sev" style="--c:${SEVERITY_COLOR[f.severity]}">${f.severity}</span>${
      f.isNew ? ' <span class="new">NEW</span>' : ''
    }</td>` +
    `<td><code>${escapeHtml(f.ruleId)}</code>${f.owasp ? `<br><small>${escapeHtml(f.owasp)}</small>` : ''}</td>` +
    `<td>${escapeHtml(f.message)}${f.detail ? `<br><small>${escapeHtml(f.detail)}</small>` : ''}</td>` +
    `</tr>`
  );
}

export function renderHtml(report: ReviewReport): string {
  const findings = [...(report.findings ?? [])].sort(
    (a, b) =>
      Number(b.isNew ?? false) - Number(a.isNew ?? false) ||
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
  );
  const categories = (report.categories ?? []).filter((c) => c.total > 0);

  const cards = categories
    .map((c) => {
      const meta = CATEGORY_META[c.category];
      const color = c.total === 0 ? '#1a7f37' : SEVERITY_COLOR[c.worst ?? 'info'];
      const delta =
        c.delta === null
          ? ''
          : c.delta === 0
            ? '±0'
            : c.delta > 0
              ? `▲${c.delta}`
              : `▼${Math.abs(c.delta)}`;
      return (
        `<div class="card"><div class="card-label">${meta.emoji} ${escapeHtml(meta.label)}</div>` +
        `<div class="card-count" style="color:${color}">${c.total}</div>` +
        `<div class="card-meta">${c.new !== null && c.new > 0 ? `<b class="bad">${c.new} new</b> · ` : ''}${delta}</div></div>`
      );
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PR Review Insight — code report</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1f2328;--muted:#656d76;--card:#f6f8fa;--border:#d0d7de}
@media(prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8b949e;--card:#161b22;--border:#30363d}}
body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;margin:2rem auto;max-width:1100px;padding:0 1rem;background:var(--bg);color:var(--fg)}
h1{font-size:1.4rem}
.policy{color:var(--muted);font-size:.85rem}
.cards{display:flex;flex-wrap:wrap;gap:8px;margin:1rem 0}
.card{background:var(--card);border-radius:8px;padding:10px 14px;min-width:130px}
.card-label{font-size:.75rem;color:var(--muted)}
.card-count{font-size:1.5rem;font-weight:700}
.card-meta{font-size:.75rem;color:var(--muted)}
.bad{color:#cf222e}
.filters{display:flex;flex-wrap:wrap;gap:6px;margin:1rem 0}
.filters button{border:1px solid var(--border);background:var(--card);color:var(--fg);border-radius:999px;padding:4px 12px;font-size:.8rem;cursor:pointer}
.filters button.active{background:#0969da;border-color:#0969da;color:#fff}
table{border-collapse:collapse;width:100%;font-size:.85rem}
th,td{border-bottom:1px solid var(--border);padding:6px 8px;text-align:left;vertical-align:top}
th{position:sticky;top:0;background:var(--bg)}
.sev{font-weight:600;color:var(--c)}
.new{background:#cf222e;color:#fff;border-radius:4px;padding:1px 5px;font-size:.7rem;font-weight:700}
small{color:var(--muted)}
@media print{
  :root{color-scheme:light;--bg:#fff;--fg:#000;--muted:#444;--card:#f3f3f3;--border:#bbb}
  .filters{display:none}
  tbody tr{display:table-row !important;break-inside:avoid}
  body{margin:0;max-width:none;font-size:11px}
  th{position:static}
}
</style>
</head>
<body>
<h1>${escapeHtml(HEADERS[report.state])}</h1>
<p class="policy">${escapeHtml(report.policy?.description ?? '')}${
    report.pr ? ` · PR #${report.pr.number}` : ''
  } · generated ${escapeHtml(report.generatedAt)}</p>
<div class="cards">${cards || '<p>No findings. Ship it. 🎉</p>'}</div>
<div class="filters">
<button class="active" data-filter="all">All (${findings.length})</button>
<button data-filter="new">🆕 New (${findings.filter((f) => f.isNew).length})</button>
${categories
  .map(
    (c) =>
      `<button data-filter="cat:${c.category}">${CATEGORY_META[c.category].emoji} ${escapeHtml(
        CATEGORY_META[c.category].label
      )} (${c.total})</button>`
  )
  .join('\n')}
</div>
<table>
<thead><tr><th>Where</th><th>Category</th><th>Severity</th><th>Rule</th><th>Finding</th></tr></thead>
<tbody>
${findings.map(findingRow).join('\n')}
</tbody>
</table>
<script>
document.querySelectorAll('.filters button').forEach(function(btn){
  btn.addEventListener('click', function(){
    document.querySelectorAll('.filters button').forEach(function(b){b.classList.remove('active')});
    btn.classList.add('active');
    var filter = btn.getAttribute('data-filter');
    document.querySelectorAll('tbody tr').forEach(function(row){
      var show = filter === 'all'
        || (filter === 'new' && row.getAttribute('data-new') === '1')
        || (filter.indexOf('cat:') === 0 && row.getAttribute('data-category') === filter.slice(4));
      row.style.display = show ? '' : 'none';
    });
  });
});
</script>
</body>
</html>`;
}

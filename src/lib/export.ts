// Exports Excel (CSV ; séparateur point-virgule, lisible directement par Excel) et PDF (impression du navigateur).

export type Section = { title: string; head: string[]; rows: (string | number)[][] }

const esc = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')

export function exportExcel(fileBase: string, sections: Section[]) {
  const lines = sections.flatMap((s, i) => [
    ...(sections.length > 1 ? [[s.title]] : []), s.head, ...s.rows, ...(i < sections.length - 1 ? [[]] : []),
  ])
  const csv = lines.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  a.download = `${fileBase}.csv`; a.click(); URL.revokeObjectURL(a.href)
}

export function exportPdf(fileBase: string, title: string, subtitle: string, sections: Section[]) {
  const f = document.createElement('iframe')
  f.style.cssText = 'position:fixed;width:0;height:0;border:0'
  document.body.appendChild(f)
  const d = f.contentDocument!
  d.open()
  d.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(fileBase)}</title><style>body{font:11px sans-serif;margin:24px}h1{font-size:18px}h2{font-size:14px;margin-top:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px;text-align:left}th{background:#eee}</style></head><body>
    <h1>${esc(title)}</h1><p>${esc(subtitle)}</p>
    ${sections.map(s => `<h2>${esc(s.title)}</h2><table><thead><tr>${s.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${s.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}</body></html>`)
  d.close()
  f.contentWindow!.focus(); f.contentWindow!.print()
  setTimeout(() => f.remove(), 1000)
}

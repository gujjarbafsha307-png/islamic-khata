export function downloadCsv(filename, rows) {
  if (!rows.length) return
  const headings = Object.keys(rows[0])
  const csvValue = (value) => {
    const text = value == null ? '' : String(value)
    return `"${text.replaceAll('"', '""')}"`
  }
  const content = [headings, ...rows.map((row) => headings.map((heading) => row[heading]))]
    .map((line) => line.map(csvValue).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}

export function printDocument() {
  window.print()
}
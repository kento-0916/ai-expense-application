'use client';

type CsvRow = { applicant: string; jobType: string; title: string; date: string; category: string; purpose: string; amount: number; status: string };

export function CsvDownload({ rows }: { rows: CsvRow[] }) {
  function download() {
    const header = ['申請者', '職種', '申請名', '日付', '分類', '用途', '金額', '状態'];
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const body = rows.map((row) => [row.applicant, row.jobType, row.title, row.date, row.category, row.purpose, row.amount, row.status].map(escape).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${header.map(escape).join(',')}\r\n${body}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `経費集計_${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return <button className="primary" type="button" onClick={download}>CSVを出力</button>;
}

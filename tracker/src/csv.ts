import fs from 'node:fs';

/** Reads a simple CSV (no quoted fields) into rows keyed by header. */
export function readCsv(file: string): Record<string, string>[] {
  if (!fs.existsSync(file)) return [];
  const [header, ...lines] = fs
    .readFileSync(file, 'utf8')
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (!header) return [];
  const names = header.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(names.map((n, i) => [n, cells[i] ?? '']));
  });
}

/** Writes rows with the given columns, in order. */
export function writeCsv(
  file: string,
  fields: readonly string[],
  rows: Record<string, string | number>[]
): void {
  const lines = [
    fields.join(','),
    ...rows.map((r) => fields.map((f) => r[f] ?? '').join(',')),
  ];
  fs.writeFileSync(file, lines.join('\n') + '\n');
}

/** Display title from upload filename — strip path and common evidence extensions. */
export function evidenceTitleFromFilename(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, '').trim();
  if (!base) return '';
  const withoutExt = base.replace(/\.(pdf|txt|md)$/i, '').trim();
  return withoutExt || base;
}

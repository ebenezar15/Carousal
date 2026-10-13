// Builds a minimal valid PDF (Helvetica text only) so pdf.js can be exercised without binary fixtures.
export interface PdfLine { text: string; size: number; x: number; y: number }

export function makePdf(pages: PdfLine[][], title?: string): Uint8Array {
  const objs: string[] = [];
  const add = (body: string) => { objs.push(body); return objs.length; };
  const catalog = add('');
  const pagesObj = add('');
  const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const kids: number[] = [];
  for (const lines of pages) {
    const esc = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`);
    const stream = lines.map((l) => `BT /F1 ${l.size} Tf ${l.x} ${l.y} Td (${esc(l.text)}) Tj ET`).join('\n');
    const content = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  const info = title ? add(`<< /Title (${title}) >>`) : 0;
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((body, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R${info ? ` /Info ${info} 0 R` : ''} >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

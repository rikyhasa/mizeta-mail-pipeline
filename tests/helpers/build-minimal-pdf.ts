/** Costruisce un PDF minimale ma reale (non un mock): un oggetto Catalog/Pages/Font/Content per
 * pagina, xref con offset reali. Condiviso fra i test che devono esercitare l'estrazione PDF
 * reale (pdfjs-dist) senza dipendere da un file binario fisso nel repository. */
export function buildMinimalPdf(pageTexts: string[]): Buffer {
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  let idCursor = 4;
  const pageIds: number[] = [];
  const contentIds: number[] = [];
  for (let i = 0; i < pageTexts.length; i += 1) {
    pageIds.push(idCursor++);
    contentIds.push(idCursor++);
  }

  const objects: string[] = [];
  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
  objects.push(`${catalogId} 0 obj\n<< /Type /Catalog /Pages ${pagesId} 0 R >>\nendobj`);
  objects.push(`${pagesId} 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageTexts.length} >>\nendobj`);
  objects.push(`${fontId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  pageTexts.forEach((text, i) => {
    const pageId = pageIds[i];
    const contentId = contentIds[i];
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent ${pagesId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> /MediaBox [0 0 300 300] /Contents ${contentId} 0 R >>\nendobj`,
    );
    const streamContent = `BT /F1 12 Tf 10 100 Td (${text}) Tj ET`;
    objects.push(`${contentId} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${obj}\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  const totalObjs = objects.length + 1;
  pdf += `xref\n0 ${totalObjs}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${totalObjs} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

function pdfEscape(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildSimplePdf(title: string, lines: string[]): Uint8Array {
  const header = [
    "BT",
    "/F1 16 Tf",
    "50 780 Td",
    `(${pdfEscape(title.slice(0, 80))}) Tj`,
    "0 -24 Td",
    "/F1 10 Tf",
  ];
  const body: string[] = [];
  for (const line of lines.slice(0, 42)) {
    body.push(`0 -14 Td (${pdfEscape(line.slice(0, 110))}) Tj`);
  }
  const stream = [...header, ...body, "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let offset = "%PDF-1.4\n".length;
  const xref = [0];
  let bodyOut = "%PDF-1.4\n";
  objects.forEach((obj, i) => {
    xref.push(offset);
    const chunk = `${i + 1} 0 obj\n${obj}\nendobj\n`;
    bodyOut += chunk;
    offset += chunk.length;
  });
  const startxref = offset;
  const xrefTable =
    `xref\n0 ${objects.length + 1}\n` +
    xref
      .map((off, i) =>
        i === 0 ? "0000000000 65535 f \n" : `${String(off).padStart(10, "0")} 00000 n \n`,
      )
      .join("");
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF`;
  return new TextEncoder().encode(bodyOut + xrefTable + trailer);
}

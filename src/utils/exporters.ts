export async function exportTxt(extractedByPage: Record<number, { text?: string }[]>) {
  const joined = Object.keys(extractedByPage)
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => extractedByPage[Number(k)].map((r) => r.text || "").join("\n\n"))
    .join("\n\n\n");
  const blob = new Blob([joined], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ocr_results.txt";
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportCsv(extractedByPage: Record<number, { text?: string }[]>) {
  const rows: string[] = ["page,index,text"]; // minimal CSV
  for (const [page, regs] of Object.entries(extractedByPage)) {
    regs.forEach((r, i) => {
      const t = (r.text || "").replaceAll('"', '""');
      rows.push(`${page},${i},"${t}"`);
    });
  }
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ocr_results.csv";
  a.click();
  URL.revokeObjectURL(url);
}


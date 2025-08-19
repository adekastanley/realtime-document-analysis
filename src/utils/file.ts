export function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

export async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  const blobUrl = URL.createObjectURL(file);
  const img = await fetch(blobUrl).then((r) => r.blob());
  const bitmap = await createImageBitmap(img);
  URL.revokeObjectURL(blobUrl);
  return bitmap;
}


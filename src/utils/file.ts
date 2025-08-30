import { loadHighQualityImage, getOptimalScale } from "./image-enhancement";

export function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

/**
 * @deprecated Use loadHighQualityImageCanvas instead for better OCR quality
 */
export async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  const blobUrl = URL.createObjectURL(file);
  const img = await fetch(blobUrl).then((r) => r.blob());
  const bitmap = await createImageBitmap(img, {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
    imageOrientation: 'from-image'
  });
  URL.revokeObjectURL(blobUrl);
  return bitmap;
}

/**
 * Load image with high quality settings optimized for OCR
 */
export async function loadHighQualityImageCanvas(file: File): Promise<HTMLCanvasElement> {
  // Get basic image info first to determine optimal scaling
  const tempBitmap = await loadImageBitmap(file);
  const optimalScale = getOptimalScale(tempBitmap.width, tempBitmap.height);
  tempBitmap.close();
  
  // Load with more conservative settings to prevent browser freezing
  return loadHighQualityImage(file, {
    scale: Math.min(optimalScale, 2.5), // Cap at 2.5x
    maxWidth: 2500, // Reduced from 4000
    maxHeight: 2500, // Reduced from 4000
    preserveAspectRatio: true,
    antiAlias: true
  });
}


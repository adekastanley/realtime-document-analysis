import Tesseract from "tesseract.js";
import type { OCRRegion } from "@/utils/types";

export async function ocrRegions(
  canvas: HTMLCanvasElement,
  page: number,
  regions: OCRRegion[]
): Promise<OCRRegion[]> {
  const ctx = canvas.getContext("2d")!;
  const results: OCRRegion[] = [];

  console.log(`Starting OCR for ${regions.length} regions`);

  for (let i = 0; i < regions.length; i++) {
    const r = regions[i];
    const { x, y, width, height } = r.bbox;
    
    console.log(`Processing region ${i + 1}/${regions.length}: ${width}x${height} at (${x}, ${y})`);

    // Validate region dimensions
    if (width <= 0 || height <= 0) {
      console.warn(`Skipping invalid region with dimensions ${width}x${height}`);
      results.push({ ...r, page, text: "" });
      continue;
    }

    try {
      const data = ctx.getImageData(x, y, width, height);

      // Create an offscreen canvas for region
      const off = document.createElement("canvas");
      off.width = width;
      off.height = height;
      const octx = off.getContext("2d")!;
      octx.putImageData(data, 0, 0);

      console.log(`Starting Tesseract recognition for region ${i + 1}`);
      
      const res = await Tesseract.recognize(off, "eng", {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        }
      });

      console.log(`OCR completed for region ${i + 1}. Text length: ${res.data.text.length}`);
      results.push({ ...r, page, text: res.data.text.trim() });
      
    } catch (error) {
      console.error(`OCR failed for region ${i + 1}:`, error);
      results.push({ ...r, page, text: `[OCR Error: ${error}]` });
    }
  }

  console.log(`OCR completed for all regions. Total text extracted: ${results.map(r => r.text?.length || 0).reduce((a, b) => a + b, 0)} characters`);
  return results;
}

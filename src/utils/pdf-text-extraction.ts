import type { OCRRegion } from "@/utils/types";

// Extract text directly from PDF using PDF.js (much faster and more accurate)
export async function extractPdfText(
  pdfjsLib: any,
  file: File,
  pageIndex: number
): Promise<OCRRegion[]> {
  try {
    console.log(`Attempting to extract native PDF text from page ${pageIndex + 1}`);
    
    const data = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data }).promise;
    const page = await doc.getPage(pageIndex + 1);
    const textContent = await page.getTextContent();
    
    if (!textContent.items || textContent.items.length === 0) {
      console.log("No native text found in PDF, will need OCR");
      return [];
    }

    // Group text items into logical regions
    const regions: OCRRegion[] = [];
    let currentRegion: any = null;
    const LINE_HEIGHT_THRESHOLD = 5; // pixels
    const MIN_REGION_HEIGHT = 20;

    // Sort items by vertical position first, then horizontal
    const sortedItems = textContent.items.sort((a: any, b: any) => {
      const yDiff = b.transform[5] - a.transform[5]; // Y coordinate (inverted)
      if (Math.abs(yDiff) > LINE_HEIGHT_THRESHOLD) {
        return yDiff;
      }
      return a.transform[4] - b.transform[4]; // X coordinate
    });

    for (const item of sortedItems) {
      if (!item.str.trim()) continue;

      const x = item.transform[4];
      const y = item.transform[5];
      const width = item.width;
      const height = item.height;

      // Check if this item should be part of the current region
      if (currentRegion && 
          Math.abs(y - currentRegion.lastY) <= LINE_HEIGHT_THRESHOLD * 2 &&
          x >= currentRegion.bbox.x - 50 && // Allow some horizontal variance
          x <= currentRegion.bbox.x + currentRegion.bbox.width + 50) {
        
        // Extend current region
        currentRegion.text += item.str;
        currentRegion.bbox.width = Math.max(currentRegion.bbox.width, x + width - currentRegion.bbox.x);
        currentRegion.bbox.height = Math.max(currentRegion.bbox.height, Math.abs(y - currentRegion.bbox.y) + height);
        currentRegion.lastY = y;
      } else {
        // Start new region
        if (currentRegion && currentRegion.bbox.height >= MIN_REGION_HEIGHT) {
          regions.push({
            id: crypto.randomUUID(),
            page: pageIndex,
            type: "paragraph",
            bbox: currentRegion.bbox,
            text: currentRegion.text.trim(),
            confidence: 1.0, // Native PDF text is always high confidence
          });
        }

        currentRegion = {
          bbox: { x, y: y - height, width, height },
          text: item.str,
          lastY: y,
        };
      }
    }

    // Add the last region
    if (currentRegion && currentRegion.bbox.height >= MIN_REGION_HEIGHT) {
      regions.push({
        id: crypto.randomUUID(),
        page: pageIndex,
        type: "paragraph",
        bbox: currentRegion.bbox,
        text: currentRegion.text.trim(),
        confidence: 1.0,
      });
    }

    console.log(`Extracted ${regions.length} text regions from PDF page ${pageIndex + 1}`);
    console.log(`Total text length: ${regions.map(r => r.text?.length || 0).reduce((a, b) => a + b, 0)} characters`);

    return regions;

  } catch (error) {
    console.error("PDF text extraction failed:", error);
    return [];
  }
}

// Combine PDF text extraction with OCR fallback
export async function smartTextExtraction(
  pdfjsLib: any,
  file: File,
  canvas: HTMLCanvasElement,
  pageIndex: number,
  ocrFullPageFn: (canvas: HTMLCanvasElement, page: number) => Promise<OCRRegion[]>
): Promise<OCRRegion[]> {
  
  // First try to extract native PDF text
  const pdfRegions = await extractPdfText(pdfjsLib, file, pageIndex);
  
  if (pdfRegions.length > 0) {
    console.log("Using native PDF text extraction (fast and accurate)");
    return pdfRegions;
  } else {
    console.log("No native PDF text found, falling back to OCR");
    return await ocrFullPageFn(canvas, pageIndex);
  }
}

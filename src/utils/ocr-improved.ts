import Tesseract from "tesseract.js";
import type { OCRRegion } from "@/utils/types";

// Preprocess canvas for better OCR quality
function preprocessCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Convert to grayscale and increase contrast
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Convert to grayscale using luminance formula
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    
    // Increase contrast (simple threshold)
    const enhanced = gray > 128 ? 255 : gray < 64 ? 0 : gray;
    
    data[i] = enhanced;     // Red
    data[i + 1] = enhanced; // Green
    data[i + 2] = enhanced; // Blue
    // Alpha channel stays the same
  }

  // Create new canvas with processed image
  const processedCanvas = document.createElement("canvas");
  processedCanvas.width = canvas.width;
  processedCanvas.height = canvas.height;
  const processedCtx = processedCanvas.getContext("2d")!;
  processedCtx.putImageData(imageData, 0, 0);

  return processedCanvas;
}

// Process full page instead of regions for better accuracy
export async function ocrFullPage(
  canvas: HTMLCanvasElement,
  page: number
): Promise<OCRRegion[]> {
  console.log(`Starting full-page OCR for page ${page}`);
  
  try {
    // Preprocess the entire canvas
    const processedCanvas = preprocessCanvas(canvas);
    
    const res = await Tesseract.recognize(processedCanvas, "eng", {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
      tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
      // Better settings for small text
      tessedit_char_blacklist: '',
      preserve_interword_spaces: '1',
    });

    console.log(`Full-page OCR completed. Text length: ${res.data.text.length}`);
    console.log("OCR confidence:", res.data.confidence);

    // Create one large region covering the entire page
    return [{
      id: crypto.randomUUID(),
      page,
      type: "paragraph",
      bbox: { x: 0, y: 0, width: canvas.width, height: canvas.height },
      text: res.data.text.trim(),
      confidence: res.data.confidence,
    }];
    
  } catch (error) {
    console.error(`Full-page OCR failed:`, error);
    return [{
      id: crypto.randomUUID(),
      page,
      type: "paragraph",
      bbox: { x: 0, y: 0, width: canvas.width, height: canvas.height },
      text: `[OCR Error: ${error}]`,
      confidence: 0,
    }];
  }
}

// Enhanced region-based OCR with better preprocessing
export async function ocrRegions(
  canvas: HTMLCanvasElement,
  page: number,
  regions: OCRRegion[]
): Promise<OCRRegion[]> {
  const ctx = canvas.getContext("2d")!;
  const results: OCRRegion[] = [];

  console.log(`Starting region-based OCR for ${regions.length} regions`);

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
      // Extract region with some padding
      const padding = 10;
      const paddedX = Math.max(0, x - padding);
      const paddedY = Math.max(0, y - padding);
      const paddedWidth = Math.min(canvas.width - paddedX, width + 2 * padding);
      const paddedHeight = Math.min(canvas.height - paddedY, height + 2 * padding);

      const data = ctx.getImageData(paddedX, paddedY, paddedWidth, paddedHeight);

      // Create region canvas
      const regionCanvas = document.createElement("canvas");
      regionCanvas.width = paddedWidth;
      regionCanvas.height = paddedHeight;
      const regionCtx = regionCanvas.getContext("2d")!;
      regionCtx.putImageData(data, 0, 0);

      // Preprocess the region
      const processedCanvas = preprocessCanvas(regionCanvas);

      console.log(`Starting Tesseract recognition for region ${i + 1}`);
      
      const res = await Tesseract.recognize(processedCanvas, "eng", {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`Region ${i + 1} OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
        // Better settings for small text
        tessedit_char_blacklist: '',
        preserve_interword_spaces: '1',
      });

      console.log(`OCR completed for region ${i + 1}. Text length: ${res.data.text.length}, confidence: ${res.data.confidence}`);
      results.push({ ...r, page, text: res.data.text.trim(), confidence: res.data.confidence });
      
    } catch (error) {
      console.error(`OCR failed for region ${i + 1}:`, error);
      results.push({ ...r, page, text: `[OCR Error: ${error}]`, confidence: 0 });
    }
  }

  console.log(`Region-based OCR completed. Total text extracted: ${results.map(r => r.text?.length || 0).reduce((a, b) => a + b, 0)} characters`);
  return results;
}

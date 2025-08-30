import Tesseract from "tesseract.js";
import type { OCRRegion } from "@/utils/types";
import { enhanceImageForOCR, getOptimalScale, type ImageEnhancementOptions } from "./image-enhancement";
import { getOptimalConfig, applyConfigWithLogging } from "./tesseract-config";

// Enhanced preprocessing function with advanced image enhancement
function preprocessCanvas(
  canvas: HTMLCanvasElement, 
  options: Partial<ImageEnhancementOptions> = {}
): HTMLCanvasElement {
  // Determine optimal scale if not provided
  const scale = options.scale || Math.min(2, getOptimalScale(canvas.width, canvas.height));
  
  const enhancementOptions: ImageEnhancementOptions = {
    scale,
    sharpen: true,
    denoise: true,
    enhanceContrast: true,
    adaptiveThreshold: true,
    antiAlias: true,
    maxWidth: 4000,
    maxHeight: 4000,
    preserveAspectRatio: true,
    ...options
  };
  
  return enhanceImageForOCR(canvas, enhancementOptions);
}

// Process full page instead of regions for better accuracy
export async function ocrFullPage(
  canvas: HTMLCanvasElement,
  page: number
): Promise<OCRRegion[]> {
  console.log(`Starting full-page OCR for page ${page}`);
  
  try {
    // Preprocess the entire canvas with moderate quality settings to prevent freezing
    const pixelCount = canvas.width * canvas.height;
    const isLargeImage = pixelCount > 1000000; // 1MP+
    
    const processedCanvas = preprocessCanvas(canvas, {
      scale: isLargeImage ? 1.5 : Math.min(2, getOptimalScale(canvas.width, canvas.height)),
      sharpen: !isLargeImage,
      denoise: false, // Disable for full page to save processing
      enhanceContrast: true,
      adaptiveThreshold: !isLargeImage, // Skip for large images
      maxWidth: 2000, // Reduced from 3000
      maxHeight: 2000  // Reduced from 3000
    });
    
    // Get optimal OCR configuration
    const ocrConfig = applyConfigWithLogging(
      getOptimalConfig(processedCanvas.width, processedCanvas.height, 'medium', 'paragraph'),
      'full-page OCR'
    );
    
    const res = await Tesseract.recognize(processedCanvas, "eng", {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
      ...ocrConfig
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

      // Preprocess the region with enhanced settings
      const processedCanvas = preprocessCanvas(regionCanvas, {
        scale: Math.min(4, getOptimalScale(regionCanvas.width, regionCanvas.height)),
        sharpen: true,
        denoise: true,
        enhanceContrast: true,
        adaptiveThreshold: true
      });

      console.log(`Starting Tesseract recognition for region ${i + 1}`);
      
      // Estimate text size based on region dimensions
      const avgDimension = (paddedWidth + paddedHeight) / 2;
      const textSize = avgDimension < 100 ? 'small' : avgDimension < 300 ? 'medium' : 'large';
      
      // Get optimal configuration for this region
      const regionConfig = applyConfigWithLogging(
        getOptimalConfig(processedCanvas.width, processedCanvas.height, textSize, 'paragraph'),
        `region ${i + 1}`
      );
      
      const res = await Tesseract.recognize(processedCanvas, "eng", {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`Region ${i + 1} OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        ...regionConfig
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

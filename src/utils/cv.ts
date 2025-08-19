import type { OCRRegion, RegionType } from "@/utils/types";

export async function loadDetector() {
  // Simple detector that doesn't require model loading for now
  return { type: 'simple-fallback' };
}

const labelToRegion: Record<string, RegionType> = {
  person: "paragraph",
  // map generic labels to layout types as a simple demo; replace with real layout model classes
};

export async function detectLayout(
  model: any,
  canvas: HTMLCanvasElement
): Promise<OCRRegion[]> {
  // Simple fallback: create a few regions covering the full document
  // This is better than relying on COCO-SSD which isn't trained for documents
  const { width, height } = canvas;
  
  return [
    {
      id: crypto.randomUUID(),
      page: 0, // caller should override
      type: "paragraph" as RegionType,
      bbox: { x: 50, y: 50, width: width - 100, height: Math.min(200, height / 3) },
      confidence: 1.0,
    },
    {
      id: crypto.randomUUID(),
      page: 0,
      type: "paragraph" as RegionType,
      bbox: { x: 50, y: height / 3 + 60, width: width - 100, height: Math.min(200, height / 3) },
      confidence: 1.0,
    },
    {
      id: crypto.randomUUID(),
      page: 0,
      type: "paragraph" as RegionType,
      bbox: { x: 50, y: (2 * height) / 3 + 70, width: width - 100, height: Math.min(200, height / 3 - 70) },
      confidence: 1.0,
    },
  ].filter(r => r.bbox.height > 50); // Only include regions with reasonable height
}


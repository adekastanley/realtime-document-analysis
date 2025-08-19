import Tesseract from "tesseract.js";
import type { OCRRegion } from "@/utils/types";

export async function ocrRegions(
  canvas: HTMLCanvasElement,
  page: number,
  regions: OCRRegion[]
): Promise<OCRRegion[]> {
  const ctx = canvas.getContext("2d")!;
  const results: OCRRegion[] = [];

  for (const r of regions) {
    const { x, y, width, height } = r.bbox;
    const data = ctx.getImageData(x, y, width, height);

    // Create an offscreen canvas for region
    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const octx = off.getContext("2d")!;
    octx.putImageData(data, 0, 0);

    const res = await Tesseract.recognize(off, "eng", {
      logger: m => console.log(m)
    });

    results.push({ ...r, page, text: res.data.text });
  }

  return results;
}


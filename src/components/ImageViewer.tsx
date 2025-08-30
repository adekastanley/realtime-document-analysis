"use client";

import { useEffect, useRef, useState } from "react";
import { loadHighQualityImageCanvas } from "@/utils/file";
import type { OCRRegion } from "@/utils/types";
import { loadDetector, detectLayout } from "@/utils/cv";
import { ocrRegions, ocrFullPage } from "@/utils/ocr-improved";
import { PanZoomCanvas } from "./PanZoomCanvas";

export function ImageViewer({
  file,
  regions,
  onRegionsChange,
  onExtracted,
}: {
  file: File;
  regions: OCRRegion[];
  onRegionsChange: (r: OCRRegion[]) => void;
  onExtracted: (page: number, regions: OCRRegion[]) => void;
}) {
  const [detector, setDetector] = useState<any | null>(null);
  const [running, setRunning] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [imageData, setImageData] = useState<HTMLCanvasElement | null>(null);

  // Load and prepare image data
  useEffect(() => {
    let mounted = true;
    async function loadImage() {
      if (!file) return;
      
      try {
        // Load image with enhanced quality settings
        const highQualityCanvas = await loadHighQualityImageCanvas(file);
        
        if (mounted) {
          setImageDimensions({
            width: highQualityCanvas.width,
            height: highQualityCanvas.height
          });
          setImageData(highQualityCanvas);
          console.log(`Loaded high-quality image: ${highQualityCanvas.width}x${highQualityCanvas.height}`);
        }
      } catch (error) {
        console.error('Failed to load high-quality image:', error);
      }
    }
    loadImage();
    return () => { mounted = false; };
  }, [file]);

  // Draw image data when canvas is available
  const drawImageToCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas || !imageData) return;
    
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imageData, 0, 0);
  };

  // Lazy-load detector once on client
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const m = await loadDetector();
        if (mounted) setDetector(m);
      } catch (e) {
        console.warn('Detector load failed', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleDetect = (canvas: HTMLCanvasElement | null, overlay: HTMLCanvasElement | null) => {
    return async () => {
      if (!detector || !canvas) return;
      setRunning(true);
      try {
        const raw = await detectLayout(detector, canvas);
        // Stamp page number (always 0 for single image)
        const stamped = raw.map(r => ({ ...r, page: 0 }));
        onRegionsChange(stamped);
        // Draw boxes
        if (overlay) {
          const octx = overlay.getContext('2d')!;
          octx.clearRect(0, 0, overlay.width, overlay.height);
          octx.strokeStyle = '#ef4444';
          octx.lineWidth = 2;
          for (const r of stamped) {
            octx.strokeRect(r.bbox.x, r.bbox.y, r.bbox.width, r.bbox.height);
          }
        }
      } finally {
        setRunning(false);
      }
    };
  };

  const handleFullPageOCR = (canvas: HTMLCanvasElement | null, overlay: HTMLCanvasElement | null) => {
    return async () => {
      if (!canvas) return;
      setRunning(true);
      try {
        const res = await ocrFullPage(canvas, 0);
        onRegionsChange(res);
        onExtracted(0, res);
        // Draw region
        drawRegions(res, overlay);
      } finally {
        setRunning(false);
      }
    };
  };

  const handleOCR = (canvas: HTMLCanvasElement | null) => {
    return async () => {
      if (!canvas || regions.length === 0) return;
      setRunning(true);
      try {
        const res = await ocrRegions(canvas, 0, regions);
        onExtracted(0, res);
      } finally {
        setRunning(false);
      }
    };
  };

  function drawRegions(regionsToDrawn: OCRRegion[], overlay: HTMLCanvasElement | null) {
    if (!overlay) return;
    const octx = overlay.getContext('2d')!;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.strokeStyle = '#22c55e'; // Green for successful extraction
    octx.lineWidth = 2;
    for (const r of regionsToDrawn) {
      octx.strokeRect(r.bbox.x, r.bbox.y, r.bbox.width, r.bbox.height);
    }
  }

  if (!imageDimensions.width || !imageDimensions.height) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading image...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <PanZoomCanvas
        width={imageDimensions.width}
        height={imageDimensions.height}
      >
        {(canvas, overlay) => {
          // Draw the image when canvas becomes available
          if (canvas && imageData && !canvas.style.backgroundImage) {
            drawImageToCanvas(canvas);
            canvas.style.backgroundImage = 'url(data:image/png;base64,loaded)';
          }

          return (
            <div className="flex items-center gap-2 p-2 border-t bg-gray-50">
              <div className="text-sm text-gray-600">
                Image: {file.name}
              </div>
              <div className="flex gap-2 ml-auto">
                <button 
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100" 
                  onClick={handleFullPageOCR(canvas, overlay)} 
                  disabled={running}
                >
                  {running ? 'Processing...' : 'Full Page OCR'}
                </button>
                <button 
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100" 
                  onClick={handleDetect(canvas, overlay)} 
                  disabled={!detector || running}
                >
                  {running ? 'Processing...' : 'Manual Regions'}
                </button>
              </div>
            </div>
          );
        }}
      </PanZoomCanvas>
    </div>
  );
}

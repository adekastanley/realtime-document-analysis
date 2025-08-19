"use client";

import { useEffect, useRef, useState } from "react";
import { loadImageBitmap } from "@/utils/file";
import type { OCRRegion } from "@/utils/types";
import { loadDetector, detectLayout } from "@/utils/cv";
import { ocrRegions, ocrFullPage } from "@/utils/ocr-improved";

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [detector, setDetector] = useState<any | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadImage() {
      if (!file) return;
      const bitmap = await loadImageBitmap(file);
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      
      // Scale up for better OCR quality
      const scale = 2;
      canvas.width = bitmap.width * scale;
      canvas.height = bitmap.height * scale;
      
      // Use smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      // Clear overlay
      const overlay = overlayRef.current!;
      overlay.width = canvas.width;
      overlay.height = canvas.height;
      const octx = overlay.getContext("2d")!;
      octx.clearRect(0, 0, overlay.width, overlay.height);
    }
    loadImage();
    return () => { mounted = false; };
  }, [file]);

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

  async function handleDetect() {
    if (!detector || !canvasRef.current) return;
    setRunning(true);
    try {
      const raw = await detectLayout(detector, canvasRef.current);
      // Stamp page number (always 0 for single image)
      const stamped = raw.map(r => ({ ...r, page: 0 }));
      onRegionsChange(stamped);
      // Draw boxes
      const overlay = overlayRef.current!;
      const octx = overlay.getContext('2d')!;
      octx.clearRect(0, 0, overlay.width, overlay.height);
      octx.strokeStyle = '#ef4444';
      octx.lineWidth = 2;
      for (const r of stamped) {
        octx.strokeRect(r.bbox.x, r.bbox.y, r.bbox.width, r.bbox.height);
      }
    } finally {
      setRunning(false);
    }
  }

  async function handleFullPageOCR() {
    if (!canvasRef.current) return;
    setRunning(true);
    try {
      const res = await ocrFullPage(canvasRef.current, 0);
      onRegionsChange(res);
      onExtracted(0, res);
      // Draw region
      drawRegions(res);
    } finally {
      setRunning(false);
    }
  }

  async function handleOCR() {
    if (!canvasRef.current || regions.length === 0) return;
    setRunning(true);
    try {
      const res = await ocrRegions(canvasRef.current, 0, regions);
      onExtracted(0, res);
    } finally {
      setRunning(false);
    }
  }

  function drawRegions(regionsToDrawn: OCRRegion[]) {
    if (!overlayRef.current) return;
    const overlay = overlayRef.current;
    const octx = overlay.getContext('2d')!;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.strokeStyle = '#22c55e'; // Green for successful extraction
    octx.lineWidth = 2;
    for (const r of regionsToDrawn) {
      octx.strokeRect(r.bbox.x, r.bbox.y, r.bbox.width, r.bbox.height);
    }
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="text-sm">Image: {file.name}</div>
        <div className="flex gap-2">
          <button className="px-2 py-1 border rounded" onClick={handleFullPageOCR} disabled={running}>
            {running ? '...' : 'Full Page OCR'}
          </button>
          <button className="px-2 py-1 border rounded" onClick={handleDetect} disabled={!detector || running}>
            {running ? '...' : 'Manual Regions'}
          </button>
        </div>
      </div>
      <div className="relative flex-1 overflow-auto bg-gray-50">
        <canvas ref={canvasRef} className="block mx-auto" />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 mx-auto" />
      </div>
    </div>
  );
}

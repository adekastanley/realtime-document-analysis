"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { OCRRegion } from "@/utils/types";
import { loadDetector, detectLayout } from "@/utils/cv";
import { ocrRegions, ocrFullPage } from "@/utils/ocr-improved";
import { smartTextExtraction } from "@/utils/pdf-text-extraction";


export function PdfViewer({
  file,
  pageIndex,
  onPageChange,
  regions,
  onRegionsChange,
  onExtracted,
}: {
  file: File | null;
  pageIndex: number;
  onPageChange: (index: number) => void;
  regions: OCRRegion[];
  onRegionsChange: (r: OCRRegion[]) => void;
  onExtracted: (page: number, regions: OCRRegion[]) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [detector, setDetector] = useState<any | null>(null);
  const [running, setRunning] = useState(false);
  const [pdfjsLib, setPdfjsLib] = useState<any>(null);

  // Load PDF.js dynamically on client side
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const lib = await import('pdfjs-dist');
        // @ts-ignore
        lib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
        if (mounted) setPdfjsLib(lib);
      } catch (e) {
        console.warn('PDF.js load failed', e);
      }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!file || !pdfjsLib) {
        setPdf(null);
        setNumPages(0);
        return;
      }
      const data = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data }).promise;
      if (!cancelled) {
        setPdf(doc);
        setNumPages(doc.numPages);
        onPageChange(0);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [file, pdfjsLib, onPageChange]);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!pdf) return;
      const page: PDFPageProxy = await pdf.getPage(pageIndex + 1);
      const viewport = page.getViewport({ scale: 2.5 }); // Higher scale for better OCR quality
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx as any, viewport }).promise;

      // Clear overlay
      const overlay = overlayRef.current!;
      overlay.width = canvas.width;
      overlay.height = canvas.height;
      const octx = overlay.getContext("2d")!;
      octx.clearRect(0, 0, overlay.width, overlay.height);
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageIndex]);

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

  const prev = () => onPageChange(Math.max(0, pageIndex - 1));
  const next = () => onPageChange(Math.min((numPages || 1) - 1, pageIndex + 1));

  async function handleDetect() {
    if (!detector || !canvasRef.current) return;
    setRunning(true);
    try {
      const raw = await detectLayout(detector, canvasRef.current);
      // Stamp page number and store
      const stamped = raw.map(r => ({ ...r, page: pageIndex }));
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

  async function handleSmartExtract() {
    if (!canvasRef.current || !file || !pdfjsLib) return;
    setRunning(true);
    try {
      const res = await smartTextExtraction(pdfjsLib, file, canvasRef.current, pageIndex, ocrFullPage);
      onRegionsChange(res);
      onExtracted(pageIndex, res);
      // Draw regions
      drawRegions(res);
    } finally {
      setRunning(false);
    }
  }

  async function handleFullPageOCR() {
    if (!canvasRef.current) return;
    setRunning(true);
    try {
      const res = await ocrFullPage(canvasRef.current, pageIndex);
      onRegionsChange(res);
      onExtracted(pageIndex, res);
      // Draw single region covering full page
      drawRegions(res);
    } finally {
      setRunning(false);
    }
  }

  async function handleOCR() {
    if (!canvasRef.current || regions.length === 0) return;
    setRunning(true);
    try {
      const res = await ocrRegions(canvasRef.current, pageIndex, regions);
      onExtracted(pageIndex, res);
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
        <div className="text-sm">Page {numPages ? pageIndex + 1 : 0} / {numPages}</div>
        <div className="flex gap-2">
          <button className="px-2 py-1 border rounded" onClick={prev} disabled={!pdf || pageIndex === 0}>Prev</button>
          <button className="px-2 py-1 border rounded" onClick={next} disabled={!pdf || pageIndex >= numPages - 1}>Next</button>
          <button className="px-2 py-1 border rounded" onClick={handleSmartExtract} disabled={!pdf || running}>{running ? '...' : 'Smart Extract'}</button>
          <button className="px-2 py-1 border rounded" onClick={handleFullPageOCR} disabled={!pdf || running}>{running ? '...' : 'Full Page OCR'}</button>
          <button className="px-2 py-1 border rounded" onClick={handleDetect} disabled={!pdf || !detector || running}>{running ? '...' : 'Manual Regions'}</button>
        </div>
      </div>
      <div className="relative flex-1 overflow-auto bg-gray-50">
        <canvas ref={canvasRef} className="block mx-auto" />
        <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 mx-auto" />
      </div>
    </div>
  );
}


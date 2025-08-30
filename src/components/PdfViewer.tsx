"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { OCRRegion } from "@/utils/types";
import { loadDetector, detectLayout } from "@/utils/cv";
import { ocrRegions, ocrFullPage } from "@/utils/ocr-improved";
import { smartTextExtraction } from "@/utils/pdf-text-extraction";
import { PanZoomCanvas } from "./PanZoomCanvas";


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
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [detector, setDetector] = useState<any | null>(null);
  const [running, setRunning] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const [pdfjsLib, setPdfjsLib] = useState<any>(null);
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 });
  const [pageCanvas, setPageCanvas] = useState<HTMLCanvasElement | null>(null);

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

  // Render current page to canvas
  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!pdf) return;
      
      const page: PDFPageProxy = await pdf.getPage(pageIndex + 1);
      // Use higher scale for better OCR quality - aim for 300 DPI equivalent
      const baseScale = 2.5;
      const optimalScale = Math.min(4, Math.max(baseScale, 300 / 72)); // 300 DPI target
      const viewport = page.getViewport({ scale: optimalScale });
      
      // Create a canvas to render the page
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;

      await page.render({ canvasContext: ctx as any, viewport }).promise;
      
      if (!cancelled) {
        setPageDimensions({
          width: viewport.width,
          height: viewport.height
        });
        setPageCanvas(canvas);
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [pdf, pageIndex]);

  // Draw page canvas to display canvas
  const drawPageToCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas || !pageCanvas) return;
    
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pageCanvas, 0, 0);
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

  const prev = () => onPageChange(Math.max(0, pageIndex - 1));
  const next = () => onPageChange(Math.min((numPages || 1) - 1, pageIndex + 1));

  // Batch process all pages
  const handleBatchProcessAllPages = async () => {
    if (!pdf || !pdfjsLib) return;
    
    setBatchProcessing(true);
    setBatchProgress({ current: 0, total: numPages });
    
    try {
      for (let i = 0; i < numPages; i++) {
        setBatchProgress({ current: i + 1, total: numPages });
        
        // Render page to canvas
        const page: PDFPageProxy = await pdf.getPage(i + 1);
        const baseScale = 2;
        const viewport = page.getViewport({ scale: baseScale });
        
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d')!;
        
        await page.render({ canvasContext: ctx as any, viewport }).promise;
        
        // Process OCR for this page
        const res = await ocrFullPage(canvas, i);
        onExtracted(i, res);
        
        // Small delay to prevent browser freezing
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      setBatchProcessing(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  };

  // Handler functions for PanZoomCanvas
  const handleDetect = (canvas: HTMLCanvasElement | null, overlay: HTMLCanvasElement | null) => {
    return async () => {
      if (!detector || !canvas) return;
      setRunning(true);
      try {
        const raw = await detectLayout(detector, canvas);
        const stamped = raw.map(r => ({ ...r, page: pageIndex }));
        onRegionsChange(stamped);
        
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

  const handleSmartExtract = (canvas: HTMLCanvasElement | null, overlay: HTMLCanvasElement | null) => {
    return async () => {
      if (!canvas || !file || !pdfjsLib) return;
      setRunning(true);
      try {
        const res = await smartTextExtraction(pdfjsLib, file, canvas, pageIndex, ocrFullPage);
        onRegionsChange(res);
        onExtracted(pageIndex, res);
        drawRegions(res, overlay);
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
        const res = await ocrFullPage(canvas, pageIndex);
        onRegionsChange(res);
        onExtracted(pageIndex, res);
        drawRegions(res, overlay);
      } finally {
        setRunning(false);
      }
    };
  };

  function drawRegions(regionsToDrawn: OCRRegion[], overlay: HTMLCanvasElement | null) {
    if (!overlay) return;
    const octx = overlay.getContext('2d')!;
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.strokeStyle = '#22c55e';
    octx.lineWidth = 2;
    for (const r of regionsToDrawn) {
      octx.strokeRect(r.bbox.x, r.bbox.y, r.bbox.width, r.bbox.height);
    }
  }

  if (!pageDimensions.width || !pageDimensions.height) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Loading PDF page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <PanZoomCanvas
        key={`pdf-page-${pageIndex}`} // Force re-render when page changes
        width={pageDimensions.width}
        height={pageDimensions.height}
      >
        {(canvas, overlay) => {
          // Draw the page when canvas becomes available or page changes
          if (canvas && pageCanvas) {
            // Clear the canvas first
            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Draw the current page
            drawPageToCanvas(canvas);
          }

          return (
            <div className="space-y-2">
              {/* Page Navigation */}
              <div className="flex items-center justify-between p-2 border-t bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">
                    Page {numPages ? pageIndex + 1 : 0} / {numPages}
                  </span>
                  {batchProcessing && (
                    <span className="text-xs text-blue-600">
                      Processing {batchProgress.current}/{batchProgress.total}...
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button 
                    className="px-2 py-1 text-sm border rounded hover:bg-gray-100" 
                    onClick={prev} 
                    disabled={!pdf || pageIndex === 0}
                  >
                    Prev
                  </button>
                  <button 
                    className="px-2 py-1 text-sm border rounded hover:bg-gray-100" 
                    onClick={next} 
                    disabled={!pdf || pageIndex >= numPages - 1}
                  >
                    Next
                  </button>
                </div>
              </div>

              {/* OCR Controls */}
              <div className="flex flex-wrap items-center gap-2 p-2 border-t bg-gray-50">
                <button 
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100" 
                  onClick={handleFullPageOCR(canvas, overlay)} 
                  disabled={running || batchProcessing}
                >
                  {running ? 'Processing...' : 'Current Page OCR'}
                </button>
                <button 
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100" 
                  onClick={handleSmartExtract(canvas, overlay)} 
                  disabled={running || batchProcessing}
                >
                  {running ? 'Processing...' : 'Smart Extract'}
                </button>
                <button 
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-100" 
                  onClick={handleDetect(canvas, overlay)} 
                  disabled={!detector || running || batchProcessing}
                >
                  {running ? 'Processing...' : 'Manual Regions'}
                </button>
                <div className="border-l border-gray-300 h-6 mx-2"></div>
                <button 
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700" 
                  onClick={handleBatchProcessAllPages} 
                  disabled={!pdf || running || batchProcessing}
                >
                  {batchProcessing ? `Processing ${batchProgress.current}/${batchProgress.total}...` : `OCR All ${numPages} Pages`}
                </button>
              </div>
            </div>
          );
        }}
      </PanZoomCanvas>
    </div>
  );
}


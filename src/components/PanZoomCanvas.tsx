"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface PanZoomCanvasProps {
  width: number;
  height: number;
  children: (canvas: HTMLCanvasElement | null, overlay: HTMLCanvasElement | null) => React.ReactNode;
  className?: string;
}

export function PanZoomCanvas({ width, height, children, className = "" }: PanZoomCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Calculate initial fit-to-screen zoom
  const calculateFitZoom = useCallback(() => {
    if (!containerSize.width || !containerSize.height || !width || !height) return 1;
    
    const scaleX = (containerSize.width - 40) / width; // 40px margin
    const scaleY = (containerSize.height - 40) / height;
    return Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 100%
  }, [containerSize, width, height]);

  // Update container size on mount and resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Set initial zoom to fit screen
  useEffect(() => {
    if (containerSize.width && containerSize.height) {
      const fitZoom = calculateFitZoom();
      setZoom(fitZoom);
      
      // Center the image
      const scaledWidth = width * fitZoom;
      const scaledHeight = height * fitZoom;
      setPan({
        x: (containerSize.width - scaledWidth) / 2,
        y: (containerSize.height - scaledHeight) / 2
      });
    }
  }, [calculateFitZoom, width, height, containerSize]);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));

    // Zoom towards mouse cursor
    const deltaZoom = newZoom / zoom;
    setPan(prev => ({
      x: mouseX - (mouseX - prev.x) * deltaZoom,
      y: mouseY - (mouseY - prev.y) * deltaZoom
    }));
    
    setZoom(newZoom);
  }, [zoom]);

  // Handle mouse pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) { // Left click only
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Fit to screen function
  const fitToScreen = useCallback(() => {
    const fitZoom = calculateFitZoom();
    setZoom(fitZoom);
    
    const scaledWidth = width * fitZoom;
    const scaledHeight = height * fitZoom;
    setPan({
      x: (containerSize.width - scaledWidth) / 2,
      y: (containerSize.height - scaledHeight) / 2
    });
  }, [calculateFitZoom, width, height, containerSize]);

  // Reset zoom to 100%
  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({
      x: (containerSize.width - width) / 2,
      y: (containerSize.height - height) / 2
    });
  }, [width, height, containerSize]);

  // Add wheel event listener
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  const canvasStyle: React.CSSProperties = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transformOrigin: '0 0',
    cursor: isDragging ? 'grabbing' : 'grab'
  };

  return (
    <div className="flex flex-col h-full">
      {/* Zoom Controls */}
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50">
        <button
          onClick={() => setZoom(Math.min(5, zoom * 1.2))}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
        >
          Zoom In
        </button>
        <button
          onClick={() => setZoom(Math.max(0.1, zoom * 0.8))}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
        >
          Zoom Out
        </button>
        <button
          onClick={fitToScreen}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
        >
          Fit to Screen
        </button>
        <button
          onClick={resetZoom}
          className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
        >
          100%
        </button>
        <span className="text-sm text-gray-600">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Canvas Container */}
      <div
        ref={containerRef}
        className={`relative flex-1 overflow-hidden bg-gray-100 ${className}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={canvasStyle} className="absolute">
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="block border shadow-sm bg-white"
          />
          <canvas
            ref={overlayRef}
            width={width}
            height={height}
            className="absolute inset-0 pointer-events-none"
          />
        </div>
        
        {/* Display canvas size info */}
        <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
          {width} × {height}
        </div>
      </div>

      {children(canvasRef.current, overlayRef.current)}
    </div>
  );
}

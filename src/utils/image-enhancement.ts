/**
 * Advanced Image Enhancement Utilities for OCR
 * Provides high-quality image preprocessing techniques to improve OCR accuracy
 */

export interface ImageEnhancementOptions {
  // Scaling options
  scale?: number;
  maxWidth?: number;
  maxHeight?: number;
  
  // Enhancement options
  sharpen?: boolean;
  denoise?: boolean;
  enhanceContrast?: boolean;
  adaptiveThreshold?: boolean;
  
  // OCR-specific optimizations
  dpi?: number;
  preserveAspectRatio?: boolean;
  antiAlias?: boolean;
}

/**
 * Enhanced image preprocessing with multiple quality improvement techniques
 */
export function enhanceImageForOCR(
  canvas: HTMLCanvasElement, 
  options: ImageEnhancementOptions = {}
): HTMLCanvasElement {
  const {
    scale = 1,
    sharpen = true,
    denoise = true,
    enhanceContrast = true,
    adaptiveThreshold = true,
    antiAlias = true,
    maxWidth = 3000,  // Reduced from 4000
    maxHeight = 3000  // Reduced from 4000
  } = options;

  // Create high-resolution output canvas with safety limits
  const outputCanvas = document.createElement('canvas');
  const scaledWidth = Math.min(Math.floor(canvas.width * scale), maxWidth);
  const scaledHeight = Math.min(Math.floor(canvas.height * scale), maxHeight);
  
  outputCanvas.width = scaledWidth;
  outputCanvas.height = scaledHeight;
  
  const ctx = outputCanvas.getContext('2d')!;
  
  // Enable high-quality image rendering
  ctx.imageSmoothingEnabled = antiAlias;
  ctx.imageSmoothingQuality = 'high';
  
  // Draw the source image with scaling
  ctx.drawImage(canvas, 0, 0, scaledWidth, scaledHeight);
  
  // Get image data for processing
  const imageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight);
  const data = imageData.data;
  const width = imageData.width;
  const height = imageData.height;
  
  // Apply enhancements in sequence
  if (denoise) {
    applyGaussianBlur(data, width, height, 0.5); // Light denoising
  }
  
  if (sharpen) {
    applyUnsharpMask(data, width, height);
  }
  
  if (enhanceContrast) {
    applyAdaptiveContrastEnhancement(data, width, height);
  }
  
  if (adaptiveThreshold) {
    applyAdaptiveThresholding(data, width, height);
  }
  
  // Put the processed image data back
  ctx.putImageData(imageData, 0, 0);
  
  return outputCanvas;
}

/**
 * Advanced image loading with quality preservation
 */
export async function loadHighQualityImage(
  file: File, 
  options: ImageEnhancementOptions = {}
): Promise<HTMLCanvasElement> {
  const {
    scale = 3, // Default to 3x scaling for better OCR
    maxWidth = 4000,
    maxHeight = 4000,
    preserveAspectRatio = true
  } = options;

  // Create high-quality image bitmap
  const blobUrl = URL.createObjectURL(file);
  
  try {
    // Use createImageBitmap with high quality options
    const blob = await fetch(blobUrl).then(r => r.blob());
    const bitmap = await createImageBitmap(blob, {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none',
      imageOrientation: 'from-image'
    });
    
    // Calculate optimal dimensions
    let targetWidth = bitmap.width * scale;
    let targetHeight = bitmap.height * scale;
    
    // Respect maximum dimensions while preserving aspect ratio
    if (preserveAspectRatio) {
      const aspectRatio = bitmap.width / bitmap.height;
      if (targetWidth > maxWidth) {
        targetWidth = maxWidth;
        targetHeight = targetWidth / aspectRatio;
      }
      if (targetHeight > maxHeight) {
        targetHeight = maxHeight;
        targetWidth = targetHeight * aspectRatio;
      }
    } else {
      targetWidth = Math.min(targetWidth, maxWidth);
      targetHeight = Math.min(targetHeight, maxHeight);
    }
    
    // Create high-resolution canvas
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(targetWidth);
    canvas.height = Math.floor(targetHeight);
    
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw with high quality
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    
    return canvas;
    
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Gaussian blur for noise reduction (lightweight implementation)
 */
function applyGaussianBlur(data: Uint8ClampedArray, width: number, height: number, sigma: number) {
  const kernel = createGaussianKernel(sigma);
  const kernelSize = kernel.length;
  const offset = Math.floor(kernelSize / 2);
  
  const original = new Uint8ClampedArray(data);
  
  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      let weightSum = 0;
      
      for (let i = 0; i < kernelSize; i++) {
        const px = Math.min(Math.max(x + i - offset, 0), width - 1);
        const idx = (y * width + px) * 4;
        const weight = kernel[i];
        
        r += original[idx] * weight;
        g += original[idx + 1] * weight;
        b += original[idx + 2] * weight;
        weightSum += weight;
      }
      
      const idx = (y * width + x) * 4;
      data[idx] = Math.round(r / weightSum);
      data[idx + 1] = Math.round(g / weightSum);
      data[idx + 2] = Math.round(b / weightSum);
    }
  }
}

/**
 * Unsharp mask for image sharpening
 */
function applyUnsharpMask(data: Uint8ClampedArray, width: number, height: number) {
  const original = new Uint8ClampedArray(data);
  
  // Simple sharpening kernel
  const kernel = [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0, g = 0, b = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const weight = kernel[(ky + 1) * 3 + (kx + 1)];
          
          r += original[idx] * weight;
          g += original[idx + 1] * weight;
          b += original[idx + 2] * weight;
        }
      }
      
      const idx = (y * width + x) * 4;
      data[idx] = Math.max(0, Math.min(255, Math.round(r)));
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(g)));
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(b)));
    }
  }
}

/**
 * Adaptive contrast enhancement using CLAHE (simplified version)
 */
function applyAdaptiveContrastEnhancement(data: Uint8ClampedArray, width: number, height: number) {
  const blockSize = 64; // Size of each block for adaptive processing
  
  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      const endY = Math.min(by + blockSize, height);
      const endX = Math.min(bx + blockSize, width);
      
      // Calculate histogram for this block
      const histogram = new Array(256).fill(0);
      let totalPixels = 0;
      
      for (let y = by; y < endY; y++) {
        for (let x = bx; x < endX; x++) {
          const idx = (y * width + x) * 4;
          const gray = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
          histogram[gray]++;
          totalPixels++;
        }
      }
      
      // Calculate cumulative distribution
      const cdf = new Array(256);
      cdf[0] = histogram[0];
      for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i];
      }
      
      // Normalize CDF
      for (let i = 0; i < 256; i++) {
        cdf[i] = Math.round((cdf[i] / totalPixels) * 255);
      }
      
      // Apply histogram equalization to this block
      for (let y = by; y < endY; y++) {
        for (let x = bx; x < endX; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          
          const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          const enhanced = cdf[gray];
          
          // Apply enhancement while preserving color ratios
          const factor = enhanced / Math.max(1, gray);
          data[idx] = Math.max(0, Math.min(255, Math.round(r * factor)));
          data[idx + 1] = Math.max(0, Math.min(255, Math.round(g * factor)));
          data[idx + 2] = Math.max(0, Math.min(255, Math.round(b * factor)));
        }
      }
    }
  }
}

/**
 * Adaptive thresholding for better text contrast
 */
function applyAdaptiveThresholding(data: Uint8ClampedArray, width: number, height: number) {
  const blockSize = 16;
  const C = 5; // Constant subtracted from mean
  
  const original = new Uint8ClampedArray(data);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      
      // Calculate local mean in neighborhood
      let sum = 0;
      let count = 0;
      
      for (let dy = -blockSize; dy <= blockSize; dy++) {
        for (let dx = -blockSize; dx <= blockSize; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const nIdx = (ny * width + nx) * 4;
            const gray = 0.299 * original[nIdx] + 0.587 * original[nIdx + 1] + 0.114 * original[nIdx + 2];
            sum += gray;
            count++;
          }
        }
      }
      
      const localMean = sum / count;
      const currentGray = 0.299 * original[idx] + 0.587 * original[idx + 1] + 0.114 * original[idx + 2];
      
      // Apply adaptive threshold
      const threshold = localMean - C;
      const binaryValue = currentGray > threshold ? 255 : 0;
      
      // For OCR, we want to preserve some grayscale information
      // So we blend the binary result with enhanced contrast
      const enhancedGray = currentGray > threshold ? 
        Math.min(255, currentGray * 1.2) : 
        Math.max(0, currentGray * 0.8);
      
      data[idx] = Math.round(enhancedGray);
      data[idx + 1] = Math.round(enhancedGray);
      data[idx + 2] = Math.round(enhancedGray);
    }
  }
}

/**
 * Create Gaussian kernel for blur operations
 */
function createGaussianKernel(sigma: number): number[] {
  const size = Math.ceil(sigma * 3) * 2 + 1;
  const kernel = new Array(size);
  const center = Math.floor(size / 2);
  let sum = 0;
  
  for (let i = 0; i < size; i++) {
    const x = i - center;
    kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
    sum += kernel[i];
  }
  
  // Normalize
  for (let i = 0; i < size; i++) {
    kernel[i] /= sum;
  }
  
  return kernel;
}

/**
 * Get optimal DPI-based scaling factor
 */
export function getOptimalScale(originalWidth: number, originalHeight: number): number {
  // Target resolution for OCR (around 300 DPI equivalent)
  const targetPixelDensity = 300;
  const currentDensity = Math.sqrt(originalWidth * originalHeight) / 8.5; // Assume 8.5 inch diagonal
  
  const scale = Math.min(4, Math.max(1, targetPixelDensity / currentDensity));
  return Math.round(scale * 10) / 10; // Round to 1 decimal place
}

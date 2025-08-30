/**
 * Enhanced Tesseract OCR Configuration
 * Optimized settings for different types of text recognition
 */

import Tesseract from 'tesseract.js';

export interface OCRConfig {
  // Page segmentation mode
  tessedit_pageseg_mode: Tesseract.PSM;
  
  // OCR engine mode
  tessedit_ocr_engine_mode: Tesseract.OEM;
  
  // Character blacklist (characters to ignore)
  tessedit_char_blacklist: string;
  
  // Character whitelist (only allow these characters)
  tessedit_char_whitelist?: string;
  
  // Preserve spaces between words
  preserve_interword_spaces: string;
  
  // Additional quality settings
  [key: string]: any;
}

/**
 * High-quality OCR configuration for general documents
 */
export const HIGH_QUALITY_CONFIG: OCRConfig = {
  tessedit_pageseg_mode: Tesseract.PSM.AUTO,
  tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
  tessedit_char_blacklist: '',
  preserve_interword_spaces: '1',
  
  // Advanced quality settings
  tessedit_do_invert: '0',           // Don't invert image
  tessedit_create_hocr: '0',         // Don't create HOCR output (faster)
  tessedit_create_tsv: '0',          // Don't create TSV output (faster)
  tessedit_write_images: '0',        // Don't write debug images
  
  // Language model settings
  load_system_dawg: '1',             // Load system dictionary
  load_freq_dawg: '1',               // Load frequent words dictionary
  load_unambig_dawg: '1',            // Load unambiguous words dictionary
  load_punc_dawg: '1',               // Load punctuation patterns
  load_number_dawg: '1',             // Load number patterns
  load_bigram_dawg: '1',             // Load bigram patterns
  
  // Character recognition settings
  classify_enable_learning: '1',      // Enable adaptive learning
  classify_enable_adaptive_matcher: '1', // Enable adaptive matching
  textord_heavy_nr: '1',             // Heavy noise reduction
  
  // Segmentation improvements
  textord_noise_sizefraction: '0.5', // Noise size threshold
  textord_noise_translimit: '16.0',  // Noise translation limit
  textord_noise_normratio: '2.0',    // Noise normalization ratio
  
  // For better handling of small text
  textord_min_xheight: '10',         // Minimum character height
  textord_noise_rejwords: '1',       // Reject noisy words
  textord_noise_rejrows: '1',        // Reject noisy rows
};

/**
 * Configuration optimized for small or faded text
 */
export const SMALL_TEXT_CONFIG: OCRConfig = {
  ...HIGH_QUALITY_CONFIG,
  tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
  
  // More aggressive settings for small text
  textord_min_xheight: '6',          // Lower minimum height
  textord_noise_sizefraction: '0.3', // More sensitive to small features
  classify_adapt_proto_threshold: '230', // Lower adaptation threshold
  classify_adapt_feature_threshold: '230', // Lower feature threshold
  
  // Enhanced edge detection
  edges_use_new_outline_complexity: '1',
  edges_debug: '0',
  
  // Better word recognition for small text
  wordrec_enable_assoc: '1',         // Enable word association
  wordrec_worst_state: '1',          // Use worst state for word recognition
};

/**
 * Configuration for single-line text (like titles or labels)
 */
export const SINGLE_LINE_CONFIG: OCRConfig = {
  ...HIGH_QUALITY_CONFIG,
  tessedit_pageseg_mode: Tesseract.PSM.SINGLE_TEXT_LINE,
  
  // Optimize for single line
  textord_heavy_nr: '0',             // Disable heavy noise reduction
  textord_noise_rejrows: '0',        // Don't reject rows
  preserve_interword_spaces: '1',    // Important for single lines
};

/**
 * Configuration for documents with multiple columns
 */
export const MULTI_COLUMN_CONFIG: OCRConfig = {
  ...HIGH_QUALITY_CONFIG,
  tessedit_pageseg_mode: Tesseract.PSM.SINGLE_COLUMN,
  
  // Better column detection
  textord_tabfind_show_vlines: '0',
  textord_tabfind_show_initial_partitions: '0',
  textord_use_cjk_fp_model: '0',
};

/**
 * Configuration for handwritten or cursive text
 */
export const HANDWRITING_CONFIG: OCRConfig = {
  ...HIGH_QUALITY_CONFIG,
  tessedit_ocr_engine_mode: Tesseract.OEM.DEFAULT, // Use both engines
  
  // More flexible recognition
  classify_adapt_proto_threshold: '200',
  classify_adapt_feature_threshold: '200',
  wordrec_enable_assoc: '1',
  
  // Allow more character variations
  classify_class_pruner_threshold: '200',
  classify_class_pruner_multiplier: '15',
};

/**
 * Get optimal configuration based on image characteristics
 */
export function getOptimalConfig(
  imageWidth: number,
  imageHeight: number,
  estimatedTextSize: 'small' | 'medium' | 'large' = 'medium',
  textType: 'paragraph' | 'single_line' | 'multi_column' | 'handwriting' = 'paragraph'
): OCRConfig {
  // Base configuration selection
  let config: OCRConfig;
  
  switch (textType) {
    case 'single_line':
      config = SINGLE_LINE_CONFIG;
      break;
    case 'multi_column':
      config = MULTI_COLUMN_CONFIG;
      break;
    case 'handwriting':
      config = HANDWRITING_CONFIG;
      break;
    default:
      config = estimatedTextSize === 'small' ? SMALL_TEXT_CONFIG : HIGH_QUALITY_CONFIG;
  }
  
  // Adjust based on image size
  const pixelCount = imageWidth * imageHeight;
  const isHighRes = pixelCount > 2000000; // 2MP+
  const isLowRes = pixelCount < 500000;   // 0.5MP-
  
  if (isHighRes) {
    // High resolution images - can be more aggressive
    return {
      ...config,
      textord_noise_sizefraction: '0.4',
      textord_min_xheight: '8',
    };
  } else if (isLowRes) {
    // Low resolution images - be more conservative
    return {
      ...config,
      textord_noise_sizefraction: '0.8',
      textord_min_xheight: '12',
      textord_heavy_nr: '0', // Disable heavy noise reduction for low-res
    };
  }
  
  return config;
}

/**
 * Apply configuration with logging
 */
export function applyConfigWithLogging(config: OCRConfig, context: string): OCRConfig {
  console.log(`Applying OCR configuration for ${context}:`, {
    pageSegMode: config.tessedit_pageseg_mode,
    engineMode: config.tessedit_ocr_engine_mode,
    minHeight: config.textord_min_xheight,
    noiseSizeFraction: config.textord_noise_sizefraction
  });
  
  return config;
}

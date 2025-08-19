export type RegionType = "paragraph" | "table" | "image" | "heading";

export interface OCRRegion {
  id: string;
  page: number;
  type: RegionType;
  bbox: { x: number; y: number; width: number; height: number }; // in canvas pixels of rendered page
  text?: string;
  confidence?: number;
}

export interface QueryAnswer {
  id: string;
  question: string;
  answer: string;
  sourceRegions: string[]; // region ids
  createdAt: number;
  answerSpan?: { start: number; end: number }; // character offsets in the corpus
}


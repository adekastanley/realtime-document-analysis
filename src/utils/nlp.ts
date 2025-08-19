// Configure transformers.js to prefer locally hosted models if present
// Place models under /public/models/transformers/{task}/... and set allowLocalModels
async function configureTransformers() {
  if (typeof window === "undefined") return null;
  
  const { pipeline, env } = await import("@xenova/transformers");
  
  // @ts-ignore - env properties exist at runtime
  env.allowLocalModels = true;
  // @ts-ignore
  env.localModelPath = "/models"; // served from /public/models
  // Enable WASM backends where available
  // @ts-ignore
  env.backends.onnx.wasm.wasmPaths = "/models/onnx-runtime-wasm"; // optional if hosting ORT wasm
  
  return { pipeline, env };
}

let qaPipePromise: Promise<any> | null = null;
let nerPipePromise: Promise<any> | null = null;

export async function loadQAPipeline() {
  if (!qaPipePromise) {
    const transformers = await configureTransformers();
    if (!transformers) throw new Error('Transformers not available in SSR');
    
    // Try a small quantized QA model. When hosting locally, map model id to local folder path
    // e.g., place at /public/models/Xenova/distilbert-base-cased-distilled-squad
    qaPipePromise = transformers.pipeline("question-answering", "Xenova/distilbert-base-cased-distilled-squad", {
      quantized: true,
    });
  }
  return qaPipePromise;
}

export async function loadNERPipeline() {
  if (!nerPipePromise) {
    const transformers = await configureTransformers();
    if (!transformers) throw new Error('Transformers not available in SSR');
    
    nerPipePromise = transformers.pipeline("token-classification", "Xenova/bert-base-multilingual-cased-ner-hrl", {
      quantized: true,
    });
  }
  return nerPipePromise;
}

export async function answerQuestion(context: string, question: string) {
  const qa = await loadQAPipeline();
  const res = await qa({ question, context });
  // Standardize output
  // transformers.js can return single object or array depending on model
  const best = Array.isArray(res) ? res[0] : res;
  return {
    answer: best?.answer ?? "",
    score: best?.score ?? 0,
    start: best?.start ?? 0,
    end: best?.end ?? 0,
  };
}

export async function extractEntities(text: string) {
  const ner = await loadNERPipeline();
  const res = await ner(text, { aggregation_strategy: "simple" });
  return res as Array<{ entity_group: string; word: string; score: number; start: number; end: number }>;
}


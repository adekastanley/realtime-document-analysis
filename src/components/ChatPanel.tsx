"use client";

import { useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { OCRRegion, QueryAnswer } from "@/utils/types";
import { answerQuestion } from "@/utils/nlp";

export function ChatPanel({ ocrText }: { ocrText: OCRRegion[] }) {
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<QueryAnswer[]>([]);
  const [loading, setLoading] = useState(false);

  const corpus = useMemo(() => {
    const text = ocrText.map((r) => r.text).filter(Boolean).join("\n\n");
    console.log(`ChatPanel: Corpus created with ${text.length} characters from ${ocrText.length} regions`);
    console.log('First 200 chars:', text.slice(0, 200));
    return text;
  }, [ocrText]);
  
  const offline = typeof navigator !== "undefined" ? !navigator.onLine : true;

  async function runLocalQA(q: string) {
    console.log(`Running QA with question: "${q}"`);
    console.log(`Corpus length: ${corpus.length}`);
    
    if (corpus.length === 0) {
      return { 
        answer: "No text has been extracted yet. Please extract text from the document first using 'Smart Extract' or 'Full Page OCR'.",
        sourceRegions: []
      };
    }

    try {
      console.log('Attempting NLP-based QA...');
      const res = await answerQuestion(corpus, q);
      console.log('NLP QA result:', res);
      
      return { 
        answer: res.answer || "(no answer found)", 
        sourceRegions: ocrText.slice(0, 3).map((r) => r.id),
        answerSpan: res.start !== undefined && res.end !== undefined ? { start: res.start, end: res.end } : undefined
      };
    } catch (e) {
      console.error('NLP QA failed, falling back to simple search:', e);
      
      // Simple fallback: search for keywords in the text
      const lowerQ = q.toLowerCase();
      const lowerCorpus = corpus.toLowerCase();
      
      let answer = "I couldn't find a specific answer, but here's what I can tell you:\n\n";
      
      // Simple document type detection
      if (lowerQ.includes('what type') || lowerQ.includes('document type')) {
        if (lowerCorpus.includes('resume') || lowerCorpus.includes('cv') || lowerCorpus.includes('experience') || lowerCorpus.includes('education')) {
          answer += "This appears to be a resume or CV.";
        } else if (lowerCorpus.includes('invoice') || lowerCorpus.includes('bill') || lowerCorpus.includes('payment')) {
          answer += "This appears to be an invoice or billing document.";
        } else {
          answer += "I can see this is a text document, but I'm not sure of the specific type.";
        }
      }
      
      // Phone number search
      else if (lowerQ.includes('phone') || lowerQ.includes('number')) {
        const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
        const phones = corpus.match(phoneRegex);
        if (phones && phones.length > 0) {
          answer += `I found these phone numbers: ${phones.join(', ')}`;
        } else {
          answer += "I didn't find any phone numbers in this document.";
        }
      }
      
      // Email search  
      else if (lowerQ.includes('email')) {
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const emails = corpus.match(emailRegex);
        if (emails && emails.length > 0) {
          answer += `I found these email addresses: ${emails.join(', ')}`;
        } else {
          answer += "I didn't find any email addresses in this document.";
        }
      }
      
      // General search
      else {
        const words = lowerQ.split(' ').filter(w => w.length > 2);
        const foundWords = words.filter(w => lowerCorpus.includes(w));
        
        if (foundWords.length > 0) {
          answer += `I found these related terms: ${foundWords.join(', ')}\n\n`;
          // Find sentences containing the words
          const sentences = corpus.split(/[.!?]+/).filter(s => 
            foundWords.some(w => s.toLowerCase().includes(w))
          ).slice(0, 3);
          if (sentences.length > 0) {
            answer += "Relevant text:\n" + sentences.join('.\n');
          }
        } else {
          answer += "I couldn't find information related to your question in this document.";
        }
      }
      
      return { answer, sourceRegions: ocrText.slice(0, 3).map((r) => r.id) };
    }
  }

  async function onAsk() {
    if (!question.trim()) return;
    setLoading(true);
    try {
      let result: { answer: string; sourceRegions: string[]; answerSpan?: { start: number; end: number } };
      if (offline) {
        result = await runLocalQA(question);
      } else {
        // Fallback to API if online and env present; kept client-only compatible (no secrets consumed here)
        result = await runLocalQA(question);
      }
      const qa: QueryAnswer = {
        id: crypto.randomUUID(),
        question,
        answer: result.answer,
        sourceRegions: result.sourceRegions,
        answerSpan: result.answerSpan,
        createdAt: Date.now(),
      };
      setAnswers((prev) => [qa, ...prev]);
      setQuestion("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-3 py-2 border-b">
        <div className="text-sm font-medium">Query</div>
        <div className="text-xs text-muted-foreground">
          {corpus.length > 0 ? `${corpus.length} characters extracted` : 'No text extracted yet'}
        </div>
      </div>
      <div className="p-3 space-y-2">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about this document..."
          className="min-h-[88px]"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={onAsk} disabled={loading}>
            {loading ? "Thinking..." : "Ask"}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-3 pb-3 space-y-3">
        {answers.map((a) => (
          <div key={a.id} className="border rounded p-2 text-sm">
            <div className="text-xs text-muted-foreground">Q: {a.question}</div>
            <div className="mt-1 whitespace-pre-wrap">{a.answer}</div>
            {a.answerSpan && (
              <div className="text-xs text-muted-foreground mt-1">
                Source: chars {a.answerSpan.start}-{a.answerSpan.end} in document
              </div>
            )}
          </div>
        ))}
        {answers.length === 0 && (
          <div className="text-xs text-muted-foreground">No queries yet.</div>
        )}
      </div>
    </div>
  );
}


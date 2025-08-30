"use client";

import { useMemo, useState } from "react";
import { DocumentUploader } from "@/components/DocumentUploader";
import { DragDropUploader } from "@/components/DragDropUploader";
import { PdfViewer } from "@/components/PdfViewer";
import { ImageViewer } from "@/components/ImageViewer";
import { ResultsPanel } from "@/components/ResultsPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { StatusIndicator } from "@/components/StatusIndicator";
import { Separator } from "@/components/ui/separator";
import type { OCRRegion } from "@/utils/types";
import { isPdf } from "@/utils/file";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [regions, setRegions] = useState<OCRRegion[]>([]);
  const [extractedText, setExtractedText] = useState<Record<number, OCRRegion[]>>({});

  const onUpload = (f: File | null) => {
    setFile(f);
    setPageIndex(0);
    setRegions([]);
    setExtractedText({});
  };

  const allText = useMemo(() => Object.values(extractedText).flat(), [extractedText]);

  return (
    <main className="flex h-[100dvh] flex-col">
      <header className="flex items-center justify-between px-4 py-2 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">Real-time Document Analyzer</h1>
          <StatusIndicator />
        </div>
        <DocumentUploader onUpload={onUpload} />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <section className="flex-[2] min-w-0 border-r">
          {file && isPdf(file) ? (
            <PdfViewer
              file={file}
              pageIndex={pageIndex}
              onPageChange={setPageIndex}
              regions={regions}
              onRegionsChange={setRegions}
              onExtracted={(page, regs) =>
                setExtractedText((prev) => ({ ...prev, [page]: regs }))
              }
            />
          ) : file ? (
            <ImageViewer
              file={file}
              regions={regions}
              onRegionsChange={setRegions}
              onExtracted={(page, regs) =>
                setExtractedText((prev) => ({ ...prev, [page]: regs }))
              }
            />
          ) : (
            <div className="h-full flex items-center justify-center p-8">
              <DragDropUploader 
                onFileSelect={onUpload}
                className="w-full max-w-md"
              >
                <div className="flex flex-col items-center justify-center space-y-4">
                  <svg
                    className="w-16 h-16 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <div className="text-center">
                    <p className="text-lg font-medium text-gray-700">
                      Drop files here or click to browse
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Supports PDF, PNG, JPG, JPEG, TIFF, BMP, WebP
                    </p>
                  </div>
                </div>
              </DragDropUploader>
            </div>
          )}
        </section>
        <section className="flex w-[480px] min-w-[360px] max-w-[50vw] flex-col">
          <div className="flex-1 overflow-auto">
            <ResultsPanel
              pageIndex={pageIndex}
              extractedByPage={extractedText}
              onExport={() => {
                const blob = new Blob([JSON.stringify(extractedText, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "ocr_results.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            />
          </div>
          <Separator />
          <div className="h-[45%] min-h-[280px]">
            <ChatPanel ocrText={allText} />
          </div>
        </section>
      </div>
    </main>
  );
}

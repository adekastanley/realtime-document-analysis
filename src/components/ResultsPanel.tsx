"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { OCRRegion } from "@/utils/types";
import { Button } from "@/components/ui/button";
import { exportTxt, exportCsv } from "@/utils/exporters";

export function ResultsPanel({
  pageIndex,
  extractedByPage,
  onExport,
}: {
  pageIndex: number;
  extractedByPage: Record<number, OCRRegion[]>;
  onExport: () => void;
}) {
  const regions = extractedByPage[pageIndex] || [];
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h2 className="text-sm font-medium">Extracted Text</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={onExport}>
            JSON
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportTxt(extractedByPage)}>
            TXT
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportCsv(extractedByPage)}>
            CSV
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1 px-3 py-2">
        {regions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No OCR yet.</p>
        ) : (
          <ul className="space-y-3">
            {regions.map((r) => (
              <li key={r.id} className="text-sm">
                <div className="text-[10px] text-muted-foreground uppercase">{r.type}</div>
                <div className="whitespace-pre-wrap">{r.text || "(empty)"}</div>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}


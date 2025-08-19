"use client";

import { ChangeEvent } from "react";
import { Button } from "@/components/ui/button";

export function DocumentUploader({
  onUpload,
}: {
  onUpload: (file: File | null) => void;
}) {
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    onUpload(f);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        id="doc-file"
        type="file"
        accept="application/pdf,image/*"
        className="hidden"
        onChange={onChange}
      />
      <label htmlFor="doc-file">
        <Button asChild variant="default">
          <span>Upload PDF/Image</span>
        </Button>
      </label>
      <Button variant="ghost" onClick={() => onUpload(null)}>
        Clear
      </Button>
    </div>
  );
}


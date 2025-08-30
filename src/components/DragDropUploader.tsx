"use client";

import { useCallback, useState } from "react";

interface DragDropUploaderProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  className?: string;
  children?: React.ReactNode;
}

export function DragDropUploader({ 
  onFileSelect, 
  accept = ".pdf,.png,.jpg,.jpeg,.tiff,.bmp,.webp",
  className = "",
  children
}: DragDropUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      
      // Check file type
      const acceptedTypes = accept.split(',').map(type => type.trim());
      const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
      const fileType = file.type;
      
      const isAccepted = acceptedTypes.some(acceptType => {
        if (acceptType.startsWith('.')) {
          return fileExtension === acceptType;
        } else {
          return fileType.startsWith(acceptType.replace('*', ''));
        }
      });

      if (isAccepted) {
        onFileSelect(file);
      } else {
        alert(`File type not supported. Please upload: ${accept}`);
      }
    }
  }, [accept, onFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onFileSelect(files[0]);
    }
    // Reset input to allow selecting the same file again
    e.target.value = '';
  }, [onFileSelect]);

  const handleClick = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => handleFileInput(e as any);
    input.click();
  }, [accept, handleFileInput]);

  return (
    <div
      className={`
        relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
        ${isDragOver 
          ? 'border-blue-400 bg-blue-50' 
          : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }
        ${className}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      {children || (
        <>
          <div className="flex flex-col items-center justify-center space-y-4">
            <svg
              className={`w-12 h-12 ${isDragOver ? 'text-blue-400' : 'text-gray-400'}`}
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
            <div>
              <p className={`text-lg font-medium ${isDragOver ? 'text-blue-600' : 'text-gray-700'}`}>
                {isDragOver ? 'Drop your file here' : 'Drop files here or click to browse'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Supports: PDF, PNG, JPG, JPEG, TIFF, BMP, WebP
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, X, File as FileIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFileAccepted: (file: File) => void;
  accept: Record<string, string[]>;
  maxSize?: number; // in bytes
  label: string;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onFileAccepted, accept, maxSize = 50 * 1024 * 1024, label }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null); // Can be used for actual uploads
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    setError(null);
    setFile(null);
    setUploadProgress(null);

    if (fileRejections.length > 0) {
      setError(fileRejections[0].errors[0].message);
      return;
    }

    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0];
      setFile(selectedFile);
      // Simulate progress for demo purposes; replace with actual upload logic if needed
      setUploadProgress(0);
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          setUploadProgress(100); // Ensure it reaches 100
          // Delay slightly before calling onFileAccepted to show completion
          setTimeout(() => onFileAccepted(selectedFile), 300);
        }
      }, 50);
    }
  }, [onFileAccepted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    multiple: false,
  });

  const removeFile = () => {
    setFile(null);
    setUploadProgress(null);
    setError(null);
    // Reset input value to allow re-uploading the same file
    const input = document.getElementById('file-input') as HTMLInputElement | null;
    if (input) input.value = '';
  };

  const formatBytes = (bytes: number, decimals = 2) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  return (
    <div className="w-full">
      {!file ? (
        <div
          {...getRootProps()}
          className={cn(
            'border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors duration-200 ease-in-out',
            isDragActive ? 'border-primary bg-secondary/20' : 'bg-card'
          )}
        >
          <input {...getInputProps()} id="file-input" />
          <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          {isDragActive ? (
            <p className="text-primary font-semibold">Drop the file here ...</p>
          ) : (
            <p className="text-muted-foreground">
              {label}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">Max file size: {formatBytes(maxSize)}</p>
          {error && <p className="text-destructive text-sm mt-2">{error}</p>}
           <Button variant="outline" size="sm" className="mt-4">
             Or Select File
           </Button>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-card flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <FileIcon className="h-6 w-6 text-primary flex-shrink-0" />
            <div className="flex flex-col overflow-hidden">
               <span className="text-sm font-medium truncate" title={file.name}>{file.name}</span>
               <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
             {uploadProgress !== null && uploadProgress < 100 && (
               <Progress value={uploadProgress} className="w-20 h-2" />
             )}
             {uploadProgress === 100 && (
                <span className="text-xs text-green-600">Ready</span>
              )}
             <Button variant="ghost" size="icon" onClick={removeFile} className="h-8 w-8">
               <X className="h-4 w-4" />
               <span className="sr-only">Remove file</span>
             </Button>
           </div>

        </div>
      )}
    </div>
  );
};

export default FileUploader;


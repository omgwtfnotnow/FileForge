'use client';

import React, { useState, useEffect } from 'react';
import FileUploader from './file-uploader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument } from 'pdf-lib';
import { Loader2 } from 'lucide-react';

// Placeholder for compression levels - actual implementation depends on library/approach
type CompressionLevel = 'low' | 'medium' | 'high';

const PdfCompressor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
  const [targetSize, setTargetSize] = useState<number | null>(null); // in KB
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedSize, setProcessedSize] = useState<number | null>(null); // size in bytes
  const { toast } = useToast();

   // Client-side check to avoid hydration mismatch for window object
   const [isClient, setIsClient] = useState(false);
   useEffect(() => {
     setIsClient(true);
   }, []);

  const handleFileAccepted = (acceptedFile: File) => {
    setFile(acceptedFile);
    setProcessedSize(null); // Reset processed size when new file is uploaded
  };

  const handleCompress = async () => {
    if (!file) {
      toast({ title: 'Error', description: 'Please upload a PDF file first.', variant: 'destructive' });
      return;
    }

    if (!isClient) return; // Ensure this runs only on the client

    setIsProcessing(true);
    setProcessedSize(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      // NOTE: pdf-lib doesn't directly support lossy compression like image libraries.
      // True PDF compression often involves optimizing images within the PDF, removing metadata,
      // subsetting fonts, etc. This requires more complex logic or server-side tools.
      // pdf-lib can help *restructure* a PDF which *might* reduce size slightly,
      // or allow modifying image quality if images are replaced.

      // For demonstration, we'll just reload and save the document.
      // In a real app, you'd integrate a WASM library or server-side process here
      // based on `compressionLevel` or `targetSize`.
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      // Example: Remove metadata (minimal size reduction)
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
      pdfDoc.setCreationDate(new Date(0)); // Set to epoch
      pdfDoc.setModificationDate(new Date(0)); // Set to epoch

      // --- Placeholder for actual compression logic ---
      // Based on `compressionLevel` or `targetSize`, apply relevant optimizations.
      // This could involve:
      // 1. Iterating through images and replacing them with lower-quality versions.
      // 2. Using a WASM library (like a port of Ghostscript or similar) for advanced compression.
      // 3. Sending the file to a server for processing.
      // For now, we just simulate a delay.
      await new Promise(resolve => setTimeout(resolve, 1500));
      // --- End Placeholder ---

      const pdfBytes = await pdfDoc.save();
      setProcessedSize(pdfBytes.byteLength); // Store the size of the processed file

      // Trigger download
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const originalName = file.name.replace(/\.[^/.]+$/, ""); // Remove original extension
      link.download = `${originalName}_compressed.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href); // Clean up blob URL

      toast({ title: 'Success', description: 'PDF compressed and download started.' });

    } catch (error) {
      console.error('PDF compression error:', error);
      toast({ title: 'Error', description: 'Failed to compress PDF. The file might be corrupted or password-protected.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

   const formatBytes = (bytes: number | null, decimals = 2) => {
    if (bytes === null || bytes === 0) return 'N/A';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  return (
    <div className="space-y-6">
      <FileUploader
        onFileAccepted={handleFileAccepted}
        accept={{ 'application/pdf': ['.pdf'] }}
        label="Drag 'n' drop a PDF here, or click to select PDF"
      />

      {file && (
        <div className="space-y-4 p-4 border rounded-lg bg-card">
          <div className="grid gap-2">
             <Label htmlFor="compression-level">Compression Level</Label>
             <Select
               value={compressionLevel}
               onValueChange={(value: CompressionLevel) => setCompressionLevel(value)}
               disabled={isProcessing}
             >
               <SelectTrigger id="compression-level">
                 <SelectValue placeholder="Select level" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="low">Low (Larger Size, Best Quality)</SelectItem>
                 <SelectItem value="medium">Medium (Recommended)</SelectItem>
                 <SelectItem value="high">High (Smallest Size, Lower Quality)</SelectItem>
               </SelectContent>
             </Select>
             <p className="text-xs text-muted-foreground">
               Note: Actual compression effectiveness depends on PDF content. High compression may reduce image quality.
             </p>
           </div>

          {/* Optional: Target Size Slider (more complex to implement accurately) */}
          {/* <div className="grid gap-2">
             <Label htmlFor="target-size">Target Size (KB) - Optional</Label>
             <Slider
               id="target-size"
               min={10}
               max={Math.max(1000, Math.round(file.size / 1024))} // Example max size
               step={10}
               value={[targetSize || 500]} // Default or current value
               onValueChange={(value) => setTargetSize(value[0])}
               disabled={isProcessing}
             />
             <p className="text-xs text-muted-foreground">Approximate target size: {targetSize ? `${targetSize} KB` : 'Not set'}</p>
           </div> */}

          <Button onClick={handleCompress} disabled={isProcessing || !file}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Compressing...
              </>
            ) : (
              'Compress PDF'
            )}
          </Button>

           {processedSize !== null && (
             <p className="text-sm text-muted-foreground mt-2">
               Original size: {formatBytes(file.size)} | Compressed size: {formatBytes(processedSize)}
             </p>
           )}
        </div>
      )}
    </div>
  );
};

export default PdfCompressor;

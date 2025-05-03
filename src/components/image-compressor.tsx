'use client';

import React, { useState, useEffect } from 'react';
import FileUploader from './file-uploader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import imageCompression from 'browser-image-compression';
import { Loader2 } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type CompressionMode = 'quality' | 'size';

const ImageCompressor: React.FC = () => {
  const [originalFile, setOriginalFile] = useState<File | null>(null); // Keep track of the originally uploaded file
  const [fileToCompress, setFileToCompress] = useState<File | null>(null); // This might be the original or a converted file
  const [compressionMode, setCompressionMode] = useState<CompressionMode>('quality');
  const [quality, setQuality] = useState<number>(80); // Quality 0-100 (maps to 0-1)
  const [targetSize, setTargetSize] = useState<number | ''>(''); // Target size in KB
  const [isProcessing, setIsProcessing] = useState(false);
  const [originalSize, setOriginalSize] = useState<number | null>(null);
  const [compressedSize, setCompressedSize] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // For image preview
  const { toast } = useToast();

  // Client-side check
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

   // Create preview URL when file changes and handle potential HEIC conversion
   useEffect(() => {
     let objectUrl: string | null = null;

     const setupFile = async (inputFile: File) => {
       if (!isClient) return;

       setOriginalSize(inputFile.size);
       setCompressedSize(null); // Reset compressed size

       // Check if it's HEIC/HEIF and needs conversion before compression
       const isHeic = inputFile.type === 'image/heic' || inputFile.type === 'image/heif' || inputFile.name.toLowerCase().endsWith('.heic') || inputFile.name.toLowerCase().endsWith('.heif');

       let displayFile = inputFile; // File to be used for preview and potential compression

       if (isHeic) {
         toast({ title: 'HEIC/HEIF Detected', description: 'Attempting to convert to PNG for preview/compression. Browser support may vary.', variant: 'default' });
         try {
           // Attempt conversion to PNG using canvas method for compatibility with compression library
           const imageBitmap = await createImageBitmap(inputFile);
           const canvas = document.createElement('canvas');
           canvas.width = imageBitmap.width;
           canvas.height = imageBitmap.height;
           const ctx = canvas.getContext('2d');
           if (!ctx) throw new Error('Canvas context failed');
           ctx.drawImage(imageBitmap, 0, 0);
           imageBitmap.close();

           const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
           if (!blob) throw new Error('Canvas to Blob failed');

           // Create a new File object from the Blob
           displayFile = new File([blob], inputFile.name.replace(/\.[^/.]+$/, '.png'), { type: 'image/png' });
           setFileToCompress(displayFile); // Use the converted PNG for compression
           toast({ title: 'Conversion Success', description: 'HEIC converted to PNG for processing.', variant: 'default' });

         } catch (error) {
           console.error("HEIC conversion error:", error);
           toast({ title: 'HEIC Conversion Failed', description: 'Could not convert HEIC. Compression might fail or be inaccurate. Try converting externally first.', variant: 'destructive' });
           setFileToCompress(inputFile); // Fallback to original if conversion fails
           displayFile = inputFile; // Still try to preview original
         }
       } else {
         setFileToCompress(inputFile); // Use original file directly
       }

       // Create preview URL from the file we intend to display/compress
       objectUrl = URL.createObjectURL(displayFile);
       setPreviewUrl(objectUrl);
     };

     if (originalFile && isClient) {
       setupFile(originalFile);
     } else {
       setPreviewUrl(null);
       setOriginalSize(null);
       setCompressedSize(null);
       setFileToCompress(null);
     }

     // Cleanup function to revoke the object URL
     return () => {
       if (objectUrl) {
         URL.revokeObjectURL(objectUrl);
       }
     };
   }, [originalFile, isClient, toast]); // Depend on originalFile


  const handleFileAccepted = (acceptedFile: File) => {
    setOriginalFile(acceptedFile); // Set the original file first
    // The useEffect hook will handle setting fileToCompress and previewUrl
  };

  const handleCompress = async () => {
    // Use fileToCompress for the actual compression
    if (!fileToCompress) {
      toast({ title: 'Error', description: 'Please upload an image file first.', variant: 'destructive' });
      return;
    }
    if (!isClient) return;

    setIsProcessing(true);
    setCompressedSize(null);

    const options: imageCompression.Options = {
      maxSizeMB: undefined, // We control size via quality or maxSizeKB
      // maxWidthOrHeight: 1920, // Optional: Max dimensions
      useWebWorker: true,
      // signal: AbortSignal, // Optional: for aborting compression
      // onProgress: (progress) => {} // Optional: progress reporting
       // Ensure the library uses the file type of the potentially converted file
      fileType: fileToCompress.type,
    };

    if (compressionMode === 'quality') {
      options.initialQuality = quality / 100; // Convert 0-100 to 0-1
    } else if (compressionMode === 'size' && targetSize !== '') {
       // Convert KB to MB for the library
      options.maxSizeMB = targetSize / 1024;
      // You might also want to set a reasonable initialQuality even when targeting size
      options.initialQuality = 0.8; // Start with decent quality when targeting size
    } else if (compressionMode === 'size' && targetSize === '') {
        toast({ title: 'Error', description: 'Please enter a target size in KB.', variant: 'destructive' });
        setIsProcessing(false);
        return;
    }


    try {
      console.log(`Compressing with options:`, options, `on file type: ${fileToCompress.type}`);
      const compressedFile = await imageCompression(fileToCompress, options);
      setCompressedSize(compressedFile.size);

      // Trigger download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(compressedFile);
      // Use the *original* file name for the base, but the *compressed* file's extension
      const originalBaseName = originalFile?.name.replace(/\.[^/.]+$/, "") || 'image';
      const extension = compressedFile.type.split('/')[1] || 'jpg'; // Get extension from mime type
      link.download = `${originalBaseName}_compressed.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({ title: 'Success', description: 'Image compressed and download started.' });

    } catch (error) {
      console.error('Image compression error:', error);
       let description = 'Failed to compress image.';
       if (error instanceof Error && error.message.includes('target size is too small')) {
          description = 'Target size is too small for the image. Try a larger size or adjust quality.';
       } else if (error instanceof Error && error.message.includes('Image format is not supported')) {
           // This might happen if HEIC conversion failed and the library doesn't support HEIC directly
           description = 'Input image format may not be supported for compression (especially HEIC).';
       } else if (error instanceof Error) {
           description = `Compression failed: ${error.message}`; // Show specific error
       }
      toast({ title: 'Error', description, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

   const formatBytes = (bytes: number | null, decimals = 2) => {
      if (bytes === null || typeof bytes !== 'number' || isNaN(bytes)) return 'N/A'; // Check for NaN
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      // Prevent log(0) or log(negative) - should not happen with check above, but safe guard
      if (bytes <= 0) return 'N/A';
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      // Ensure i is within bounds of sizes array
      const index = Math.max(0, Math.min(i, sizes.length - 1));
      return parseFloat((bytes / Math.pow(k, index)).toFixed(dm)) + ' ' + sizes[index];
    }

  return (
    <div className="space-y-6">
      <FileUploader
        onFileAccepted={handleFileAccepted}
        accept={{
            'image/jpeg': ['.jpeg', '.jpg'],
            'image/png': ['.png'],
            'image/webp': ['.webp'],
            'image/heic': ['.heic'], // Add HEIC
            'image/heif': ['.heif'], // Add HEIF
            // Add other formats supported by browser-image-compression if needed
          }}
        label="Drag 'n' drop an image (JPG, PNG, WEBP, HEIC), or click to select"
      />

      {/* Use originalFile to determine if *any* file was uploaded */}
      {originalFile && (
        <div className="space-y-6 p-4 border rounded-lg bg-card">
         {previewUrl && (
           <div className="flex justify-center max-h-60 mb-4">
             {/* Use previewUrl which might be from the original or converted file */}
             <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-md" />
           </div>
         )}

          <RadioGroup defaultValue="quality" value={compressionMode} onValueChange={(value: CompressionMode) => setCompressionMode(value)} className="flex space-x-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="quality" id="r-quality" disabled={isProcessing}/>
              <Label htmlFor="r-quality">Compress by Quality</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="size" id="r-size" disabled={isProcessing}/>
              <Label htmlFor="r-size">Compress to Target Size</Label>
            </div>
          </RadioGroup>


          {compressionMode === 'quality' && (
             <div className="grid gap-2">
                <Label htmlFor="quality-slider">Quality ({quality}%)</Label>
                <Slider
                  id="quality-slider"
                  min={0}
                  max={100}
                  step={1}
                  value={[quality]}
                  onValueChange={(value) => setQuality(value[0])}
                  disabled={isProcessing}
                />
                <p className="text-xs text-muted-foreground">Lower quality means smaller file size.</p>
              </div>
           )}

           {compressionMode === 'size' && (
              <div className="grid gap-2">
                 <Label htmlFor="target-size">Target Size (KB)</Label>
                 <Input
                   id="target-size"
                   type="number"
                   min="1"
                   placeholder="e.g., 200"
                   value={targetSize}
                   onChange={(e) => setTargetSize(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                   disabled={isProcessing}
                   className="w-40"
                 />
                 <p className="text-xs text-muted-foreground">Enter the desired file size in kilobytes.</p>
               </div>
            )}


          {/* Disable button if fileToCompress isn't ready (e.g., during HEIC conversion) */}
          <Button onClick={handleCompress} disabled={isProcessing || !fileToCompress}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Compressing...
              </>
            ) : (
              'Compress Image'
            )}
          </Button>

           {/* Show sizes based on original upload and compressed result */}
           {(originalSize !== null || compressedSize !== null) && (
              <p className="text-sm text-muted-foreground mt-2">
                Original size: {formatBytes(originalSize)} | Compressed size: {formatBytes(compressedSize)}
                {originalSize && compressedSize && originalSize > compressedSize && (
                  <span className="text-green-600 ml-2">
                     ({(((originalSize - compressedSize) / originalSize) * 100).toFixed(1)}% reduction)
                   </span>
                )}
                 {originalSize && compressedSize && originalSize <= compressedSize && compressedSize > 0 && (
                   <span className="text-orange-600 ml-2">(No size reduction achieved)</span>
                 )}
              </p>
            )}

        </div>
      )}
    </div>
  );
};

export default ImageCompressor;

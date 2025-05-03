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
  const [file, setFile] = useState<File | null>(null);
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

   // Create preview URL when file changes
   useEffect(() => {
     if (file && isClient) {
       const url = URL.createObjectURL(file);
       setPreviewUrl(url);
       setOriginalSize(file.size);
       setCompressedSize(null); // Reset compressed size
       // Cleanup function to revoke the object URL
       return () => URL.revokeObjectURL(url);
     } else {
       setPreviewUrl(null);
       setOriginalSize(null);
       setCompressedSize(null);
     }
   }, [file, isClient]);


  const handleFileAccepted = (acceptedFile: File) => {
    setFile(acceptedFile);
  };

  const handleCompress = async () => {
    if (!file) {
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
      console.log(`Compressing with options:`, options);
      const compressedFile = await imageCompression(file, options);
      setCompressedSize(compressedFile.size);

      // Trigger download
      const link = document.createElement('a');
      link.href = URL.createObjectURL(compressedFile);
      const originalName = file.name.replace(/\.[^/.]+$/, "");
      const extension = compressedFile.type.split('/')[1] || 'jpg'; // Get extension from mime type
      link.download = `${originalName}_compressed.${extension}`;
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
          description = 'Input image format is not supported by the browser for compression.';
       }
      toast({ title: 'Error', description, variant: 'destructive' });
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
        accept={{ 'image/*': ['.jpeg', '.jpg', '.png', '.webp'] }} // Formats supported by browser-image-compression may vary
        label="Drag 'n' drop an image here, or click to select image"
      />

      {file && (
        <div className="space-y-6 p-4 border rounded-lg bg-card">
         {previewUrl && (
           <div className="flex justify-center max-h-60 mb-4">
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


          <Button onClick={handleCompress} disabled={isProcessing || !file}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Compressing...
              </>
            ) : (
              'Compress Image'
            )}
          </Button>

           {(originalSize !== null || compressedSize !== null) && (
              <p className="text-sm text-muted-foreground mt-2">
                Original size: {formatBytes(originalSize)} | Compressed size: {formatBytes(compressedSize)}
                {originalSize && compressedSize && originalSize > compressedSize && (
                  <span className="text-green-600 ml-2">
                     ({(((originalSize - compressedSize) / originalSize) * 100).toFixed(1)}% reduction)
                   </span>
                )}
                 {originalSize && compressedSize && originalSize <= compressedSize && (
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

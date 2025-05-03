'use client';

import React, { useState, useEffect } from 'react';
import FileUploader from './file-uploader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import imageCompression from 'browser-image-compression';
import { Loader2 } from 'lucide-react';

type OutputFormat = 'jpeg' | 'png' | 'webp';

const ImageConverter: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('jpeg');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Client-side check
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleFileAccepted = (acceptedFile: File) => {
    setFile(acceptedFile);
  };

  const handleConvert = async () => {
    if (!file) {
      toast({ title: 'Error', description: 'Please upload an image file first.', variant: 'destructive' });
      return;
    }
    if (!isClient) return;

    setIsProcessing(true);

    try {
      // browser-image-compression doesn't directly convert format in the way we might expect
      // (like preserving transparency when converting TO jpeg). It primarily compresses.
      // To truly convert format, we draw the image to a canvas and then export from the canvas.
      const imageBitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      ctx.drawImage(imageBitmap, 0, 0);

      // Determine the mime type for the target format
      let mimeType: string;
      let quality: number | undefined = undefined; // Quality only applies typically to JPEG and WEBP
      switch (outputFormat) {
        case 'png':
          mimeType = 'image/png';
          break;
        case 'webp':
          mimeType = 'image/webp';
          quality = 0.92; // Default quality for WebP
          break;
        case 'jpeg':
        default:
          mimeType = 'image/jpeg';
          quality = 0.92; // Default quality for JPEG
          // Fill background with white for JPEG if original was transparent PNG/WebP
          // Create a temporary canvas to draw the background
           const bgCanvas = document.createElement('canvas');
           bgCanvas.width = canvas.width;
           bgCanvas.height = canvas.height;
           const bgCtx = bgCanvas.getContext('2d');
           if (bgCtx) {
             bgCtx.fillStyle = 'white';
             bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
             bgCtx.drawImage(canvas, 0, 0); // Draw original image on top
             // Now use bgCanvas for JPEG conversion
             canvas.width = bgCanvas.width; // Update canvas dimensions just in case
             canvas.height = bgCanvas.height;
             ctx.drawImage(bgCanvas, 0, 0); // Draw the combined image back onto the main canvas
           }
          break;
      }

      // Convert canvas to Blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            throw new Error('Canvas to Blob conversion failed');
          }

          // Trigger download
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          const originalName = file.name.replace(/\.[^/.]+$/, "");
          link.download = `${originalName}.${outputFormat}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);

          toast({ title: 'Success', description: `Image converted to ${outputFormat.toUpperCase()} and download started.` });
          setIsProcessing(false);
        },
        mimeType,
        quality // Pass quality parameter if applicable
      );

    } catch (error) {
      console.error('Image conversion error:', error);
      let description = 'Failed to convert image.';
      if (error instanceof Error && error.message.includes('Image format is not supported')) {
         description = 'Input image format is not supported by the browser.';
      }
      toast({ title: 'Error', description, variant: 'destructive' });
      setIsProcessing(false);
    }
    // Note: canvas.toBlob is async, so setIsProcessing(false) is called inside the callback.
    // If an error occurs before the callback, it's caught in the catch block.
  };

  return (
    <div className="space-y-6">
      <FileUploader
        onFileAccepted={handleFileAccepted}
        accept={{ 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.gif', '.bmp'] }} // Accept common image formats
        label="Drag 'n' drop an image here, or click to select image"
      />

      {file && (
        <div className="space-y-4 p-4 border rounded-lg bg-card">
          <div className="grid gap-2">
            <Label htmlFor="output-format">Convert To</Label>
            <Select
              value={outputFormat}
              onValueChange={(value: OutputFormat) => setOutputFormat(value)}
              disabled={isProcessing}
            >
              <SelectTrigger id="output-format">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jpeg">JPEG</SelectItem>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="webp">WebP</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleConvert} disabled={isProcessing || !file}>
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Converting...
              </>
            ) : (
              'Convert Image'
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default ImageConverter;

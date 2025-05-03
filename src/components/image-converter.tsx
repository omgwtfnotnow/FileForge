'use client';

import React, { useState, useEffect } from 'react';
import FileUploader from './file-uploader';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
// browser-image-compression is not used here directly, but might be needed if canvas fails
// import imageCompression from 'browser-image-compression';
import { Loader2 } from 'lucide-react';

// Add 'heic' to the possible output formats
type OutputFormat = 'jpeg' | 'png' | 'webp' | 'heic';

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
    // Basic check for HEIC type, although MIME type might be ambiguous
    if (acceptedFile.type === 'image/heic' || acceptedFile.type === 'image/heif' || acceptedFile.name.toLowerCase().endsWith('.heic') || acceptedFile.name.toLowerCase().endsWith('.heif')) {
        toast({
            title: 'HEIC/HEIF Input Detected',
            description: 'Browser support for decoding HEIC/HEIF is limited. Conversion may fail.',
            variant: 'default', // Use default variant for informational messages
        });
    }
    setFile(acceptedFile);
  };

  const handleConvert = async () => {
    if (!file) {
      toast({ title: 'Error', description: 'Please upload an image file first.', variant: 'destructive' });
      return;
    }
    if (!isClient) return;

    setIsProcessing(true);

    // Check if the selected output format is HEIC
    if (outputFormat === 'heic') {
        toast({
            title: 'Conversion Not Supported',
            description: 'Direct conversion to HEIC format in the browser is not currently supported by this tool.',
            variant: 'destructive', // Use destructive variant for unsupported features
        });
        setIsProcessing(false); // Stop processing indicator
        return; // Exit the function
    }


    try {
      // Use createImageBitmap which has broader support for decoding various formats, including HEIC in some browsers (like Safari)
      // Fallback might be needed using a library like heic2any if createImageBitmap fails for HEIC
      let imageBitmap: ImageBitmap;
      try {
          imageBitmap = await createImageBitmap(file);
      } catch (bitmapError) {
          console.error("createImageBitmap failed:", bitmapError);
          // Add more specific error handling if needed, e.g., suggesting a library for HEIC
          if (file.type.startsWith('image/heic') || file.type.startsWith('image/heif') || file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
             throw new Error('Could not decode HEIC image. Browser support may be lacking. Try converting HEIC to JPG/PNG externally first.');
          } else {
             throw new Error('Could not decode image format.');
          }
      }


      const canvas = document.createElement('canvas');
      canvas.width = imageBitmap.width;
      canvas.height = imageBitmap.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      ctx.drawImage(imageBitmap, 0, 0);
      imageBitmap.close(); // Close the bitmap to free memory

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
        // HEIC case is handled above and will not reach here
        case 'jpeg':
        default:
          mimeType = 'image/jpeg';
          quality = 0.92; // Default quality for JPEG
          // Fill background with white for JPEG if original might have transparency (e.g., PNG, WEBP input)
           if (file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif') {
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
               ctx.drawImage(bgCanvas, 0, 0); // Draw the combined image back onto the main canvas
             }
           }
          break;
      }

      // Convert canvas to Blob
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setIsProcessing(false); // Ensure processing stops
            toast({ title: 'Error', description: 'Canvas to Blob conversion failed.', variant: 'destructive' });
            return; // Exit early
          }

          // Trigger download
          try {
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              const originalName = file.name.replace(/\.[^/.]+$/, "");
              link.download = `${originalName}.${outputFormat}`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(link.href); // Clean up object URL

              toast({ title: 'Success', description: `Image converted to ${outputFormat.toUpperCase()} and download started.` });
          } catch (downloadError) {
               console.error("Download error:", downloadError);
               toast({ title: 'Error', description: 'Failed to initiate download.', variant: 'destructive' });
          } finally {
               setIsProcessing(false); // Stop processing indicator
          }

        },
        mimeType,
        quality // Pass quality parameter if applicable
      );

    } catch (error) {
      console.error('Image conversion error:', error);
      let description = 'Failed to convert image.';
       if (error instanceof Error) {
           // Use error message if available and informative
           description = error.message.includes('decode') || error.message.includes('HEIC')
             ? error.message
             : 'Failed to convert image.';
       }
      toast({ title: 'Error', description, variant: 'destructive' });
      setIsProcessing(false); // Stop processing indicator on error
    }
    // Note: canvas.toBlob is async. The finally block inside the try...catch handles errors
    // *before* the toBlob call. The logic *inside* toBlob needs its own finally/error handling
    // for download issues or blob creation failures.
  };

  return (
    <div className="space-y-6">
      <FileUploader
        onFileAccepted={handleFileAccepted}
        accept={{
          'image/jpeg': ['.jpeg', '.jpg'],
          'image/png': ['.png'],
          'image/webp': ['.webp'],
          'image/gif': ['.gif'],
          'image/bmp': ['.bmp'],
          'image/heic': ['.heic'],
          'image/heif': ['.heif'],
        }}
        label="Drag 'n' drop an image (JPG, PNG, WEBP, GIF, BMP, HEIC), or click to select"
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
              <SelectTrigger id="output-format" className="w-[180px]">
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jpeg">JPEG</SelectItem>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="webp">WebP</SelectItem>
                {/* Add HEIC option */}
                <SelectItem value="heic">HEIC (Not Supported)</SelectItem>
              </SelectContent>
            </Select>
             {outputFormat === 'heic' && (
                 <p className="text-xs text-destructive mt-1">Conversion to HEIC is not supported in the browser.</p>
             )}
          </div>

          <Button onClick={handleConvert} disabled={isProcessing || !file || outputFormat === 'heic'}>
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

'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileUploader from './file-uploader';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument, rgb, degrees, PDFPage } from 'pdf-lib';
import { Loader2, Trash2, RotateCw, ArrowLeft, ArrowRight, Eye, Scissors as CropIcon } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import * as pdfjsLib from 'pdfjs-dist';
import ReactCrop, { type Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

// Configure pdf.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

interface PagePreview {
  id: number; // Original index
  dataUrl: string; // Placeholder text initially
  selected: boolean;
  // Optional: Store dimensions if calculated
  width?: number;
  height?: number;
}

interface CroppingPageInfo {
    index: number; // Current index in the `pages` array
    originalIndex: number; // Original index from the loaded PDF
    dataUrl: string;
    originalWidth: number;
    originalHeight: number;
}

const PdfEditor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const { toast } = useToast();

  // Cropping state
  const [isCropping, setIsCropping] = useState(false);
  const [croppingPageInfo, setCroppingPageInfo] = useState<CroppingPageInfo | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const [cropError, setCropError] = useState<string | null>(null);
  const [isRenderingCropPreview, setIsRenderingCropPreview] = useState(false);


  // Client-side check
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

 const renderPageToDataUrl = useCallback(async (pdfPage: PDFPage, scale = 1.5): Promise<string> => {
     const viewport = pdfPage.getViewport({ scale });
     const canvas = document.createElement('canvas');
     const context = canvas.getContext('2d');
     canvas.height = viewport.height;
     canvas.width = viewport.width;

     if (!context) {
         throw new Error('Could not get canvas context');
     }

     const renderContext = {
       canvasContext: context,
       viewport: viewport,
     };

     // pdf-lib page doesn't have a render method. We need pdf.js for this.
     // We need the pdfjs document and page object, not the pdf-lib one here.
     if (!file) throw new Error("File not available for rendering");

     const arrayBuffer = await file.arrayBuffer();
     const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
     const pdfjsPage = await pdfjsDoc.getPage(pdfPage.ref.tag.pageNumber); // Get pdf.js page using page number
     const pdfjsViewport = pdfjsPage.getViewport({ scale });

     canvas.height = pdfjsViewport.height;
     canvas.width = pdfjsViewport.width;

      const renderTask = pdfjsPage.render({
          canvasContext: context,
          viewport: pdfjsViewport,
      });

      await renderTask.promise;
      return canvas.toDataURL('image/png'); // Or 'image/jpeg'
  }, [file]);


  const loadPdf = useCallback(async (inputFile: File) => {
    if (!isClient) return;
    setIsLoadingPdf(true);
    setPages([]);
    setPdfDoc(null);
    try {
      const arrayBuffer = await inputFile.arrayBuffer();
      const loadedPdfDoc = await PDFDocument.load(arrayBuffer);
      setPdfDoc(loadedPdfDoc);

      const pageCount = loadedPdfDoc.getPageCount();
      const previews: PagePreview[] = [];
      // Get dimensions first without rendering previews yet
      for (let i = 0; i < pageCount; i++) {
        const page = loadedPdfDoc.getPage(i);
        const { width, height } = page.getSize();
        previews.push({
          id: i,
          dataUrl: `Loading Page ${i + 1}...`, // Placeholder
          selected: false,
          width,
          height,
        });
      }
      setPages(previews); // Set placeholders first

       // Intentionally don't render previews initially for performance
       // Previews will be rendered on demand for cropping/viewing

    } catch (error) {
      console.error('Error loading PDF:', error);
      toast({ title: 'Error', description: 'Failed to load PDF. It might be corrupted or password-protected.', variant: 'destructive' });
      setFile(null); // Reset file state on error
    } finally {
      setIsLoadingPdf(false);
    }
  }, [isClient, toast]);

  useEffect(() => {
    if (file) {
      loadPdf(file);
    } else {
      setPdfDoc(null);
      setPages([]);
    }
  }, [file, loadPdf]);

  const handleFileAccepted = (acceptedFile: File) => {
    setFile(acceptedFile);
  };

  const togglePageSelection = (index: number) => {
    setPages(prevPages =>
      prevPages.map((page, i) =>
        i === index ? { ...page, selected: !page.selected } : page
      )
    );
  };

  const selectAllPages = (select: boolean) => {
     setPages(prevPages => prevPages.map(page => ({ ...page, selected: select })));
  };

  const getSelectedIndices = () => {
    return pages
      .map((page, index) => (page.selected ? page.id : -1))
      .filter(id => id !== -1);
  };

   const getSelectedOriginalIndicesInCurrentOrder = () => {
      return pages
        .map((page, index) => (page.selected ? index : -1)) // Get current indices of selected pages
        .filter(index => index !== -1);
    };

  const deleteSelectedPages = async () => {
    if (!pdfDoc) return;
    const selectedCurrentIndices = getSelectedOriginalIndicesInCurrentOrder().sort((a, b) => b - a); // Sort desc to avoid index shifting issues

    if (selectedCurrentIndices.length === 0) {
      toast({ title: 'Info', description: 'No pages selected for deletion.' });
      return;
    }
    if (selectedCurrentIndices.length === pages.length) { // Check against current pages array length
       toast({ title: 'Error', description: 'Cannot delete all pages.', variant: 'destructive' });
       return;
    }

    setIsProcessing(true);
    try {
       // Store original indices to remove from the pdfDoc later if reordering happened
       const originalIndicesToRemove = selectedCurrentIndices.map(idx => pages[idx].id).sort((a, b) => b - a);

       // Remove pages from the pdfDoc based on their original index
       originalIndicesToRemove.forEach(originalIndex => {
            // Find the page with this original index in the current document state and remove it
            const pageIndexInDoc = pdfDoc.getPageIndices().findIndex(idx => pdfDoc.getPage(idx).ref.tag.pageNumber -1 === originalIndex);
            if (pageIndexInDoc !== -1) {
                 pdfDoc.removePage(pageIndexInDoc);
            }
       });

      // Update previews state by filtering based on current index
      const updatedPages = pages.filter((_, index) => !selectedCurrentIndices.includes(index))
                               .map((page) => ({ ...page, selected: false })); // Deselect after action


       setPages(updatedPages);


      toast({ title: 'Success', description: `${selectedCurrentIndices.length} page(s) deleted.` });
    } catch (error) {
      console.error('Error deleting pages:', error);
      toast({ title: 'Error', description: 'Failed to delete pages.', variant: 'destructive' });
       // Consider reloading the PDF state from the original file if complex errors occur
    } finally {
      setIsProcessing(false);
    }
  };

  const rotateSelectedPages = async (angle: number) => {
    if (!pdfDoc) return;
    const selectedCurrentIndices = getSelectedOriginalIndicesInCurrentOrder();

    if (selectedCurrentIndices.length === 0) {
      toast({ title: 'Info', description: 'No pages selected for rotation.' });
      return;
    }

    setIsProcessing(true);
    try {
      selectedCurrentIndices.forEach(index => {
        const originalIndex = pages[index].id;
        // Find the page in the current document by original index
        const pageIndexInDoc = pdfDoc.getPageIndices().findIndex(idx => pdfDoc.getPage(idx).ref.tag.pageNumber -1 === originalIndex);
        if(pageIndexInDoc === -1) return; // Skip if page not found (might happen if deleted then tried to rotate)

        const page = pdfDoc.getPage(pageIndexInDoc);
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + angle) % 360));
      });

       setPages(prevPages => prevPages.map(p => ({ ...p, selected: false }))); // Deselect
       toast({ title: 'Success', description: `Selected page(s) rotated ${angle} degrees.` });
       // No preview refresh needed unless using canvas previews

    } catch (error) {
      console.error('Error rotating pages:', error);
      toast({ title: 'Error', description: 'Failed to rotate pages.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

 const movePage = (index: number, direction: 'left' | 'right') => {
    if ((direction === 'left' && index === 0) || (direction === 'right' && index === pages.length - 1)) {
      return; // Cannot move beyond boundaries
    }

    setPages(currentPages => {
      const newPages = [...currentPages];
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      // Swap elements
      [newPages[index], newPages[targetIndex]] = [newPages[targetIndex], newPages[index]];
      return newPages;
    });
  };


  const saveChanges = async () => {
    if (!pdfDoc || !file) return;
    if(isCropping) {
        toast({ title: 'Info', description: 'Please finish or cancel cropping before saving.' });
        return;
    }

    setIsProcessing(true);
    try {
       // Create a *new* PDFDocument to ensure page order and modifications are correct
       const newPdfDoc = await PDFDocument.create();
       const originalPdfDoc = await PDFDocument.load(await file.arrayBuffer()); // Reload original

       for (const pageInfo of pages) { // Iterate through the current `pages` state (which reflects order)
         const originalIndex = pageInfo.id;

         // Find the corresponding page in the potentially modified `pdfDoc` to get its state (rotation, cropbox)
         const pageIndexInCurrentDoc = pdfDoc.getPageIndices().find(idx => (pdfDoc.getPage(idx).ref.tag?.pageNumber ?? -1) - 1 === originalIndex);

         if (pageIndexInCurrentDoc === undefined) continue; // Skip if page was deleted

         const currentPageState = pdfDoc.getPage(pageIndexInCurrentDoc);

         // Copy the page *from the original* document
         const [copiedPage] = await newPdfDoc.copyPages(originalPdfDoc, [originalIndex]);

         // Apply modifications from the `currentPageState` to the `copiedPage`
         copiedPage.setRotation(currentPageState.getRotation());

         const cropBox = currentPageState.getCropBox();
         // Only set crop box if it's different from the media box (default)
         const mediaBox = currentPageState.getMediaBox();
          if (cropBox.x !== mediaBox.x || cropBox.y !== mediaBox.y || cropBox.width !== mediaBox.width || cropBox.height !== mediaBox.height) {
              copiedPage.setCropBox(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
          }

         newPdfDoc.addPage(copiedPage);
       }


      const pdfBytes = await newPdfDoc.save();

      // Trigger download
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const originalName = file.name.replace(/\.[^/.]+$/, "");
      link.download = `${originalName}_edited.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({ title: 'Success', description: 'Edited PDF saved successfully.' });
      // Optionally reset state after saving
      // setFile(null);

    } catch (error) {
      console.error('Error saving PDF:', error);
      toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };


  // --- Cropping Logic ---

  const openCropDialog = async () => {
     const selectedCurrentIndices = getSelectedOriginalIndicesInCurrentOrder();
     if (selectedCurrentIndices.length !== 1) {
       toast({ title: 'Info', description: 'Please select exactly one page to crop.' });
       return;
     }
     if (!pdfDoc || !file) return;

     const index = selectedCurrentIndices[0];
     const pageInfo = pages[index];
     const originalIndex = pageInfo.id;

     setIsRenderingCropPreview(true);
     setCropError(null); // Reset error
     setCroppingPageInfo(null); // Reset previous info
     setIsCropping(true); // Open the dialog (conditionally rendered)

     try {
        // Find the actual page in the current pdfDoc state
        const pageIndexInDoc = pdfDoc.getPageIndices().findIndex(idx => (pdfDoc.getPage(idx).ref.tag?.pageNumber ?? -1) - 1 === originalIndex);
        if(pageIndexInDoc === -1) throw new Error("Selected page not found in document.");

        const page = pdfDoc.getPage(pageIndexInDoc);
        const dataUrl = await renderPageToDataUrl(page); // Use pdf.js rendering

        const { width, height } = page.getSize(); // Use pdf-lib size for original dimensions

        setCroppingPageInfo({
            index: index, // Current index in UI
            originalIndex: originalIndex, // Original PDF page index
            dataUrl: dataUrl,
            originalWidth: width,
            originalHeight: height,
        });
        // Reset crop selection when opening
        setCrop(undefined);
        setCompletedCrop(undefined);

     } catch(error) {
        console.error("Error rendering page for cropping:", error);
        toast({ title: 'Error', description: 'Could not render page for cropping.', variant: 'destructive' });
        setIsCropping(false); // Close dialog on error
        setCropError('Could not render page.');
     } finally {
         setIsRenderingCropPreview(false);
     }
   };


  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
      if (!croppingPageInfo) return;
      const { naturalWidth: width, naturalHeight: height } = e.currentTarget;
      const initialCrop = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 90, // Initial crop width percentage
          },
          1, // Aspect ratio (optional, 1 means free aspect ratio here)
          width,
          height,
        ),
        width,
        height,
      );
      setCrop(initialCrop);
    };

  const applyCrop = async () => {
    if (!completedCrop || !pdfDoc || !croppingPageInfo || !imgRef.current) {
      toast({ title: 'Error', description: 'Cannot apply crop. Missing data.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true); // Indicate processing within the dialog
    try {
        const pageIndexInDoc = pdfDoc.getPageIndices().findIndex(idx => (pdfDoc.getPage(idx).ref.tag?.pageNumber ?? -1) - 1 === croppingPageInfo.originalIndex);
        if(pageIndexInDoc === -1) throw new Error("Selected page not found in document.");

        const page = pdfDoc.getPage(pageIndexInDoc);
        const { originalWidth, originalHeight } = croppingPageInfo;
        const { naturalWidth: displayWidth, naturalHeight: displayHeight } = imgRef.current;

        // Calculate scale factor between displayed image and original PDF page size
        const scaleX = originalWidth / displayWidth;
        const scaleY = originalHeight / displayHeight;

        // Convert PixelCrop coordinates (relative to displayed image) to PDF coordinates
        // PDF coordinates origin is bottom-left, PixelCrop origin is top-left
        const pdfX = completedCrop.x * scaleX;
        const pdfY = originalHeight - (completedCrop.y + completedCrop.height) * scaleY; // Invert Y
        const pdfWidth = completedCrop.width * scaleX;
        const pdfHeight = completedCrop.height * scaleY;

        // Apply the crop box to the page in the temporary pdfDoc state
        page.setCropBox(pdfX, pdfY, pdfWidth, pdfHeight);

         // Update the dimensions in the main `pages` state if needed (optional)
         setPages(prevPages => prevPages.map((p, i) =>
             i === croppingPageInfo.index ? { ...p, width: pdfWidth, height: pdfHeight } : p
         ));

         toast({ title: 'Success', description: `Page ${croppingPageInfo.originalIndex + 1} cropped.` });
         setIsCropping(false); // Close the dialog
         setCroppingPageInfo(null); // Clear cropping info

    } catch (error) {
        console.error("Error applying crop:", error);
        toast({ title: 'Error', description: 'Failed to apply crop.', variant: 'destructive' });
    } finally {
        setIsProcessing(false); // Processing finished
    }
  };

  const closeCropDialog = () => {
    setIsCropping(false);
    setCroppingPageInfo(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setCropError(null);
  };


   // Placeholder for Preview functionality
   const previewSelectedPage = async () => {
       const selectedCurrentIndices = getSelectedOriginalIndicesInCurrentOrder();
       if (selectedCurrentIndices.length !== 1) {
          toast({ title: 'Info', description: 'Please select exactly one page to preview.' });
          return;
        }
       if (!pdfDoc || !file) return;

       const index = selectedCurrentIndices[0];
       const pageInfo = pages[index];
       const originalIndex = pageInfo.id;

       setIsProcessing(true); // Use general processing indicator
       try {
           const pageIndexInDoc = pdfDoc.getPageIndices().findIndex(idx => (pdfDoc.getPage(idx).ref.tag?.pageNumber ?? -1) - 1 === originalIndex);
           if(pageIndexInDoc === -1) throw new Error("Selected page not found in document.");

           const page = pdfDoc.getPage(pageIndexInDoc);
           const dataUrl = await renderPageToDataUrl(page, 2.0); // Render at higher scale for preview

           // Open in new tab/window
           const newWindow = window.open();
           if (newWindow) {
             newWindow.document.write(`<title>Preview Page ${originalIndex + 1}</title><img src="${dataUrl}" style="max-width: 100%; height: auto;">`);
           } else {
             throw new Error("Could not open preview window. Check pop-up blocker.");
           }

       } catch (error: any) {
           console.error("Error generating preview:", error);
           toast({ title: 'Error', description: `Failed to generate preview: ${error.message}`, variant: 'destructive' });
       } finally {
           setIsProcessing(false);
       }
    };


  const areAnyPagesSelected = getSelectedIndices().length > 0;
  const isSinglePageSelected = getSelectedIndices().length === 1;


  return (
    <div className="space-y-6">
      <FileUploader
        onFileAccepted={handleFileAccepted}
        accept={{ 'application/pdf': ['.pdf'] }}
        label="Drag 'n' drop a PDF here, or click to select PDF"
      />

      {isLoadingPdf && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading PDF...</span>
        </div>
      )}

      {pdfDoc && pages.length > 0 && !isLoadingPdf && (
        <div className="space-y-4 p-4 border rounded-lg bg-card">
          <div className="flex flex-wrap items-center gap-2 mb-4 border-b pb-4">
             <h3 className="text-lg font-medium mr-auto">Edit Pages ({pages.length})</h3>
             <div className="flex items-center space-x-2">
                 <Checkbox
                   id="select-all"
                   checked={pages.length > 0 && pages.every(p => p.selected)}
                   onCheckedChange={(checked) => selectAllPages(!!checked)}
                   disabled={isProcessing || isLoadingPdf || isCropping}
                 />
                 <Label htmlFor="select-all" className="text-sm font-medium">Select All</Label>
             </div>

              {/* Single Page Actions */}
              <Button variant="outline" size="sm" onClick={previewSelectedPage} disabled={!isSinglePageSelected || isProcessing || isLoadingPdf || isCropping} title="Preview Selected Page">
                 <Eye className="h-4 w-4" />
                 <span className="ml-1 hidden sm:inline">Preview</span>
              </Button>
              <Button variant="outline" size="sm" onClick={openCropDialog} disabled={!isSinglePageSelected || isProcessing || isLoadingPdf || isCropping} title="Crop Selected Page">
                 <CropIcon className="h-4 w-4" />
                 <span className="ml-1 hidden sm:inline">Crop</span>
              </Button>

              {/* Multi Page Actions */}
               <AlertDialog>
                 <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={!areAnyPagesSelected || isProcessing || isLoadingPdf || isCropping} title="Delete Selected Pages">
                       <Trash2 className="h-4 w-4" />
                        <span className="ml-1 hidden sm:inline">Delete</span>
                    </Button>
                 </AlertDialogTrigger>
                 <AlertDialogContent>
                   <AlertDialogHeader>
                     <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                     <AlertDialogDescription>
                       This action cannot be undone. This will permanently delete the selected {getSelectedIndices().length} page(s) from the document.
                     </AlertDialogDescription>
                   </AlertDialogHeader>
                   <AlertDialogFooter>
                     <AlertDialogCancel>Cancel</AlertDialogCancel>
                     <AlertDialogAction onClick={deleteSelectedPages} className={buttonVariants({ variant: 'destructive' })}>Delete</AlertDialogAction>
                   </AlertDialogFooter>
                 </AlertDialogContent>
               </AlertDialog>


            <Button variant="outline" size="sm" onClick={() => rotateSelectedPages(90)} disabled={!areAnyPagesSelected || isProcessing || isLoadingPdf || isCropping} title="Rotate Selected Pages Clockwise">
               <RotateCw className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Rotate</span>
            </Button>
          </div>

          <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <div className="flex space-x-4 p-4">
              {pages.map((page, index) => (
                <div
                  key={`${page.id}-${index}`} // Key needs to be unique even if IDs repeat after deletion/reorder
                  className="flex-shrink-0 w-32 group relative"
                >
                  <div
                    className={cn(
                      'border-2 rounded-md h-40 flex flex-col items-center justify-center text-sm text-muted-foreground bg-muted cursor-pointer relative overflow-hidden',
                      page.selected ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-border',
                      (isProcessing || isLoadingPdf || isCropping) ? 'opacity-50 cursor-not-allowed' : ''
                    )}
                     onClick={() => !(isProcessing || isLoadingPdf || isCropping) && togglePageSelection(index)}
                  >
                    <span className="mb-1">Page {index + 1}</span>
                    {page.width && page.height && (
                        <span className="text-xs">({page.width.toFixed(0)}x{page.height.toFixed(0)}pt)</span>
                    )}
                     <Checkbox
                        className="absolute top-2 right-2 z-10 bg-background/80 group-hover:opacity-100 opacity-100" // Always show for clarity
                        checked={page.selected}
                        onCheckedChange={(checked) => !(isProcessing || isLoadingPdf || isCropping) && togglePageSelection(index)}
                        disabled={isProcessing || isLoadingPdf || isCropping}
                        aria-label={`Select page ${index + 1}`}
                      />
                  </div>
                  <div className="mt-1 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Button
                         variant="ghost"
                         size="icon"
                         className="h-6 w-6"
                         onClick={() => !(isProcessing || isLoadingPdf || isCropping) && movePage(index, 'left')}
                         disabled={index === 0 || isProcessing || isLoadingPdf || isCropping}
                         title="Move Left"
                      >
                         <ArrowLeft className="h-4 w-4" />
                      </Button>
                     <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => !(isProcessing || isLoadingPdf || isCropping) && movePage(index, 'right')}
                        disabled={index === pages.length - 1 || isProcessing || isLoadingPdf || isCropping}
                        title="Move Right"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                  </div>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <div className="mt-6 flex justify-end">
            <Button onClick={saveChanges} disabled={isProcessing || isLoadingPdf || !pdfDoc || pages.length === 0 || isCropping}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Edited PDF'
              )}
            </Button>
          </div>
        </div>
      )}

        {/* Crop Dialog */}
       <Dialog open={isCropping} onOpenChange={closeCropDialog}>
           <DialogContent className="sm:max-w-[90vw] md:max-w-[70vw] lg:max-w-[60vw] xl:max-w-[50vw] h-[80vh] flex flex-col">
             <DialogHeader>
               <DialogTitle>Crop Page {croppingPageInfo ? croppingPageInfo.originalIndex + 1 : ''}</DialogTitle>
             </DialogHeader>
             <div className="flex-grow overflow-auto p-0 m-0 flex items-center justify-center bg-muted/50 relative">
                {isRenderingCropPreview && (
                   <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                       <Loader2 className="h-8 w-8 animate-spin text-primary" />
                       <span className="ml-2">Rendering Preview...</span>
                   </div>
                 )}
                {cropError && !isRenderingCropPreview && (
                    <div className="text-destructive p-4">{cropError}</div>
                )}
               {croppingPageInfo?.dataUrl && !cropError && !isRenderingCropPreview && (
                 <ReactCrop
                   crop={crop}
                   onChange={(_, percentCrop) => setCrop(percentCrop)}
                   onComplete={(c) => setCompletedCrop(c)}
                   aspect={undefined} // Free aspect ratio initially
                   // minWidth={100} // Optional min dimensions
                   // minHeight={100}
                   // ruleOfThirds // Optional guide overlay
                  className="max-w-full max-h-full"
                 >
                   <img
                     ref={imgRef}
                     alt="Crop preview"
                     src={croppingPageInfo.dataUrl}
                     onLoad={onImageLoad}
                     style={{ display: 'block', objectFit: 'contain', maxHeight: '70vh', maxWidth: '100%' }}
                   />
                 </ReactCrop>
               )}
             </div>
             <DialogFooter className="mt-4">
               <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={applyCrop}
                  disabled={!completedCrop || isProcessing || isRenderingCropPreview}
                >
                 {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Applying...</> : 'Apply Crop'}
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>

    </div>
  );
};

export default PdfEditor;

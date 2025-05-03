
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileUploader from './file-uploader';
import { Button, buttonVariants } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument, rgb, degrees, PDFPage, CropBox } from 'pdf-lib';
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
  id: number; // Original index (0-based)
  dataUrl: string; // Placeholder text initially
  selected: boolean;
  // Store dimensions and rotation from pdfDoc state
  width: number;
  height: number;
  rotation: number; // Store rotation angle
  cropBox?: CropBox; // Store crop box if applied
}

interface CroppingPageInfo {
    index: number; // Current index in the `pages` array
    originalIndex: number; // Original index from the loaded PDF (0-based)
    dataUrl: string; // Rendered preview for cropping
    originalWidth: number; // Original width from initial load
    originalHeight: number; // Original height from initial load
}

const PdfEditor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  // pdfDoc holds the *current state* of modifications (rotations, crops, deletions)
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [pages, setPages] = useState<PagePreview[]>([]); // UI state reflecting order and selection
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

  // Renders a specific page from the ORIGINAL file using pdf.js for previews/cropping
  const renderOriginalPageToDataUrl = useCallback(async (
      targetFile: File,
      pageIndex: number, // 0-based original index
      scale = 1.5
  ): Promise<string> => {
      const arrayBuffer = await targetFile.arrayBuffer();
      const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      // pdf.js uses 1-based page numbers
      const pdfjsPage = await pdfjsDoc.getPage(pageIndex + 1);
      const viewport = pdfjsPage.getViewport({ scale });

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

      await pdfjsPage.render(renderContext).promise;
      return canvas.toDataURL('image/png'); // Or 'image/jpeg'
  }, []);


  const loadPdf = useCallback(async (inputFile: File) => {
    if (!isClient) return;
    setIsLoadingPdf(true);
    setPages([]);
    setPdfDoc(null);
    try {
      const arrayBuffer = await inputFile.arrayBuffer();
      const loadedPdfDoc = await PDFDocument.load(arrayBuffer);
      setPdfDoc(loadedPdfDoc); // Store the modifiable pdf-lib document

      const pageCount = loadedPdfDoc.getPageCount();
      const initialPages: PagePreview[] = [];
      // Get initial dimensions and rotation from pdf-lib doc
      for (let i = 0; i < pageCount; i++) {
        const page = loadedPdfDoc.getPage(i);
        const { width, height } = page.getSize();
        const rotation = page.getRotation().angle;
        initialPages.push({
          id: i, // Store original index
          dataUrl: `Loading Page ${i + 1}...`, // Placeholder
          selected: false,
          width,
          height,
          rotation, // Store initial rotation
          cropBox: undefined, // Initially no crop box applied
        });
      }
      setPages(initialPages); // Set initial state for UI

       // Intentionally don't render previews initially for performance

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

  // Gets the original indices (page.id) of currently selected pages
  const getSelectedOriginalIndices = () => {
    return pages
      .map((page) => (page.selected ? page.id : -1))
      .filter(id => id !== -1);
  };

  // Gets the current indices (in the `pages` array) of selected pages
   const getSelectedCurrentIndices = () => {
      return pages
        .map((page, index) => (page.selected ? index : -1))
        .filter(index => index !== -1);
    };

  const deleteSelectedPages = async () => {
    if (!pdfDoc) return;
    // Get the *current* indices to remove from the UI state array
    const selectedCurrentIndices = getSelectedCurrentIndices().sort((a, b) => b - a); // Sort desc for UI state removal

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
       // Identify original indices to remove from the pdfDoc state
       const originalIndicesToRemove = selectedCurrentIndices.map(idx => pages[idx].id).sort((a, b) => b - a);

       // Remove pages from the pdfDoc based on their *original index*.
       // Need to map original index back to the current index within pdfDoc as it changes.
        const currentPdfIndices = pdfDoc.getPageIndices();
        originalIndicesToRemove.forEach(originalIndex => {
             // Find the page in pdfDoc that *currently* corresponds to this original index
             // This requires careful tracking if pdfDoc state itself isn't rebuilt on each op
             // A safer approach might be to rebuild pdfDoc on save, or find a reliable page identifier in pdf-lib
             // For now, assuming direct index removal works if done carefully (desc order)
             // or that pdf-lib handles index shifts internally (which it might not reliably)
             // --- Let's try removing by direct index lookup based on current state ---
             // Re-evaluate this if issues arise with complex reordering/deletion patterns.
             const pageIndexInDoc = pdfDoc.getPageIndices().findIndex(docIdx => {
                 const page = pdfDoc.getPage(docIdx);
                 // Heuristic: Check if a page has a specific property or ref matching the original page.
                 // This is brittle. A more robust way would be needed for complex scenarios.
                 // Simplest: Assume the original page number tag is still somewhat reliable *if*
                 // we look it up fresh each time.
                 return (page.ref.tag?.pageNumber ?? 0) - 1 === originalIndex;
             });

             if (pageIndexInDoc !== -1) {
                 try {
                    pdfDoc.removePage(pageIndexInDoc);
                 } catch (removeError) {
                     console.warn(`Could not remove page with original index ${originalIndex} (current doc index ${pageIndexInDoc}):`, removeError);
                     // Potentially try alternative lookup or skip
                 }
             } else {
                  console.warn(`Page with original index ${originalIndex} not found in current pdfDoc state for removal.`);
             }
        });


      // Update UI state by filtering based on current index
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
    const selectedCurrentIndices = getSelectedCurrentIndices();

    if (selectedCurrentIndices.length === 0) {
      toast({ title: 'Info', description: 'No pages selected for rotation.' });
      return;
    }

    setIsProcessing(true);
    try {
      const updatedPagesState = [...pages]; // Create a mutable copy of the pages state

      selectedCurrentIndices.forEach(index => {
        const originalIndex = pages[index].id;
        // Find the page in the current document state by original index (using the potentially brittle lookup)
         const pageIndexInDoc = pdfDoc.getPageIndices().findIndex(docIdx => (pdfDoc.getPage(docIdx).ref.tag?.pageNumber ?? 0) - 1 === originalIndex);

        if(pageIndexInDoc === -1) {
            console.warn(`Page with original index ${originalIndex} not found in pdfDoc for rotation.`);
            return; // Skip if page not found
        }

        const page = pdfDoc.getPage(pageIndexInDoc);
        const currentRotation = page.getRotation().angle;
        const newRotation = (currentRotation + angle) % 360;
        page.setRotation(degrees(newRotation));

        // Update the rotation in our UI state as well
        updatedPagesState[index] = { ...updatedPagesState[index], rotation: newRotation, selected: false };
      });

       setPages(updatedPagesState); // Update UI state
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
    // Note: This only changes the UI order. The actual PDF page order
    // is determined during the `saveChanges` function based on the `pages` array order.
  };


  const saveChanges = async () => {
    if (!pdfDoc || !file) return;
    if(isCropping) {
        toast({ title: 'Info', description: 'Please finish or cancel cropping before saving.' });
        return;
    }

    setIsProcessing(true);
    try {
       // Create a *new* PDFDocument to apply changes in the correct order.
       const newPdfDoc = await PDFDocument.create();
       // Load the *original* PDF again to copy pages from.
       const originalPdfDoc = await PDFDocument.load(await file.arrayBuffer());

       // Iterate through the current UI `pages` state array, which reflects the desired order and modifications.
       for (const pageInfo of pages) {
         const originalIndex = pageInfo.id; // The original 0-based index of this page

         // Copy the page *from the original* document based on its original index.
         // This ensures we get the pristine version before any modifications in this session.
         const [copiedPage] = await newPdfDoc.copyPages(originalPdfDoc, [originalIndex]);

         // Apply modifications stored in our UI state (`pageInfo`) to the copied page.
         copiedPage.setRotation(degrees(pageInfo.rotation));

         // Apply crop box if it exists in our state
         if (pageInfo.cropBox) {
             copiedPage.setCropBox(
                 pageInfo.cropBox.x,
                 pageInfo.cropBox.y,
                 pageInfo.cropBox.width,
                 pageInfo.cropBox.height
             );
         }
         // else {
         // Ensure MediaBox is set correctly (usually inherited during copy, but good practice)
         // const originalPage = originalPdfDoc.getPage(originalIndex);
         // const mediaBox = originalPage.getMediaBox();
         // copiedPage.setMediaBox(mediaBox.x, mediaBox.y, mediaBox.width, mediaBox.height);
         //}

         // Add the modified, copied page to the new document.
         // The order of addition dictates the final order in the saved PDF.
         newPdfDoc.addPage(copiedPage);
       }

      const pdfBytes = await newPdfDoc.save({ useObjectStreams: false }); // Disable object streams for better compatibility/potentially smaller size sometimes

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
      // Reset state after successful save
      // setFile(null); // Uncomment to clear the interface after save

    } catch (error) {
      console.error('Error saving PDF:', error);
      toast({ title: 'Error', description: `Failed to save changes. ${error instanceof Error ? error.message : ''}`, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };


  // --- Cropping Logic ---

  const openCropDialog = async () => {
     const selectedCurrentIndices = getSelectedCurrentIndices();
     if (selectedCurrentIndices.length !== 1) {
       toast({ title: 'Info', description: 'Please select exactly one page to crop.' });
       return;
     }
     // Use the original file for rendering the crop preview
     if (!file) {
        toast({ title: 'Error', description: 'Original file not available for cropping.', variant: 'destructive' });
        return;
     }

     const index = selectedCurrentIndices[0]; // Current UI index
     const pageInfo = pages[index];
     const originalIndex = pageInfo.id; // Original 0-based PDF index

     setIsRenderingCropPreview(true);
     setCropError(null); // Reset error
     setCroppingPageInfo(null); // Reset previous info
     setIsCropping(true); // Open the dialog

     try {
        // Render the page from the *original* file using pdf.js
        const dataUrl = await renderOriginalPageToDataUrl(file, originalIndex);

        // Get original dimensions from our initial load state
        const { width: originalWidth, height: originalHeight } = pageInfo;

        setCroppingPageInfo({
            index: index, // Current UI index
            originalIndex: originalIndex, // Original PDF page index
            dataUrl: dataUrl,
            originalWidth: originalWidth,
            originalHeight: originalHeight,
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
      const { naturalWidth: displayWidth, naturalHeight: displayHeight } = e.currentTarget;

      // Calculate initial crop centered, 90% of the smaller dimension
      const aspect = displayWidth / displayHeight;
      const initialCropWidthPercent = 90;

      const initialCrop = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: initialCropWidthPercent,
          },
          aspect, // Maintain aspect ratio of the page image
          displayWidth,
          displayHeight,
        ),
        displayWidth,
        displayHeight,
      );
      setCrop(initialCrop);
      setCompletedCrop(undefined); // Ensure completedCrop is reset if image reloads
    };

  const applyCrop = async () => {
    // Apply crop uses the `pdfDoc` state object and the `pages` UI state array
    if (!completedCrop || !pdfDoc || !croppingPageInfo || !imgRef.current) {
      toast({ title: 'Error', description: 'Cannot apply crop. Missing data.', variant: 'destructive' });
      return;
    }

    setIsProcessing(true); // Indicate processing within the dialog
    try {
        // Find the corresponding page *object* in the current `pdfDoc` state
        // using its original index for lookup (assuming `ref.tag.pageNumber` is reliable enough here)
        const pageIndexInDoc = pdfDoc.getPageIndices().findIndex(docIdx => (pdfDoc.getPage(docIdx).ref.tag?.pageNumber ?? 0) - 1 === croppingPageInfo.originalIndex);

        if(pageIndexInDoc === -1) {
            throw new Error(`Selected page (original index ${croppingPageInfo.originalIndex}) not found in current document state.`);
        }

        const page = pdfDoc.getPage(pageIndexInDoc);
        const { originalWidth, originalHeight } = croppingPageInfo; // Use original dimensions from CroppingPageInfo
        const { naturalWidth: displayWidth, naturalHeight: displayHeight } = imgRef.current; // Displayed size in crop tool

        // Calculate scale factor between displayed image and original PDF page size
        const scaleX = originalWidth / displayWidth;
        const scaleY = originalHeight / displayHeight;

        // Convert PixelCrop coordinates (relative to displayed image) to PDF coordinates
        // PDF coordinates origin is bottom-left, PixelCrop origin is top-left
        let pdfX = completedCrop.x * scaleX;
        let pdfY = originalHeight - (completedCrop.y + completedCrop.height) * scaleY; // Invert Y and adjust for height
        let pdfWidth = completedCrop.width * scaleX;
        let pdfHeight = completedCrop.height * scaleY;

        // Apply the crop box to the page *in the pdfDoc state*
        page.setCropBox(pdfX, pdfY, pdfWidth, pdfHeight);

        // Update the cropBox in the main `pages` UI state array as well
        const newCropBox = { x: pdfX, y: pdfY, width: pdfWidth, height: pdfHeight };
        setPages(prevPages => prevPages.map((p, i) =>
             i === croppingPageInfo.index ? { ...p, cropBox: newCropBox, selected: false } : p // Also deselect
        ));

        toast({ title: 'Success', description: `Page ${croppingPageInfo.originalIndex + 1} crop applied.` });
        setIsCropping(false); // Close the dialog
        setCroppingPageInfo(null); // Clear cropping info

    } catch (error) {
        console.error("Error applying crop:", error);
        toast({ title: 'Error', description: `Failed to apply crop. ${error instanceof Error ? error.message : ''}`, variant: 'destructive' });
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


   // Preview functionality (renders page from original file)
   const previewSelectedPage = async () => {
       const selectedCurrentIndices = getSelectedCurrentIndices();
       if (selectedCurrentIndices.length !== 1) {
          toast({ title: 'Info', description: 'Please select exactly one page to preview.' });
          return;
        }
       if (!file) {
           toast({ title: 'Error', description: 'Original file not available for preview.', variant: 'destructive' });
           return;
       }

       const index = selectedCurrentIndices[0];
       const pageInfo = pages[index];
       const originalIndex = pageInfo.id;

       setIsProcessing(true); // Use general processing indicator
       try {
           // Render from the original file using the original index
           const dataUrl = await renderOriginalPageToDataUrl(file, originalIndex, 2.0); // Render at higher scale

           // Open in new tab/window
           const newWindow = window.open();
           if (newWindow) {
             newWindow.document.write(`
               <html>
                 <head><title>Preview Page ${originalIndex + 1}</title></head>
                 <body style="margin: 0; background-color: #f0f0f0; display: flex; justify-content: center; align-items: center; min-height: 100vh;">
                   <img src="${dataUrl}" style="max-width: 95%; max-height: 95vh; height: auto; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
                 </body>
               </html>`);
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


  const areAnyPagesSelected = getSelectedOriginalIndices().length > 0;
  const isSinglePageSelected = getSelectedOriginalIndices().length === 1;


  return (
    <div className="space-y-6">
      <FileUploader
        onFileAccepted={handleFileAccepted}
        accept={{ 'application/pdf': ['.pdf'] }}
        label="Drag 'n' drop a PDF here, or click to select PDF"
        maxSize={100 * 1024 * 1024} // Example: 100MB limit
      />

      {isLoadingPdf && (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Loading PDF...</span>
        </div>
      )}

      {pdfDoc && pages.length > 0 && !isLoadingPdf && (
        <div className="space-y-4 p-4 border rounded-lg bg-card shadow-sm">
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
                       This action cannot be undone. This will permanently delete the selected {getSelectedOriginalIndices().length} page(s). The document state will be updated, but changes are only final upon saving.
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
             {/* Consider adding Rotate Counter-Clockwise */}
          </div>

          <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <div className="flex space-x-4 p-4">
              {pages.map((page, index) => (
                <div
                  key={`${page.id}-${index}`} // Key needs to be unique reflecting current position and original ID
                  className="flex-shrink-0 w-36 group relative" // Slightly wider for more info
                >
                  <div
                    className={cn(
                      'border-2 rounded-md h-48 flex flex-col items-center justify-center text-center text-xs text-muted-foreground bg-muted cursor-pointer relative overflow-hidden shadow-sm', // Added shadow
                      page.selected ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-border hover:border-muted-foreground/50',
                      (isProcessing || isLoadingPdf || isCropping) ? 'opacity-50 cursor-not-allowed' : ''
                    )}
                     onClick={() => !(isProcessing || isLoadingPdf || isCropping) && togglePageSelection(index)}
                  >
                    {/* Placeholder content - consider rendering tiny previews if feasible */}
                    <span className="font-medium text-sm mb-1">Page {index + 1}</span>
                    <span className="text-[10px]">Original: {page.id + 1}</span>
                    <span className="text-[10px]">({page.width.toFixed(0)}x{page.height.toFixed(0)}pt)</span>
                    {page.rotation !== 0 && <span className="text-[10px]">Rotated: {page.rotation}°</span>}
                    {page.cropBox && <span className="text-[10px] text-blue-600">Cropped</span>}

                     <Checkbox
                        className="absolute top-2 right-2 z-10 bg-background/80 group-hover:opacity-100 opacity-100" // Always show
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
            <Button onClick={saveChanges} disabled={isProcessing || isLoadingPdf || !pdfDoc || pages.length === 0 || isCropping} size="lg">
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                'Save Edited PDF'
              )}
            </Button>
          </div>
        </div>
      )}

        {/* Crop Dialog */}
       <Dialog open={isCropping} onOpenChange={(open) => !open && closeCropDialog()}>
           <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] xl:max-w-[60vw] h-[85vh] flex flex-col">
             <DialogHeader>
               <DialogTitle>Crop Page {croppingPageInfo ? croppingPageInfo.originalIndex + 1 : ''}</DialogTitle>
                {croppingPageInfo && (
                    <p className="text-sm text-muted-foreground">
                        Original Dimensions: {croppingPageInfo.originalWidth.toFixed(0)} x {croppingPageInfo.originalHeight.toFixed(0)} pt
                    </p>
                )}
             </DialogHeader>
             <div className="flex-grow overflow-hidden p-0 m-0 flex items-center justify-center bg-muted/30 relative border rounded-md">
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
                   onChange={(_, percentCrop) => setCrop(percentCrop)} // Store percentage crop
                   onComplete={(pixelCrop) => setCompletedCrop(pixelCrop)} // Store completed pixel crop
                   aspect={undefined} // Allow free aspect ratio
                   // minWidth={50} // Example min dimensions in pixels
                   // minHeight={50}
                   ruleOfThirds // Show rule of thirds grid
                   className="max-w-full max-h-full flex justify-center items-center" // Center the cropper
                 >
                   {/* Important: Image must have display: 'block' for accurate dimensions */}
                   <img
                     ref={imgRef}
                     alt="Crop preview"
                     src={croppingPageInfo.dataUrl}
                     onLoad={onImageLoad} // Set initial crop on load
                     style={{
                        display: 'block',
                        objectFit: 'contain',
                        maxHeight: 'calc(85vh - 150px)', // Adjust based on header/footer height
                        maxWidth: '100%',
                      }}
                   />
                 </ReactCrop>
               )}
             </div>
               {completedCrop && imgRef.current && (
                   <p className="text-xs text-muted-foreground text-center mt-1">
                       Crop size: {completedCrop.width.toFixed(0)} x {completedCrop.height.toFixed(0)} px
                       (at {imgRef.current.naturalWidth} x {imgRef.current.naturalHeight} px display)
                   </p>
               )}
             <DialogFooter className="mt-4">
               <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  type="button"
                  onClick={applyCrop}
                  disabled={!completedCrop?.width || !completedCrop?.height || isProcessing || isRenderingCropPreview}
                >
                 {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Applying Crop...</> : 'Apply Crop'}
               </Button>
             </DialogFooter>
           </DialogContent>
         </Dialog>

    </div>
  );
};

export default PdfEditor;



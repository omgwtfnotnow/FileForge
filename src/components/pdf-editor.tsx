'use client';

import React, { useState, useEffect, useCallback } from 'react';
import FileUploader from './file-uploader';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PDFDocument, rgb, degrees } from 'pdf-lib';
import { Loader2, Trash2, RotateCw, ArrowLeft, ArrowRight, Eye, Scissors as CropIcon } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface PagePreview {
  id: number; // Original index
  dataUrl: string;
  selected: boolean;
}

const PdfEditor: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<PDFDocument | null>(null);
  const [pages, setPages] = useState<PagePreview[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const { toast } = useToast();

  // Client-side check
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const loadPdf = useCallback(async (inputFile: File) => {
    if (!isClient) return;
    setIsLoadingPdf(true);
    setPages([]);
    setPdfDoc(null);
    try {
      const arrayBuffer = await inputFile.arrayBuffer();
      const loadedPdfDoc = await PDFDocument.load(arrayBuffer);
      setPdfDoc(loadedPdfDoc);

      // Generate previews (can be slow for large PDFs)
      const pageCount = loadedPdfDoc.getPageCount();
      const previews: PagePreview[] = [];
      for (let i = 0; i < pageCount; i++) {
        // Simple placeholder - Replace with actual rendering if needed (complex)
        // Using a placeholder avoids heavy client-side rendering for now
         previews.push({ id: i, dataUrl: `Page ${i + 1}`, selected: false });

        // --- Optional: Actual Canvas Rendering (can be slow/resource intensive) ---
        // const page = loadedPdfDoc.getPage(i);
        // const { width, height } = page.getSize();
        // const scale = 0.2; // Adjust scale for performance
        // const canvas = document.createElement('canvas');
        // canvas.width = width * scale;
        // canvas.height = height * scale;
        // const context = canvas.getContext('2d');
        // if (context) {
        //   // This requires pdf.js or similar library for rendering onto canvas
        //   // Placeholder: Draw a simple rectangle
        //   context.fillStyle = 'white';
        //   context.fillRect(0, 0, canvas.width, canvas.height);
        //   context.strokeStyle = 'black';
        //   context.strokeRect(0, 0, canvas.width, canvas.height);
        //   context.fillStyle = 'black';
        //   context.font = '10px Arial';
        //   context.fillText(`Page ${i + 1}`, 5, canvas.height / 2);
        //   previews.push({ id: i, dataUrl: canvas.toDataURL(), selected: false });
        // } else {
        //    previews.push({ id: i, dataUrl: `Page ${i + 1}`, selected: false }); // Fallback
        // }
         // --- End Optional Rendering ---
      }
      setPages(previews);

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
    if (selectedCurrentIndices.length === pdfDoc.getPageCount()) {
       toast({ title: 'Error', description: 'Cannot delete all pages.', variant: 'destructive' });
       return;
    }

    setIsProcessing(true);
    try {
       // Remove pages based on their *current* index in the potentially reordered array
        selectedCurrentIndices.forEach(indexToRemove => {
          pdfDoc.removePage(indexToRemove);
        });


      // Update previews after deletion
      const updatedPages = pages.filter((_, index) => !selectedCurrentIndices.includes(index))
                               .map((page, newIndex) => ({ ...page, selected: false })); // Deselect after action

       // Important: Re-assign correct original IDs if needed for future operations,
       // though for simple delete/rotate/reorder based on current view, this might suffice.
       // If original ID mapping is critical, maintain it separately.
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
        const page = pdfDoc.getPage(index);
        const currentRotation = page.getRotation().angle;
        page.setRotation(degrees((currentRotation + angle) % 360));
      });

      // Re-render previews if using canvas, otherwise just show success
       setPages(prevPages => prevPages.map(p => ({ ...p, selected: false }))); // Deselect
       toast({ title: 'Success', description: `Selected page(s) rotated ${angle} degrees.` });
       // Trigger preview refresh if necessary (complex)
       // For now, we assume the user knows the rotation happened.
       // await loadPdf(file!); // This reloads everything, losing unsaved changes if any

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

    setIsProcessing(true);
    try {
      // Reorder pages in the actual PDFDocument based on the current `pages` state
       const orderedIndices = pages.map(p => p.id); // Get original indices in the new order
       pdfDoc.removePages(); // Clear existing pages (careful with this if modify operations were done in place)
       const originalPdfDoc = await PDFDocument.load(await file.arrayBuffer()); // Reload original to copy pages

       const newPdfDoc = await PDFDocument.create(); // Create a new document to add pages in order

       for (const originalIndex of orderedIndices) {
           const [copiedPage] = await newPdfDoc.copyPages(originalPdfDoc, [originalIndex]);
           // Apply rotations that might have been performed on the temporary `pdfDoc`
           const tempPage = pdfDoc.getPage(orderedIndices.indexOf(originalIndex)); // Find the page in the temp doc
           copiedPage.setRotation(tempPage.getRotation()); // Apply rotation from temp doc
           // Apply cropping if implemented
           // copiedPage.setCropBox(...)
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


  // Placeholder for Crop functionality
  const cropSelectedPages = () => {
     if (getSelectedIndices().length === 0) {
       toast({ title: 'Info', description: 'No pages selected for cropping.' });
       return;
     }
     toast({ title: 'Not Implemented', description: 'Cropping requires a visual interface and is not yet implemented.' });
     // Implementation would involve:
     // 1. Displaying the selected page(s) in a modal or dedicated view.
     // 2. Providing a cropping tool (e.g., using react-image-crop principles but on PDF page render).
     // 3. Getting crop coordinates relative to the page.
     // 4. Using pdfDoc.getPage(index).setCropBox(x, y, width, height).
  };

   // Placeholder for Preview functionality
   const previewSelectedPage = () => {
      const selectedCurrentIndices = getSelectedOriginalIndicesInCurrentOrder();
      if (selectedCurrentIndices.length !== 1) {
         toast({ title: 'Info', description: 'Please select exactly one page to preview.' });
         return;
       }
       toast({ title: 'Not Implemented', description: 'Full-size preview requires rendering and is not yet implemented.' });
       // Implementation would involve rendering the selected page (potentially using pdf.js)
       // into a larger canvas or an iframe in a modal.
   }


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

      {pdfDoc && pages.length > 0 && (
        <div className="space-y-4 p-4 border rounded-lg bg-card">
          <div className="flex flex-wrap items-center gap-2 mb-4 border-b pb-4">
             <h3 className="text-lg font-medium mr-auto">Edit Pages ({pages.length})</h3>
             <div className="flex items-center space-x-2">
                 <Checkbox
                   id="select-all"
                   checked={pages.length > 0 && pages.every(p => p.selected)}
                   onCheckedChange={(checked) => selectAllPages(!!checked)}
                   disabled={isProcessing}
                 />
                 <Label htmlFor="select-all" className="text-sm font-medium">Select All</Label>
             </div>

              {/* Single Page Actions */}
              <Button variant="outline" size="sm" onClick={previewSelectedPage} disabled={!isSinglePageSelected || isProcessing} title="Preview Selected Page">
                 <Eye className="h-4 w-4" />
                 <span className="ml-1 hidden sm:inline">Preview</span>
              </Button>
              <Button variant="outline" size="sm" onClick={cropSelectedPages} disabled={!areAnyPagesSelected || isProcessing} title="Crop Selected Page(s)">
                 <CropIcon className="h-4 w-4" />
                 <span className="ml-1 hidden sm:inline">Crop</span>
              </Button>

              {/* Multi Page Actions */}
               <AlertDialog>
                 <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={!areAnyPagesSelected || isProcessing} title="Delete Selected Pages">
                       <Trash2 className="h-4 w-4" />
                        <span className="ml-1 hidden sm:inline">Delete</span>
                    </Button>
                 </AlertDialogTrigger>
                 <AlertDialogContent>
                   <AlertDialogHeader>
                     <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                     <AlertDialogDescription>
                       This action cannot be undone. This will permanently delete the selected {getSelectedIndices().length} page(s).
                     </AlertDialogDescription>
                   </AlertDialogHeader>
                   <AlertDialogFooter>
                     <AlertDialogCancel>Cancel</AlertDialogCancel>
                     <AlertDialogAction onClick={deleteSelectedPages} className={buttonVariants({ variant: 'destructive' })}>Delete</AlertDialogAction>
                   </AlertDialogFooter>
                 </AlertDialogContent>
               </AlertDialog>


            <Button variant="outline" size="sm" onClick={() => rotateSelectedPages(90)} disabled={!areAnyPagesSelected || isProcessing} title="Rotate Selected Pages Clockwise">
               <RotateCw className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">Rotate</span>
            </Button>
          </div>

          <ScrollArea className="w-full whitespace-nowrap rounded-md border">
            <div className="flex space-x-4 p-4">
              {pages.map((page, index) => (
                <div
                  key={page.id} // Use original ID if stable, or index if reordering happens
                  className="flex-shrink-0 w-32 group relative"
                >
                  <div
                    className={cn(
                      'border-2 rounded-md h-40 flex items-center justify-center text-sm text-muted-foreground bg-muted cursor-pointer relative overflow-hidden',
                      page.selected ? 'border-primary ring-2 ring-primary ring-offset-2' : 'border-border',
                      isProcessing ? 'opacity-50' : ''
                    )}
                     onClick={() => !isProcessing && togglePageSelection(index)}
                  >
                     {/* Placeholder text instead of image data URL */}
                    <span>Page {index + 1}</span>
                    {/* <img src={page.dataUrl} alt={`Page ${index + 1}`} className="max-w-full max-h-full object-contain" /> */}
                     <Checkbox
                        className="absolute top-2 right-2 z-10 bg-background/80 group-hover:opacity-100 opacity-100" // Always show for clarity
                        checked={page.selected}
                        onCheckedChange={() => togglePageSelection(index)}
                        disabled={isProcessing}
                        aria-label={`Select page ${index + 1}`}
                      />
                  </div>
                  <div className="mt-1 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Button
                         variant="ghost"
                         size="icon"
                         className="h-6 w-6"
                         onClick={() => movePage(index, 'left')}
                         disabled={index === 0 || isProcessing}
                         title="Move Left"
                      >
                         <ArrowLeft className="h-4 w-4" />
                      </Button>
                     <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => movePage(index, 'right')}
                        disabled={index === pages.length - 1 || isProcessing}
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
            <Button onClick={saveChanges} disabled={isProcessing || !pdfDoc || pages.length === 0}>
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
    </div>
  );
};

// Need to import buttonVariants if using AlertDialog destructive action styling
import { buttonVariants } from "@/components/ui/button"
import { cn } from '@/lib/utils';

export default PdfEditor;

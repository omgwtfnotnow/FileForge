'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PdfTools from '@/components/pdf-tools';
import ImageTools from '@/components/image-tools';
import { FileText, Image as ImageIcon } from 'lucide-react';

export default function Home() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8">FileForge Tools</h1>
      <Tabs defaultValue="pdf" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="pdf">
            <FileText className="mr-2 h-4 w-4" /> PDF Tools
          </TabsTrigger>
          <TabsTrigger value="image">
            <ImageIcon className="mr-2 h-4 w-4" /> Image Tools
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pdf">
          <PdfTools />
        </TabsContent>
        <TabsContent value="image">
          <ImageTools />
        </TabsContent>
      </Tabs>
    </div>
  );
}

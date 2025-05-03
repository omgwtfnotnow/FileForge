'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PdfCompressor from './pdf-compressor';
import PdfEditor from './pdf-editor';
import { Minimize2, Scissors } from 'lucide-react';


const PdfTools = () => {

  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle>PDF Tools</CardTitle>
        <CardDescription>Compress, crop, edit, and manage your PDF files.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="compress" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="compress">
               <Minimize2 className="mr-2 h-4 w-4" /> Compress PDF
            </TabsTrigger>
            <TabsTrigger value="edit">
               <Scissors className="mr-2 h-4 w-4" /> Crop & Edit PDF
            </TabsTrigger>
          </TabsList>
          <TabsContent value="compress">
            <PdfCompressor />
          </TabsContent>
          <TabsContent value="edit">
            <PdfEditor />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default PdfTools;

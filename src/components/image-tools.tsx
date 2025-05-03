'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ImageConverter from './image-converter';
import ImageCompressor from './image-compressor';
import { Shuffle, Minimize2 } from 'lucide-react';

const ImageTools = () => {
  return (
    <Card className="w-full shadow-md">
      <CardHeader>
        <CardTitle>Image Tools</CardTitle>
        <CardDescription>Convert and compress your images with ease.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="convert" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="convert">
               <Shuffle className="mr-2 h-4 w-4" /> Change Format
            </TabsTrigger>
            <TabsTrigger value="compress">
               <Minimize2 className="mr-2 h-4 w-4" /> Compress Image
            </TabsTrigger>
          </TabsList>
          <TabsContent value="convert">
            <ImageConverter />
          </TabsContent>
          <TabsContent value="compress">
            <ImageCompressor />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ImageTools;

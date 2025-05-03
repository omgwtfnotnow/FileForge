import type { Metadata } from 'next';
// Replaced Geist_Sans with Inter as Geist is not a Google Font
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';

// Initialize Inter font
const inter = Inter({
  variable: '--font-inter', // Use a descriptive variable name
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'FileForge',
  description: 'Modern PDF and image manipulation tool',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Apply the font variable to the html tag
    <html lang="en" className={`${inter.variable}`}>
      <body className={`antialiased font-sans flex flex-col min-h-screen`}>
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}

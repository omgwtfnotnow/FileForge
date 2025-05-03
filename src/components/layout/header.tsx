import React from 'react';
import Link from 'next/link';
import { FileCog } from 'lucide-react';

const Header = () => {
  return (
    <header className="bg-card border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-primary">
          <FileCog className="h-6 w-6" />
          FileForge
        </Link>
        {/* Navigation links can be added here if needed */}
      </div>
    </header>
  );
};

export default Header;

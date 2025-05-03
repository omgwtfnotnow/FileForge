import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-muted text-muted-foreground py-4 mt-12 border-t">
      <div className="container mx-auto px-4 text-center text-sm">
        &copy; {currentYear} FileForge. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;

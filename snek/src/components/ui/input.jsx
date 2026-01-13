import React from 'react';

export function Input({ 
  className = '', 
  type = 'text',
  ...props 
}) {
   const baseStyles = `
    flex h-10 w-full rounded-md
    bg-gray-800 px-3 py-2
    text-sm text-white placeholder:text-gray-500

    border border-gray-700/30
    focus-visible:outline-none
    focus-visible:border-gray-500/40

    disabled:cursor-not-allowed
    disabled:opacity-50
  `;
  
  return (
    <input
      type={type}
      className={`${baseStyles} ${className}`}
      {...props}
    />
  );
}


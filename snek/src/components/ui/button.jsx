import React from 'react';

export function Button({ 
  children, 
  onClick, 
  disabled = false, 
  className = '', 
  variant = 'default',
  size = 'default',
  ...props 
}) {
  const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
  
const variants = {
  default: 'bg-[#CF5A16] text-white hover:bg-[#B84F14]',
  outline: 'border border-gray-600 bg-transparent hover:bg-gray-800 text-white',
  ghost: 'hover:bg-gray-800 text-gray-400',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
};
  
  const sizes = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 rounded-md px-3',
    lg: 'h-11 rounded-md px-8',
    icon: 'h-10 w-10',
  };
  
  const variantClass = variants[variant] || variants.default;
  const sizeClass = sizes[size] || sizes.default;
  
  return (
    <button
      className={`${baseStyles} ${variantClass} ${sizeClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}


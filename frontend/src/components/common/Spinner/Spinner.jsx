import React from 'react';
import { RefreshCw } from 'lucide-react';

const Spinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className={`flex items-center justify-center p-8 ${className}`}>
      <RefreshCw className={`${sizeClasses[size]} text-blue-600 animate-spin`} />
    </div>
  );
};

export default Spinner;

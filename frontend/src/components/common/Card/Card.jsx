import React from 'react';

const Card = ({ children, className = '', title, actions }) => {
  return (
    <div className={`bg-white rounded-xl shadow-lg p-6 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between mb-6">
          {title && <h2 className="text-2xl font-bold text-gray-800">{title}</h2>}
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export default Card;
import React from 'react';
import { AlertCircle, CheckCircle, XCircle, X } from 'lucide-react';

const Alert = ({ type = 'info', message, onClose }) => {
  const config = {
    error: {
      bgColor: 'bg-red-50',
      borderColor: 'border-red-500',
      textColor: 'text-red-700',
      Icon: XCircle,
    },
    success: {
      bgColor: 'bg-green-50',
      borderColor: 'border-green-500',
      textColor: 'text-green-700',
      Icon: CheckCircle,
    },
    info: {
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-500',
      textColor: 'text-blue-700',
      Icon: AlertCircle,
    },
  };

  const { bgColor, borderColor, textColor, Icon } = config[type];

  return (
    <div className={`${bgColor} border-l-4 ${borderColor} p-4 mb-4 rounded`}>
      <div className="flex items-center">
        <Icon className={`w-5 h-5 ${textColor} mr-2`} />
        <p className={textColor}>{message}</p>
        {onClose && (
          <button
            onClick={onClose}
            className={`ml-auto ${textColor} hover:opacity-75`}
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;

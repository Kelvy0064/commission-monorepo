import React from 'react';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import Spinner from '../../../components/common/Spinner/Spinner';

const RepassesTable = ({ repasses, loading, onMarcarPago }) => {
  if (loading) return <Spinner />;

  if (repasses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Nenhum repasse encontrado</p>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const config = {
      pendente: 'bg-yellow-100 text-yellow-700',
      pago: 'bg-green-100 text-green-700',
      cancelado: 'bg-gray-100 text-gray-700',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config[status] || config.pendente}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Corretor</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Competência</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Valor</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Previsão</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {repasses.map((repasse) => (
            <tr key={repasse.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-800">{repasse.corretor_nome}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{repasse.competencia}</td>
              <td className="px-4 py-3 text-sm text-green-600 font-semibold">
                {formatCurrency(repasse.valor_repasse)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{formatDate(repasse.data_previsao_pagamento)}</td>
              <td className="px-4 py-3 text-sm">{getStatusBadge(repasse.status)}</td>
              <td className="px-4 py-3 text-sm">
                {repasse.status === 'pago' ? (
                  <span className="text-gray-400 text-xs">
                    Pago em {formatDate(repasse.data_pagamento_real)}
                  </span>
                ) : onMarcarPago ? (
                  <button
                    onClick={() => onMarcarPago(repasse.id)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Marcar Pago
                  </button>
                ) : (
                  <span className="text-gray-400 text-xs">Aguardando pagamento</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RepassesTable;
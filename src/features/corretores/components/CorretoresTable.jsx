import React from 'react';
import { formatCPF, formatPercentage } from '../../../utils/formatters';
import Spinner from '../../../components/common/Spinner/Spinner';

const CorretoresTable = ({ corretores, loading, onEdit, onDelete }) => {
  if (loading) {
    return <Spinner />;
  }

  if (corretores.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Nenhum corretor cadastrado</p>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const classes = status === 'ativo' 
      ? 'bg-green-100 text-green-700' 
      : 'bg-gray-100 text-gray-700';
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${classes}`}>
        {status}
      </span>
    );
  };

  const getTipoBadge = (tipo) => {
    const classes = tipo === 'titular' 
      ? 'bg-purple-100 text-purple-700' 
      : 'bg-blue-100 text-blue-700';
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${classes}`}>
        {tipo}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Nome
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              CPF
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Email
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Tipo
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Comissão
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Status
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {corretores.map((corretor) => (
            <tr key={corretor.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-800">
                {corretor.nome}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {formatCPF(corretor.cpf)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {corretor.email}
              </td>
              <td className="px-4 py-3 text-sm">
                {getTipoBadge(corretor.tipo)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-800">
                {formatPercentage(corretor.percentual_comissao)}
              </td>
              <td className="px-4 py-3 text-sm">
                {getStatusBadge(corretor.status)}
              </td>
              <td className="px-4 py-3 text-sm">
                <button
                  onClick={() => onEdit(corretor)}
                  className="text-blue-600 hover:text-blue-800 mr-3 font-medium"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDelete(corretor.id)}
                  className="text-red-600 hover:text-red-800 font-medium"
                >
                  Excluir
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CorretoresTable;

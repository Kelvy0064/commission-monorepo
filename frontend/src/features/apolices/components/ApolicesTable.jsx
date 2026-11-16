import React from 'react';
import { formatCurrency } from '../../../utils/formatters';
import Spinner from '../../../components/common/Spinner/Spinner';

// onEdit/onDelete nulos escondem as ações; verComissao=false esconde a coluna de comissão
const ApolicesTable = ({ apolices, loading, onEdit, onDelete, verComissao = true }) => {
  const temAcoes = Boolean(onEdit || onDelete);
  if (loading) return <Spinner />;

  if (apolices.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Nenhuma apólice cadastrada</p>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const config = {
      ativa: 'bg-green-100 text-green-700',
      cancelada: 'bg-red-100 text-red-700',
      suspensa: 'bg-yellow-100 text-yellow-700',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config[status] || config.ativa}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Número</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Seguradora</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tipo</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prêmio</th>
            {verComissao && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Comissão</th>}
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
            {temAcoes && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {apolices.map((apolice) => (
            <tr key={apolice.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-800">{apolice.numero_apolice}</td>
              <td className="px-4 py-3 text-sm text-gray-800">{apolice.cliente_nome}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{apolice.seguradora_nome}</td>
              <td className="px-4 py-3 text-sm">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  {apolice.tipo_seguro}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-800">{formatCurrency(apolice.valor_premio_mensal)}</td>
              {verComissao && (
                <td className="px-4 py-3 text-sm text-green-600 font-medium">
                  {apolice.tabela_comissao_nome ? `Tabela: ${apolice.tabela_comissao_nome}` : `${apolice.percentual_comissao}%`}
                </td>
              )}
              <td className="px-4 py-3 text-sm">{getStatusBadge(apolice.status)}</td>
              {temAcoes && (
                <td className="px-4 py-3 text-sm">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(apolice)}
                      className="text-blue-600 hover:text-blue-800 mr-3 font-medium"
                    >
                      Editar
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(apolice.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                    >
                      Excluir
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ApolicesTable;

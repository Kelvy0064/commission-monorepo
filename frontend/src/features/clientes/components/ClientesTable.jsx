import React from 'react';
import Spinner from '../../../components/common/Spinner/Spinner';
import { formatDate } from '../../../utils/formatters';

const ClientesTable = ({ clientes, loading, emptyMessage = 'Nenhum cliente cadastrado', onEdit, onDelete }) => {
  // Spinner só no primeiro carregamento; ao paginar/filtrar mantém a tabela visível
  if (loading && clientes.length === 0) return <Spinner />;

  if (clientes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const config = {
      lead: 'bg-amber-100 text-amber-700',
      ativo: 'bg-green-100 text-green-700',
      inativo: 'bg-gray-100 text-gray-700',
      cancelado: 'bg-red-100 text-red-700',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config[status] || config.inativo}`}>
        {status}
      </span>
    );
  };

  return (
    <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-50' : ''}`}>
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">CPF/CNPJ</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Telefone</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Corretor</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Idades</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cadastro</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {clientes.map((cliente) => (
            <tr key={cliente.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-800">{cliente.nome}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{cliente.cpf_cnpj || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{cliente.email || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{cliente.telefone || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{cliente.corretor_nome || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {cliente.idades?.length ? cliente.idades.join(', ') : '-'}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDate(cliente.data_cadastro)}</td>
              <td className="px-4 py-3 text-sm">{getStatusBadge(cliente.status)}</td>
              <td className="px-4 py-3 text-sm">
                <button
                  onClick={() => onEdit(cliente)}
                  className="text-blue-600 hover:text-blue-800 mr-3 font-medium"
                >
                  Editar
                </button>
                <button
                  onClick={() => onDelete(cliente.id)}
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

export default ClientesTable;
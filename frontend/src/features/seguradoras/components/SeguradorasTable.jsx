import React from 'react';
import { formatCNPJ, formatDate } from '../../../utils/formatters';
import Spinner from '../../../components/common/Spinner/Spinner';

const AConfirmar = () => <span className="text-amber-700 italic">A confirmar</span>;

// onComissoes nulo esconde a coluna de tabelas; podeEditar=false troca "Editar" por "Ver"
const SeguradorasTable = ({ seguradoras, loading, onEdit, onDelete, onComissoes, podeEditar = true }) => {
  if (loading) return <Spinner />;

  if (seguradoras.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Nenhuma seguradora cadastrada</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nome</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">CNPJ</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Contato</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Dia Pagamento</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Prazo Repasse</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Contrato</th>
            {onComissoes && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Comissões</th>}
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {seguradoras.map((seguradora) => (
            <tr key={seguradora.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-800">{seguradora.nome}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{formatCNPJ(seguradora.cnpj)}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{seguradora.contato || '-'}</td>
              <td className="px-4 py-3 text-sm text-gray-800">
                {seguradora.dia_pagamento != null ? `Dia ${seguradora.dia_pagamento}` : <AConfirmar />}
              </td>
              <td className="px-4 py-3 text-sm text-gray-800">
                {seguradora.prazo_repasse_dias != null ? `${seguradora.prazo_repasse_dias} dias` : <AConfirmar />}
              </td>
              <td className="px-4 py-3 text-sm whitespace-nowrap">
                {seguradora.contrato_assinado ? (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                    Assinado{seguradora.contrato_assinado_em ? ` em ${formatDate(seguradora.contrato_assinado_em)}` : ''}
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Pendente</span>
                )}
              </td>
              {onComissoes && (
                <td className="px-4 py-3 text-sm">
                  <button
                    onClick={() => onComissoes(seguradora)}
                    className="text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                  >
                    {seguradora.tabelas_ativas
                      ? `${seguradora.tabelas_ativas} tabela${seguradora.tabelas_ativas > 1 ? 's' : ''}`
                      : podeEditar
                        ? 'Cadastrar'
                        : 'Nenhuma'}
                  </button>
                </td>
              )}
              <td className="px-4 py-3 text-sm">
                <button
                  onClick={() => onEdit(seguradora)}
                  className="text-blue-600 hover:text-blue-800 mr-3 font-medium"
                >
                  {podeEditar ? 'Editar' : 'Ver'}
                </button>
                {podeEditar && (
                  <button
                    onClick={() => onDelete(seguradora.id)}
                    className="text-red-600 hover:text-red-800 font-medium"
                  >
                    Excluir
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SeguradorasTable;
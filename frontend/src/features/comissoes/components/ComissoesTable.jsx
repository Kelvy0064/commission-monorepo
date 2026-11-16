import React from 'react';
import { Check } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import Spinner from '../../../components/common/Spinner/Spinner';

const TIPO_LABEL = { agenciamento: 'Agenciamento', vitalicio: 'Vitalício', fixa: 'Fixa' };

const ComissoesTable = ({ comissoes, loading, onMarcarRecebida }) => {
  if (loading) return <Spinner />;

  if (comissoes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Nenhuma comissão encontrada</p>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const config = {
      prevista: 'bg-yellow-100 text-yellow-700',
      recebida: 'bg-green-100 text-green-700',
      atrasada: 'bg-red-100 text-red-700',
      cancelada: 'bg-gray-100 text-gray-700',
    };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config[status] || config.prevista}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Competência</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Apólice</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Parcela</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Corretor</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Valor</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Previsão</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {comissoes.map((comissao) => (
            <tr key={comissao.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-800">{comissao.competencia}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{comissao.numero_apolice}</td>
              <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                {comissao.numero_parcela ? `${comissao.numero_parcela}ª` : '-'}
                {comissao.tipo && <span className="text-gray-400"> · {TIPO_LABEL[comissao.tipo] || comissao.tipo}</span>}
                {comissao.numero_parcela === 1 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-xs" title="Gera repasse ao corretor">
                    repasse
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-gray-800">{comissao.cliente_nome}</td>
              <td className="px-4 py-3 text-sm text-gray-600">{comissao.corretor_nome}</td>
              <td className="px-4 py-3 text-sm text-green-600 font-semibold">
                {formatCurrency(comissao.valor_comissao_bruto)}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">{formatDate(comissao.data_previsao_recebimento)}</td>
              <td className="px-4 py-3 text-sm">{getStatusBadge(comissao.status)}</td>
              <td className="px-4 py-3 text-sm">
                {comissao.status === 'prevista' && (
                  <button
                    onClick={() => onMarcarRecebida(comissao.id)}
                    className="text-green-600 hover:text-green-800 flex items-center gap-1 font-medium"
                  >
                    <Check className="w-4 h-4" />
                    Recebida
                  </button>
                )}
                {comissao.status === 'recebida' && (
                  <span className="text-gray-400 text-xs">
                    Recebida em {formatDate(comissao.data_recebimento_real)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ComissoesTable;
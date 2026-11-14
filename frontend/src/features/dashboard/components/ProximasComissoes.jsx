import React from 'react';
import { Clock } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils/formatters';

const ProximasComissoes = ({ comissoes, loading, onMarcarRecebida }) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <p className="text-gray-500 text-center">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-blue-600" />
        Próximos Recebimentos (7 dias)
      </h3>
      <div className="space-y-3">
        {comissoes.length === 0 ? (
          <p className="text-gray-500 text-sm">Nenhuma comissão prevista nos próximos 7 dias</p>
        ) : (
          comissoes.map((comissao) => (
            <div key={comissao.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
              <div>
                <div className="font-medium text-gray-800">{comissao.cliente_nome || 'Cliente'}</div>
                <div className="text-sm text-gray-600">{formatDate(comissao.data_previsao_recebimento)}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-green-600">
                  {formatCurrency(comissao.valor_comissao_bruto)}
                </div>
                {onMarcarRecebida && (
                  <button
                    onClick={() => onMarcarRecebida(comissao.id)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Marcar recebida
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProximasComissoes;
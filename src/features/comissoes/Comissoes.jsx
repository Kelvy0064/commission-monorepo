import React, { useState } from 'react';
import { RefreshCw, Filter } from 'lucide-react';
import { useComissoes } from './hooks/useComissoes';
import ComissoesTable from './components/ComissoesTable';
import Button from '../../components/common/Button/Button';
import Alert from '../../components/common/Alert/Alert';
import Card from '../../components/common/Card/Card';

const Comissoes = () => {
  const { comissoes, loading, error, filters, marcarRecebida, updateFilters, refresh } = useComissoes();
  const [alert, setAlert] = useState(null);

  const handleMarcarRecebida = async (id) => {
    const result = await marcarRecebida(id);
    if (result.success) {
      setAlert({ type: 'success', message: 'Comissão marcada como recebida!' });
      setTimeout(() => setAlert(null), 3000);
    } else {
      setAlert({ type: 'error', message: result.error || 'Erro ao marcar comissão' });
    }
  };

  const comissoesPrevistas = comissoes.filter(c => c.status === 'prevista');
  const totalPrevisto = comissoesPrevistas.reduce((sum, c) => sum + parseFloat(c.valor_comissao_bruto || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Comissões</h1>
        <p className="text-gray-600">Controle e conciliação de comissões</p>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      {error && !alert && <Alert type="error" message={error} onClose={() => setAlert(null)} />}

      <Card
        className="mb-6"
        actions={
          <>
            <select
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value })}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas</option>
              <option value="prevista">Previstas</option>
              <option value="recebida">Recebidas</option>
              <option value="atrasada">Atrasadas</option>
            </select>
            <Button variant="secondary" icon={RefreshCw} onClick={refresh} disabled={loading} loading={loading}>
              Atualizar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            Total: <span className="font-semibold">{comissoes.length}</span> comissão(ões)
          </div>
          <div>
            Previstas: <span className="font-semibold text-yellow-600">{comissoesPrevistas.length}</span>
          </div>
          <div>
            Valor Previsto: <span className="font-semibold text-green-600">
              R$ {totalPrevisto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <ComissoesTable comissoes={comissoes} loading={loading} onMarcarRecebida={handleMarcarRecebida} />
      </Card>
    </div>
  );
};

export default Comissoes;
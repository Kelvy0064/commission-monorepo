import React, { useState } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { useRepasses } from './hooks/useRepasses';
import RepassesTable from './components/RepassesTable';
import Button from '../../components/common/Button/Button';
import Alert from '../../components/common/Alert/Alert';
import Card from '../../components/common/Card/Card';

const Repasses = () => {
  const { repasses, loading, error, gerarRepasses, marcarPago, refresh } = useRepasses();
  const [alert, setAlert] = useState(null);

  const handleGerarRepasses = async () => {
    const result = await gerarRepasses();
    if (result.success) {
      setAlert({
        type: 'success',
        message: `${result.data.repasses_gerados || 0} repasses gerados com sucesso!`,
      });
      setTimeout(() => setAlert(null), 3000);
    } else {
      setAlert({ type: 'error', message: result.error || 'Erro ao gerar repasses' });
    }
  };

  const handleMarcarPago = async (id) => {
    const result = await marcarPago(id, {});
    if (result.success) {
      setAlert({ type: 'success', message: 'Repasse marcado como pago!' });
      setTimeout(() => setAlert(null), 3000);
    } else {
      setAlert({ type: 'error', message: result.error || 'Erro ao marcar repasse' });
    }
  };

  const repassesPendentes = repasses.filter(r => r.status === 'pendente');
  const totalPendente = repassesPendentes.reduce((sum, r) => sum + parseFloat(r.valor_repasse || 0), 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Repasses</h1>
        <p className="text-gray-600">Gerencie os repasses à equipe</p>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      {error && !alert && <Alert type="error" message={error} onClose={() => setAlert(null)} />}

      <Card
        className="mb-6"
        actions={
          <>
            <Button variant="success" icon={Plus} onClick={handleGerarRepasses} disabled={loading} loading={loading}>
              Gerar Repasses
            </Button>
            <Button variant="secondary" icon={RefreshCw} onClick={refresh} disabled={loading} loading={loading}>
              Atualizar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            Total: <span className="font-semibold">{repasses.length}</span> repasse(s)
          </div>
          <div>
            Pendentes: <span className="font-semibold text-yellow-600">{repassesPendentes.length}</span>
          </div>
          <div>
            Valor Pendente: <span className="font-semibold text-orange-600">
              R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <RepassesTable repasses={repasses} loading={loading} onMarcarPago={handleMarcarPago} />
      </Card>
    </div>
  );
};

export default Repasses;
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import Button from '../../components/common/Button/Button';
import Alert from '../../components/common/Alert/Alert';
import Card from '../../components/common/Card/Card';
import Spinner from '../../components/common/Spinner/Spinner';
import { useAuth } from '../../context/AuthContext';
import { estornosService } from '../../api/services/estornos.service';
import { formatDate } from '../../utils/formatters';
import CancelamentoModal from '../estornos/components/CancelamentoModal';
import { motivoLabel } from '../estornos/constants';

const th = 'px-4 py-3 text-left text-sm font-semibold text-gray-700';
const td = 'px-4 py-3 text-sm';

// Spec 005: clientes no período de estorno (corretor e pós-venda acompanham até o fim) e cancelamentos
// do mês para a daily. Sem valores de comissão.
const Monitoramento = () => {
  const { pode } = useAuth();
  const [dados, setDados] = useState({ em_periodo: [], cancelamentos_mes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelando, setCancelando] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDados(await estornosService.monitoramento());
      setError(null);
    } catch (err) {
      setError(err.message || 'Erro ao carregar o monitoramento');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const emDestaque = dados.em_periodo.filter((a) => a.destaque).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Monitoramento de estorno</h1>
          <p className="text-gray-600">Clientes no período de estorno — acompanhe até o fim para evitar o cancelamento</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={load} disabled={loading} loading={loading}>
          Atualizar
        </Button>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}

      <Card className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            Em período: <span className="font-semibold">{dados.em_periodo.length}</span>
          </div>
          <div>
            Terminando em até 30 dias: <span className="font-semibold text-orange-600">{emDestaque}</span>
          </div>
          <div>
            Cancelamentos no mês: <span className="font-semibold text-red-600">{dados.cancelamentos_mes.length}</span>
          </div>
        </div>
      </Card>

      <Card title="No período de estorno" className="mb-6">
        {loading ? (
          <Spinner />
        ) : dados.em_periodo.length === 0 ? (
          <p className="text-center py-8 text-gray-500">Nenhum cliente no período de estorno</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Cliente</th>
                  <th className={th}>Apólice</th>
                  <th className={th}>Operadora</th>
                  <th className={th}>Corretor</th>
                  <th className={th}>Início</th>
                  <th className={th}>Fim do período</th>
                  {pode('estornos.avisar') && <th className={th}>Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dados.em_periodo.map((a) => (
                  <tr key={a.apolice_id} className={a.destaque ? 'bg-orange-50' : 'hover:bg-gray-50'}>
                    <td className={`${td} text-gray-800`}>
                      <div className="font-medium">{a.cliente_nome}</div>
                      {a.cliente_telefone && <div className="text-xs text-gray-500">{a.cliente_telefone}</div>}
                    </td>
                    <td className={`${td} text-gray-700`}>{a.numero_apolice}</td>
                    <td className={`${td} text-gray-600`}>{a.seguradora_nome}</td>
                    <td className={`${td} text-gray-600`}>{a.corretor_nome || '-'}</td>
                    <td className={`${td} text-gray-600`}>{formatDate(a.inicio_vigencia)}</td>
                    <td className={td}>
                      <div className="text-gray-800">{formatDate(a.fim_periodo)}</div>
                      <div className={`text-xs ${a.destaque ? 'text-orange-700 font-semibold' : 'text-gray-500'}`}>
                        {a.destaque && <ShieldAlert className="inline w-3 h-3 mr-1" />}
                        faltam {a.dias_restantes} dia(s)
                      </div>
                    </td>
                    {pode('estornos.avisar') && (
                      <td className={td}>
                        <button onClick={() => setCancelando(a)} className="text-orange-600 hover:text-orange-800 font-medium">
                          Registrar cancelamento
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Cancelamentos do mês">
        {loading ? (
          <Spinner />
        ) : dados.cancelamentos_mes.length === 0 ? (
          <p className="text-center py-8 text-gray-500">Nenhum cancelamento registrado neste mês</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Data</th>
                  <th className={th}>Cliente</th>
                  <th className={th}>Apólice</th>
                  <th className={th}>Operadora</th>
                  <th className={th}>Corretor</th>
                  <th className={th}>Motivo</th>
                  <th className={th}>Estorno</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {dados.cancelamentos_mes.map((c) => (
                  <tr key={c.apolice_id} className="hover:bg-gray-50">
                    <td className={`${td} text-gray-700`}>{formatDate(c.data_cancelamento)}</td>
                    <td className={`${td} text-gray-800`}>{c.cliente_nome}</td>
                    <td className={`${td} text-gray-700`}>{c.numero_apolice}</td>
                    <td className={`${td} text-gray-600`}>{c.seguradora_nome}</td>
                    <td className={`${td} text-gray-600`}>{c.corretor_nome || '-'}</td>
                    <td className={`${td} text-gray-600`}>{motivoLabel(c.motivo_cancelamento, c.motivo_cancelamento_descricao)}</td>
                    <td className={td}>
                      {c.houve_estorno ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Com estorno</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Sem estorno</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CancelamentoModal apolice={cancelando} onClose={() => setCancelando(null)} onDone={load} />
    </div>
  );
};

export default Monitoramento;

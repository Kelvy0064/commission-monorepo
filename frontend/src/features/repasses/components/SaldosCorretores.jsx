import React, { useCallback, useEffect, useState } from 'react';
import Card from '../../../components/common/Card/Card';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import Alert from '../../../components/common/Alert/Alert';
import Spinner from '../../../components/common/Spinner/Spinner';
import { estornosService } from '../../../api/services/estornos.service';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { hojeBrasil } from '../../estornos/constants';

const th = 'px-4 py-3 text-left text-sm font-semibold text-gray-700';
const td = 'px-4 py-3 text-sm';
const inputClass = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500';

const TIPO_MOVIMENTO = {
  desconto_repasse: 'Descontado do repasse',
  quitacao_manual: 'Quitação manual',
  estorno_de_desconto: 'Desconto devolvido ao saldo',
};

// Acordo (teto por repasse) ou quitação manual (spec 005/RN-09)
const SaldoModal = ({ saldo, modo, onClose, onDone }) => {
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hojeBrasil());
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    setValor(modo === 'acordo' ? saldo?.desconto_maximo_por_repasse ?? '' : saldo?.valor_restante ?? '');
    setData(hojeBrasil());
    setObservacao('');
    setError(null);
  }, [saldo, modo]);
  if (!saldo) return null;

  const salvar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modo === 'acordo') {
        await estornosService.acordo(saldo.id, { desconto_maximo_por_repasse: valor === '' ? null : Number(valor) });
      } else {
        await estornosService.quitar(saldo.id, { valor: Number(valor), data, observacao });
      }
      onDone();
    } catch (err) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={modo === 'acordo' ? 'Acordo de desconto' : 'Registrar quitação'} size="sm">
      <p className="text-sm text-gray-600 mb-4">
        {saldo.corretor_nome} — restante {formatCurrency(saldo.valor_restante)} (apólice {saldo.numero_apolice})
      </p>
      <form onSubmit={salvar} className="space-y-4">
        <div>
          <label htmlFor="saldo-valor" className="block text-sm font-medium text-gray-700 mb-1">
            {modo === 'acordo' ? 'Desconto máximo por repasse (R$) — vazio = sem limite' : 'Valor quitado (R$) *'}
          </label>
          <input id="saldo-valor" type="number" step="0.01" min="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className={inputClass} />
        </div>
        {modo === 'quitacao' && (
          <>
            <div>
              <label htmlFor="saldo-data" className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input id="saldo-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="saldo-obs" className="block text-sm font-medium text-gray-700 mb-1">Observação</label>
              <input id="saldo-obs" value={observacao} onChange={(e) => setObservacao(e.target.value)} className={inputClass} placeholder="Ex.: PIX recebido do corretor" />
            </div>
          </>
        )}
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Voltar</Button>
          <Button type="submit" loading={saving} disabled={saving}>Salvar</Button>
        </div>
      </form>
    </Modal>
  );
};

// Saldos que os corretores devolvem por estornos — descontados automaticamente dos próximos repasses
const SaldosCorretores = ({ atualizar }) => {
  const [saldos, setSaldos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null); // { saldo, modo }
  const [aberto, setAberto] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSaldos(await estornosService.getSaldos());
      setError(null);
    } catch (err) {
      setError(err.message || 'Erro ao carregar saldos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, atualizar]);

  const pendentes = saldos.filter((s) => s.status === 'pendente');
  const total = pendentes.reduce((s, x) => s + Number(x.valor_restante), 0);

  return (
    <Card title="Saldos dos corretores (estornos)" className="mt-6">
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      <p className="text-sm text-gray-600 mb-4">
        Pendente: <span className="font-semibold text-orange-600">{formatCurrency(total)}</span> em {pendentes.length} saldo(s).
        Descontado automaticamente ao gerar os próximos repasses de cada corretor.
      </p>
      {loading ? (
        <Spinner />
      ) : saldos.length === 0 ? (
        <p className="text-center py-6 text-gray-500">Nenhum saldo de estorno</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className={th}>Corretor</th>
                <th className={th}>Origem</th>
                <th className={th}>Valor</th>
                <th className={th}>Restante</th>
                <th className={th}>Acordo</th>
                <th className={th}>Situação</th>
                <th className={th}>Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {saldos.map((s) => (
                <React.Fragment key={s.id}>
                  <tr className="hover:bg-gray-50">
                    <td className={`${td} font-medium text-gray-800`}>{s.corretor_nome}</td>
                    <td className={`${td} text-gray-600`}>
                      {s.cliente_nome}
                      <div className="text-xs text-gray-500">{s.numero_apolice}</div>
                    </td>
                    <td className={`${td} text-gray-700`}>{formatCurrency(s.valor_original)}</td>
                    <td className={`${td} font-semibold text-orange-700`}>{formatCurrency(s.valor_restante)}</td>
                    <td className={`${td} text-gray-600`}>
                      {s.desconto_maximo_por_repasse ? `até ${formatCurrency(s.desconto_maximo_por_repasse)}/repasse` : '-'}
                    </td>
                    <td className={td}>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.status === 'pendente' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}`}>
                        {s.status === 'pendente' ? 'Pendente' : 'Quitado'}
                      </span>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {s.status === 'pendente' && (
                        <>
                          <button onClick={() => setEditando({ saldo: s, modo: 'acordo' })} className="text-blue-600 hover:text-blue-800 font-medium mr-3">
                            Acordo
                          </button>
                          <button onClick={() => setEditando({ saldo: s, modo: 'quitacao' })} className="text-green-600 hover:text-green-800 font-medium mr-3">
                            Quitar
                          </button>
                        </>
                      )}
                      <button onClick={() => setAberto(aberto === s.id ? null : s.id)} className="text-gray-600 hover:text-gray-800 font-medium">
                        Histórico
                      </button>
                    </td>
                  </tr>
                  {aberto === s.id && (
                    <tr>
                      <td colSpan={7} className="px-4 py-3 bg-gray-50 text-sm">
                        {s.movimentos.length === 0 ? (
                          <p className="text-gray-500">Sem movimentos ainda</p>
                        ) : (
                          <ul className="space-y-1">
                            {s.movimentos.map((m) => (
                              <li key={m.id} className="text-gray-700">
                                {formatDate(m.data)} — {TIPO_MOVIMENTO[m.tipo] || m.tipo}: <strong>{formatCurrency(m.valor)}</strong>
                                {m.observacao ? ` (${m.observacao})` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <SaldoModal
        saldo={editando?.saldo}
        modo={editando?.modo}
        onClose={() => setEditando(null)}
        onDone={() => {
          setEditando(null);
          load();
        }}
      />
    </Card>
  );
};

export default SaldosCorretores;

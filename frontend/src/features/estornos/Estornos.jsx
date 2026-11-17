import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import Button from '../../components/common/Button/Button';
import Alert from '../../components/common/Alert/Alert';
import Card from '../../components/common/Card/Card';
import Modal from '../../components/common/Modal/Modal';
import Spinner from '../../components/common/Spinner/Spinner';
import { estornosService } from '../../api/services/estornos.service';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { FORMAS_COBRANCA, STATUS_ESTORNO, competenciaAtual, hojeBrasil, motivoLabel } from './constants';

const th = 'px-4 py-3 text-left text-sm font-semibold text-gray-700';
const td = 'px-4 py-3 text-sm';
const inputClass = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500';

const StatusBadge = ({ status }) => {
  const s = STATUS_ESTORNO[status] || { label: status, cor: 'bg-gray-100 text-gray-700' };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.cor}`}>{s.label}</span>;
};

// Etapa 2 (spec 005/RN-17): valor cobrado pela plataforma e forma de cobrança
const ConcluirModal = ({ estorno, onClose, onDone }) => {
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    setValor('');
    setForma('');
    setError(null);
  }, [estorno]);
  if (!estorno) return null;

  const salvar = async (e) => {
    e.preventDefault();
    if (!(Number(valor) > 0)) return setError('Informe o valor estornado pela plataforma');
    if (!forma) return setError('Escolha como a plataforma vai cobrar');
    setSaving(true);
    try {
      const r = await estornosService.concluir(estorno.id, { valor_estornado: Number(valor), forma_cobranca: forma });
      onDone(r);
    } catch (err) {
      setError(err.message || 'Erro ao concluir o estorno');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Concluir estorno" size="sm">
      <p className="text-sm text-gray-600 mb-4">
        Apólice <strong>{estorno.numero_apolice}</strong> — {estorno.cliente_nome} ({estorno.seguradora_nome}), cancelada em{' '}
        {formatDate(estorno.data_cancelamento)}.
      </p>
      <form onSubmit={salvar} className="space-y-4">
        <div>
          <label htmlFor="est-valor" className="block text-sm font-medium text-gray-700 mb-1">
            Valor estornado pela plataforma (R$) *
          </label>
          <input id="est-valor" type="number" step="0.01" min="0.01" value={valor} onChange={(e) => setValor(e.target.value)} className={inputClass} />
        </div>
        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-1">Como a plataforma vai cobrar *</legend>
          {FORMAS_COBRANCA.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm text-gray-700 mb-1">
              <input type="radio" name="forma" value={f.id} checked={forma === f.id} onChange={() => setForma(f.id)} />
              {f.label}
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-gray-500">
          Se o repasse da 1ª parcela já foi pago ao corretor, o valor dele vira saldo pendente e é descontado dos próximos
          repasses. Corretor já desligado: a corretora assume.
        </p>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Voltar</Button>
          <Button type="submit" loading={saving} disabled={saving}>Concluir</Button>
        </div>
      </form>
    </Modal>
  );
};

// Plataforma descontou / corretora pagou (RN-18)
const LiquidarModal = ({ estorno, onClose, onDone }) => {
  const [data, setData] = useState(hojeBrasil());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    setData(hojeBrasil());
    setError(null);
  }, [estorno]);
  if (!estorno) return null;
  const descontar = estorno.status === 'a_descontar';

  const salvar = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await estornosService.liquidar(estorno.id, { data });
      onDone();
    } catch (err) {
      setError(err.message || 'Erro ao registrar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={descontar ? 'Marcar como descontado' : 'Marcar como pago'} size="sm">
      <form onSubmit={salvar} className="space-y-4">
        <p className="text-sm text-gray-600">
          {formatCurrency(estorno.valor_estornado)} — apólice {estorno.numero_apolice} ({estorno.seguradora_nome})
        </p>
        <div>
          <label htmlFor="liq-data" className="block text-sm font-medium text-gray-700 mb-1">
            {descontar ? 'Data do pagamento da plataforma em que foi descontado' : 'Data do pagamento (PIX/boleto)'}
          </label>
          <input id="liq-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputClass} />
        </div>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Voltar</Button>
          <Button type="submit" variant="success" loading={saving} disabled={saving}>Confirmar</Button>
        </div>
      </form>
    </Modal>
  );
};

const TabelaEstornos = ({ estornos, acao }) =>
  estornos.length === 0 ? (
    <p className="text-center py-8 text-gray-500">Nada por aqui</p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className={th}>Cancelamento</th>
            <th className={th}>Cliente / apólice</th>
            <th className={th}>Operadora</th>
            <th className={th}>Corretor</th>
            <th className={th}>Motivo</th>
            <th className={th}>Valor estornado</th>
            <th className={th}>Situação</th>
            {acao && <th className={th}>Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {estornos.map((e) => (
            <tr key={e.id} className="hover:bg-gray-50">
              <td className={`${td} text-gray-700`}>{formatDate(e.data_cancelamento)}</td>
              <td className={`${td} text-gray-800`}>
                <div className="font-medium">{e.cliente_nome}</div>
                <div className="text-xs text-gray-500">{e.numero_apolice}</div>
              </td>
              <td className={`${td} text-gray-600`}>{e.seguradora_nome}</td>
              <td className={`${td} text-gray-600`}>
                {e.corretor_nome || '-'}
                {e.saldo_id && <div className="text-xs text-orange-700">saldo de {formatCurrency(e.saldo_valor)}</div>}
                {e.assumido_pela_corretora && <div className="text-xs text-gray-500">assumido pela corretora</div>}
              </td>
              <td className={`${td} text-gray-600`}>{motivoLabel(e.motivo_cancelamento, e.motivo_cancelamento_descricao)}</td>
              <td className={`${td} text-gray-800`}>{e.valor_estornado ? formatCurrency(e.valor_estornado) : '-'}</td>
              <td className={td}>
                <StatusBadge status={e.status} />
                {e.data_liquidacao && <div className="text-xs text-gray-500 mt-1">em {formatDate(e.data_liquidacao)}</div>}
              </td>
              {acao && <td className={td}>{acao(e)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

// Relatório do financeiro (RN-20): o que a plataforma deve pagar por operadora, já descontados os estornos
const RelatorioPlataforma = () => {
  const [competencia, setCompetencia] = useState(competenciaAtual());
  const [dados, setDados] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ativo = true;
    estornosService
      .relatorioPlataforma(competencia)
      .then((r) => ativo && (setDados(r), setError(null)))
      .catch((err) => ativo && setError(err.message || 'Erro ao gerar o relatório'));
    return () => {
      ativo = false;
    };
  }, [competencia]);

  const soma = (campo) => (dados?.operadoras || []).reduce((s, o) => s + Number(o[campo] || 0), 0);
  const colunas = [
    ['a_receber', 'A receber'],
    ['recebido', 'Recebido'],
    ['estornos_a_descontar', 'Estornos a descontar'],
    ['liquido_esperado', 'Líquido esperado'],
    ['estornos_a_pagar', 'Estornos a pagar (PIX/boleto)'],
  ];

  return (
    <Card
      title="Relatório do financeiro — plataforma VIDA"
      actions={
        <input
          type="month"
          aria-label="Competência"
          value={competencia}
          onChange={(e) => setCompetencia(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg"
        />
      }
    >
      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {!dados ? (
        <Spinner />
      ) : dados.operadoras.length === 0 ? (
        <p className="text-center py-8 text-gray-500">Sem comissões nem estornos nesta competência</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className={th}>Operadora</th>
                {colunas.map(([, label]) => (
                  <th key={label} className={`${th} text-right`}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {dados.operadoras.map((o) => (
                <tr key={o.seguradora_id}>
                  <td className={`${td} text-gray-800 font-medium`}>
                    {o.seguradora_nome}
                    {o.estornos_aguardando_conclusao > 0 && (
                      <div className="text-xs text-yellow-700">{o.estornos_aguardando_conclusao} estorno(s) sem valor ainda</div>
                    )}
                  </td>
                  {colunas.map(([campo]) => (
                    <td key={campo} className={`${td} text-right ${campo === 'liquido_esperado' ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {formatCurrency(o[campo])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className={td}>Total</td>
                {colunas.map(([campo]) => (
                  <td key={campo} className={`${td} text-right`}>{formatCurrency(soma(campo))}</td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500">
            "A receber" e "Recebido" são da competência escolhida; estornos mostram tudo o que está em aberto. Ao lançar o
            pagamento da plataforma, registre o recebimento de cada venda pelo valor cheio e marque o estorno como
            descontado — assim o repasse de outros corretores não diminui.
          </p>
        </div>
      )}
    </Card>
  );
};

// Spec 005 — etapa 2 do estorno, dívida com a plataforma e relatório (Administrador e Gestor)
const Estornos = () => {
  const [estornos, setEstornos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null);
  const [concluindo, setConcluindo] = useState(null);
  const [liquidando, setLiquidando] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEstornos(await estornosService.getAll());
    } catch (err) {
      setAlert({ type: 'error', message: err.message || 'Erro ao carregar estornos' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const aguardando = estornos.filter((e) => e.status === 'aguardando_conclusao');
  const emAberto = estornos.filter((e) => ['a_descontar', 'a_pagar'].includes(e.status));
  const liquidados = estornos.filter((e) => ['descontado', 'pago'].includes(e.status));

  const aposConcluir = (r) => {
    setConcluindo(null);
    setAlert({
      type: 'success',
      message: r.saldo
        ? `Estorno concluído. Saldo de ${formatCurrency(r.saldo.valor_original)} do corretor será descontado dos próximos repasses.`
        : r.estorno.assumido_pela_corretora
          ? 'Estorno concluído. Corretor já desligado: a corretora assume.'
          : 'Estorno concluído. O repasse não tinha sido pago, então não há saldo do corretor.',
    });
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Estornos</h1>
          <p className="text-gray-600">Conclusão dos cancelamentos, dívida com a plataforma e relatório do financeiro</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={load} disabled={loading} loading={loading}>
          Atualizar
        </Button>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}

      {loading ? (
        <Spinner />
      ) : (
        <>
          <Card title={`Aguardando conclusão (${aguardando.length})`} className="mb-6">
            <TabelaEstornos
              estornos={aguardando}
              acao={(e) => (
                <button onClick={() => setConcluindo(e)} className="text-blue-600 hover:text-blue-800 font-medium">
                  Concluir
                </button>
              )}
            />
          </Card>
          <Card title={`Em aberto com a plataforma (${emAberto.length})`} className="mb-6">
            <TabelaEstornos
              estornos={emAberto}
              acao={(e) => (
                <button onClick={() => setLiquidando(e)} className="text-green-600 hover:text-green-800 font-medium">
                  {e.status === 'a_descontar' ? 'Marcar descontado' : 'Marcar pago'}
                </button>
              )}
            />
          </Card>
          <Card title="Histórico" className="mb-6">
            <TabelaEstornos estornos={liquidados} />
          </Card>
        </>
      )}

      <RelatorioPlataforma />

      <ConcluirModal estorno={concluindo} onClose={() => setConcluindo(null)} onDone={aposConcluir} />
      <LiquidarModal
        estorno={liquidando}
        onClose={() => setLiquidando(null)}
        onDone={() => {
          setLiquidando(null);
          load();
        }}
      />
    </div>
  );
};

export default Estornos;

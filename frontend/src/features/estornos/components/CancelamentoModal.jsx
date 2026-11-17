import React, { useEffect, useState } from 'react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import { estornosService } from '../../../api/services/estornos.service';
import { formatDate } from '../../../utils/formatters';
import { MOTIVOS_CANCELAMENTO, hojeBrasil } from '../constants';

const inputClass = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500';

// Etapa 1 do estorno (spec 005/RN-04): registra o aviso de cancelamento que o cliente deu.
// `apolice` = { id ou apolice_id, numero_apolice, cliente_nome }. onDone é chamado após registrar.
const CancelamentoModal = ({ apolice, onClose, onDone }) => {
  const [data, setData] = useState(hojeBrasil());
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    setData(hojeBrasil());
    setMotivo('');
    setDescricao('');
    setError(null);
    setResultado(null);
  }, [apolice]);

  if (!apolice) return null;
  const apoliceId = apolice.apolice_id ?? apolice.id;

  const registrar = async (e) => {
    e.preventDefault();
    if (!motivo) return setError('Escolha o motivo do cancelamento');
    if (motivo === 'outro' && !descricao.trim()) return setError('Descreva o motivo');
    setSaving(true);
    setError(null);
    try {
      const r = await estornosService.avisarCancelamento(apoliceId, {
        data_cancelamento: data,
        motivo,
        motivo_descricao: motivo === 'outro' ? descricao.trim() : null,
      });
      setResultado(r);
      onDone?.(r);
    } catch (err) {
      setError(err.message || 'Erro ao registrar o cancelamento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Registrar cancelamento" size="sm">
      <p className="text-sm text-gray-600 mb-4">
        Apólice <strong>{apolice.numero_apolice}</strong>
        {apolice.cliente_nome ? ` — ${apolice.cliente_nome}` : ''}
      </p>

      {resultado ? (
        <div className="space-y-4">
          {resultado.houve_estorno ? (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-sm text-orange-900">
              <p className="font-semibold mb-1">Cancelada com estorno</p>
              <p>
                O cancelamento ocorreu dentro do período de estorno (até {formatDate(resultado.fim_periodo_estorno)}).
                {resultado.repasse_cancelado && ' O repasse ainda não pago ao corretor foi cancelado.'} A gestão vai
                concluir o estorno com o valor cobrado pela plataforma.
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900">
              <p className="font-semibold mb-1">Cancelada sem estorno</p>
              <p>
                {resultado.fim_periodo_estorno
                  ? `O período de estorno terminou em ${formatDate(resultado.fim_periodo_estorno)}.`
                  : 'A tabela de comissão desta apólice não tem prazo de estorno.'}
              </p>
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={registrar} className="space-y-4">
          <div>
            <label htmlFor="canc-data" className="block text-sm font-medium text-gray-700 mb-1">
              Data do cancelamento *
            </label>
            <input id="canc-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputClass} required />
          </div>
          <div>
            <label htmlFor="canc-motivo" className="block text-sm font-medium text-gray-700 mb-1">
              Motivo *
            </label>
            <select id="canc-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputClass}>
              <option value="">Escolha o motivo</option>
              {MOTIVOS_CANCELAMENTO.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {motivo === 'outro' && (
            <div>
              <label htmlFor="canc-descricao" className="block text-sm font-medium text-gray-700 mb-1">
                Descrição *
              </label>
              <input
                id="canc-descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className={inputClass}
                placeholder="Ex.: mudou de cidade"
              />
            </div>
          )}
          <p className="text-xs text-gray-500">
            A apólice será cancelada e deixará de gerar comissões. Se a data estiver dentro do período de estorno, o
            sistema abre o estorno para a gestão concluir.
          </p>
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Voltar
            </Button>
            <Button type="submit" variant="danger" loading={saving} disabled={saving}>
              Registrar cancelamento
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default CancelamentoModal;

import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import Button from '../../../components/common/Button/Button';
import { MODALIDADES, cronograma, fmtPct } from '../comissao';
import { formatCurrency } from '../../../utils/formatters';

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const TabelaComissaoForm = ({ tabela, onSubmit, onCancel, saving }) => {
  const [form, setForm] = useState({
    nome: tabela?.nome ?? '',
    modalidade: tabela?.modalidade ?? 'todas',
    parcelas: (tabela?.percentuais_parcelas ?? [100]).map(String),
    vitalicio_percentual: tabela?.vitalicio_percentual ?? '',
    vitalicio_meses: tabela?.vitalicio_meses ?? '',
    estorno_meses: tabela?.estorno_meses ?? '',
    vigencia_inicio: tabela?.vigencia_inicio ?? '',
    vigencia_fim: tabela?.vigencia_fim ?? '',
    ativa: tabela?.ativa ?? true,
    observacoes: tabela?.observacoes ?? '',
  });
  const [simulacao, setSimulacao] = useState('1000');
  const [error, setError] = useState(null);

  const set = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));
  const setParcela = (i, valor) => set('parcelas', form.parcelas.map((p, j) => (j === i ? valor : p)));

  const percentuais = form.parcelas.filter((p) => p !== '').map(Number);
  const totalAgenciamento = percentuais.reduce((s, p) => s + (Number.isFinite(p) ? p : 0), 0);
  const temVitalicio = form.vitalicio_percentual !== '';

  const preview = {
    percentuais_parcelas: percentuais.filter(Number.isFinite),
    vitalicio_percentual: temVitalicio ? Number(form.vitalicio_percentual) : null,
    vitalicio_meses: form.vitalicio_meses === '' ? null : Number(form.vitalicio_meses),
  };
  const linhas = cronograma(preview, simulacao);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.nome.trim()) return setError('Dê um nome para a tabela (ex.: "Adesão — padrão")');
    if (form.parcelas.some((p) => p === '' || !Number.isFinite(Number(p)))) {
      return setError('Preencha o percentual de todas as parcelas ou remova as vazias');
    }
    if (form.parcelas.length === 0 && !temVitalicio) {
      return setError('Informe ao menos uma parcela de agenciamento ou o vitalício');
    }
    setError(null);
    onSubmit({
      ...form,
      percentuais_parcelas: form.parcelas.map(Number),
      vitalicio_percentual: temVitalicio ? Number(form.vitalicio_percentual) : null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="tc-nome">
            Nome da tabela *
          </label>
          <input
            id="tc-nome"
            type="text"
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            placeholder='Ex.: "Adesão — padrão", "PME 2 a 29 vidas"'
            className={inputClass}
            disabled={saving}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="tc-modalidade">
            Modalidade
          </label>
          <select
            id="tc-modalidade"
            value={form.modalidade}
            onChange={(e) => set('modalidade', e.target.value)}
            className={inputClass}
            disabled={saving}
          >
            {MODALIDADES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="px-1 text-sm font-semibold text-gray-700">Agenciamento por parcela</legend>
        <p className="text-xs text-gray-500 mb-3">
          Percentual sobre a mensalidade em cada parcela paga pelo cliente. Ex.: 100% na 1ª e 90% na 2ª.
        </p>
        <div className="flex flex-wrap gap-2">
          {form.parcelas.map((p, i) => (
            <div key={i} className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white pl-3 pr-1 py-1">
              <span className="text-xs font-medium text-gray-500 w-7">{i + 1}ª</span>
              <input
                type="number"
                min="0"
                max="1000"
                step="0.01"
                value={p}
                onChange={(e) => setParcela(i, e.target.value)}
                className="w-20 px-2 py-1 text-sm border-0 focus:ring-2 focus:ring-blue-500 rounded"
                aria-label={`Percentual da ${i + 1}ª parcela`}
                disabled={saving}
              />
              <span className="text-sm text-gray-500">%</span>
              <button
                type="button"
                onClick={() => set('parcelas', form.parcelas.filter((_, j) => j !== i))}
                className="p-1 text-gray-400 hover:text-red-600"
                aria-label={`Remover ${i + 1}ª parcela`}
                disabled={saving}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => set('parcelas', [...form.parcelas, ''])}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dashed border-blue-300 text-sm text-blue-700 hover:bg-blue-50"
            disabled={saving || form.parcelas.length >= 24}
          >
            <Plus size={14} /> Parcela
          </button>
        </div>
        {form.parcelas.length > 0 && (
          <p className="text-sm text-gray-700 mt-3">
            Total de agenciamento: <span className="font-semibold">{fmtPct(totalAgenciamento)}</span>
          </p>
        )}
      </fieldset>

      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="px-1 text-sm font-semibold text-gray-700">Vitalício e estorno</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass} htmlFor="tc-vit">
              Vitalício (%)
            </label>
            <input
              id="tc-vit"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.vitalicio_percentual}
              onChange={(e) => set('vitalicio_percentual', e.target.value)}
              placeholder="Sem vitalício"
              className={inputClass}
              disabled={saving}
            />
            <p className="text-xs text-gray-500 mt-1">A partir da {form.parcelas.length + 1}ª parcela</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="tc-vit-meses">
              Vitalício por (meses)
            </label>
            <input
              id="tc-vit-meses"
              type="number"
              min="1"
              step="1"
              value={form.vitalicio_meses}
              onChange={(e) => set('vitalicio_meses', e.target.value)}
              placeholder="Enquanto ativo"
              className={inputClass}
              disabled={saving || !temVitalicio}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="tc-estorno">
              Estorno se cancelar em até (meses)
            </label>
            <input
              id="tc-estorno"
              type="number"
              min="0"
              step="1"
              value={form.estorno_meses}
              onChange={(e) => set('estorno_meses', e.target.value)}
              placeholder="Sem regra"
              className={inputClass}
              disabled={saving}
            />
          </div>
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <label className={labelClass} htmlFor="tc-ini">
            Vigência — início
          </label>
          <input
            id="tc-ini"
            type="date"
            value={form.vigencia_inicio}
            onChange={(e) => set('vigencia_inicio', e.target.value)}
            className={inputClass}
            disabled={saving}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="tc-fim">
            Vigência — fim
          </label>
          <input
            id="tc-fim"
            type="date"
            value={form.vigencia_fim}
            onChange={(e) => set('vigencia_fim', e.target.value)}
            className={inputClass}
            disabled={saving}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 pb-2">
          <input
            type="checkbox"
            checked={form.ativa}
            onChange={(e) => set('ativa', e.target.checked)}
            className="w-4 h-4 accent-blue-600"
            disabled={saving}
          />
          Tabela ativa
        </label>
      </div>

      <div>
        <label className={labelClass} htmlFor="tc-obs">
          Observações
        </label>
        <textarea
          id="tc-obs"
          value={form.observacoes}
          onChange={(e) => set('observacoes', e.target.value)}
          rows="2"
          placeholder="Ex.: válido para planos Infinity e Black; pago via assessoria X"
          className={inputClass}
          disabled={saving}
        />
      </div>

      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-gray-700">Simulação para mensalidade de</span>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-500">R$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={simulacao}
              onChange={(e) => setSimulacao(e.target.value)}
              className="w-32 pl-8 pr-2 py-1 text-sm border border-gray-300 rounded-lg"
              aria-label="Valor da mensalidade para simular"
            />
          </div>
        </div>
        {linhas.length === 0 ? (
          <p className="text-sm text-gray-500">Informe as parcelas ou o vitalício para simular.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="font-medium py-1">Parcela</th>
                <th className="font-medium py-1">Tipo</th>
                <th className="font-medium py-1 text-right">%</th>
                <th className="font-medium py-1 text-right">Comissão</th>
              </tr>
            </thead>
            <tbody className="text-gray-800">
              {linhas.map((l) => (
                <tr key={l.parcela} className="border-t border-gray-200">
                  <td className="py-1">{l.parcela}ª</td>
                  <td className="py-1">{l.tipo}</td>
                  <td className="py-1 text-right">{fmtPct(l.percentual)}</td>
                  <td className="py-1 text-right font-medium">{formatCurrency(l.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {temVitalicio && (
          <p className="text-xs text-gray-500 mt-2">
            Vitalício segue{' '}
            {form.vitalicio_meses ? `por ${form.vitalicio_meses} meses no total` : 'enquanto o contrato estiver ativo'}
            ; a tabela mostra só as primeiras parcelas.
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" variant="primary" className="flex-1" loading={saving} disabled={saving}>
          {tabela ? 'Salvar tabela' : 'Criar tabela'}
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={saving}>
          Voltar
        </Button>
      </div>
    </form>
  );
};

export default TabelaComissaoForm;

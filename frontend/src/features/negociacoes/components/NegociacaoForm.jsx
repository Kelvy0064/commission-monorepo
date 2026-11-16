import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Button from '../../../components/common/Button/Button';
import { ETAPAS, STATUS_NEGOCIACAO } from '../constants';

const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm';
const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

const NegociacaoForm = ({
  negociacao,
  clientes,
  corretores,
  onSubmit,
  onDelete,
  onCancel,
  saving,
  readOnly = false,
  esconderCorretor = false,
}) => {
  const [form, setForm] = useState({
    cliente_id: negociacao?.cliente_id ?? '',
    corretor_id: negociacao?.corretor_id ?? '',
    titulo: negociacao?.titulo ?? '',
    etapa: negociacao?.etapa ?? ETAPAS[0].id,
    status: negociacao?.status ?? 'em_andamento',
    motivo_perda: negociacao?.motivo_perda ?? '',
    proxima_acao: negociacao?.proxima_acao ?? '',
    proxima_acao_em: negociacao?.proxima_acao_em ?? '',
    observacoes: negociacao?.observacoes ?? '',
  });
  const [buscaCliente, setBuscaCliente] = useState('');
  const [error, setError] = useState(null);

  const set = (campo, valor) => setForm((prev) => ({ ...prev, [campo]: valor }));

  // Lista filtrada pela busca; o cliente selecionado continua visível mesmo fora do filtro
  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, '');
    if (!termo) return clientes;
    return clientes.filter(
      (c) =>
        String(c.id) === String(form.cliente_id) ||
        c.nome.toLowerCase().includes(termo) ||
        (digitos && (c.telefone || '').replace(/\D/g, '').includes(digitos))
    );
  }, [clientes, buscaCliente, form.cliente_id]);

  // Corretores ativos, mais o atual mesmo que inativo
  const corretoresDisponiveis = corretores.filter(
    (c) => c.status === 'ativo' || String(c.id) === String(form.corretor_id)
  );

  const handleCliente = (clienteId) => {
    set('cliente_id', clienteId);
    // Sugere o corretor do cliente se ainda não houver corretor escolhido
    const cliente = clientes.find((c) => String(c.id) === clienteId);
    if (cliente?.corretor_id && !form.corretor_id) set('corretor_id', String(cliente.corretor_id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.cliente_id) {
      setError('Selecione o cliente');
      return;
    }
    setError(null);
    onSubmit({
      ...form,
      cliente_id: Number(form.cliente_id),
      corretor_id: form.corretor_id === '' ? null : Number(form.corretor_id),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Somente leitura (ex.: pós-venda) desabilita todos os campos */}
      <fieldset disabled={readOnly} className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="neg-cliente">
          Cliente *
        </label>
        <input
          type="search"
          value={buscaCliente}
          onChange={(e) => setBuscaCliente(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          className={`${inputClass} mb-2`}
          disabled={saving}
          aria-label="Buscar cliente"
        />
        <select
          id="neg-cliente"
          value={form.cliente_id}
          onChange={(e) => handleCliente(e.target.value)}
          className={`${inputClass} ${error ? 'border-red-500' : ''}`}
          disabled={saving}
        >
          <option value="">Selecione... ({clientesFiltrados.length})</option>
          {clientesFiltrados.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
              {c.telefone ? ` — ${c.telefone}` : ''}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>

      <div>
        <label className={labelClass} htmlFor="neg-titulo">
          Título
        </label>
        <input
          id="neg-titulo"
          type="text"
          value={form.titulo}
          onChange={(e) => set('titulo', e.target.value)}
          placeholder="Ex.: MedSênior casal 72 e 75"
          className={inputClass}
          disabled={saving}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Corretor logado: a negociação é sempre dele (a API força) */}
        {!esconderCorretor && (
          <div>
            <label className={labelClass} htmlFor="neg-corretor">
              Corretor
            </label>
            <select
              id="neg-corretor"
              value={form.corretor_id}
              onChange={(e) => set('corretor_id', e.target.value)}
              className={inputClass}
              disabled={saving}
            >
              <option value="">Sem corretor</option>
              {corretoresDisponiveis.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                  {c.status !== 'ativo' ? ' (inativo)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="neg-etapa">
            Etapa
          </label>
          <select
            id="neg-etapa"
            value={form.etapa}
            onChange={(e) => set('etapa', e.target.value)}
            className={inputClass}
            disabled={saving}
          >
            {ETAPAS.map((etapa) => (
              <option key={etapa.id} value={etapa.id}>
                {etapa.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="neg-status">
            Status
          </label>
          <select
            id="neg-status"
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
            className={inputClass}
            disabled={saving}
          >
            {Object.entries(STATUS_NEGOCIACAO).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {form.status === 'perdida' && (
        <div>
          <label className={labelClass} htmlFor="neg-motivo">
            Motivo da perda
          </label>
          <input
            id="neg-motivo"
            type="text"
            value={form.motivo_perda}
            onChange={(e) => set('motivo_perda', e.target.value)}
            placeholder="Ex.: achou caro, fechou com outra corretora"
            className={inputClass}
            disabled={saving}
          />
        </div>
      )}

      <fieldset className="border border-gray-200 rounded-lg p-4">
        <legend className="px-1 text-sm font-semibold text-gray-700">Próxima ação</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="neg-acao">
              O que fazer
            </label>
            <input
              id="neg-acao"
              type="text"
              value={form.proxima_acao}
              onChange={(e) => set('proxima_acao', e.target.value)}
              placeholder="Ex.: Mensagem periódica 30 dias"
              className={inputClass}
              disabled={saving}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="neg-acao-em">
              Quando
            </label>
            <input
              id="neg-acao-em"
              type="datetime-local"
              value={form.proxima_acao_em}
              onChange={(e) => set('proxima_acao_em', e.target.value)}
              className={inputClass}
              disabled={saving}
            />
          </div>
        </div>
      </fieldset>

      <div>
        <label className={labelClass} htmlFor="neg-obs">
          Observações
        </label>
        <textarea
          id="neg-obs"
          value={form.observacoes}
          onChange={(e) => set('observacoes', e.target.value)}
          rows="3"
          className={inputClass}
          disabled={saving}
        />
      </div>

      </fieldset>

      <div className="flex flex-wrap gap-3 pt-2">
        {!readOnly && (
          <Button type="submit" variant="primary" className="flex-1" loading={saving} disabled={saving}>
            {negociacao ? 'Salvar' : 'Criar negociação'}
          </Button>
        )}
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={saving}>
          {readOnly ? 'Fechar' : 'Cancelar'}
        </Button>
        {negociacao && onDelete && !readOnly && (
          <Button type="button" variant="danger" icon={Trash2} onClick={onDelete} disabled={saving}>
            Excluir
          </Button>
        )}
      </div>
    </form>
  );
};

export default NegociacaoForm;

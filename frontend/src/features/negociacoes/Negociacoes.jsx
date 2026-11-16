import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckSquare, Plus, RefreshCw, Search, Users, X } from 'lucide-react';
import { useNegociacoes } from './hooks/useNegociacoes';
import KanbanBoard from './components/KanbanBoard';
import NegociacaoForm from './components/NegociacaoForm';
import DistribuirModal from './components/DistribuirModal';
import { ETAPAS, situacaoProximaAcao, STATUS_NEGOCIACAO } from './constants';
import { negociacoesService } from '../../api/services/negociacoes.service';
import Modal from '../../components/common/Modal/Modal';
import Button from '../../components/common/Button/Button';
import Alert from '../../components/common/Alert/Alert';
import Spinner from '../../components/common/Spinner/Spinner';
import { clientesService } from '../../api/services/clientes.service';
import { corretoresService } from '../../api/services/corretores.service';
import { useAuth } from '../../context/AuthContext';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white';

const Negociacoes = () => {
  const { negociacoes, loading, error, filtros, updateFiltro, limparFiltros, moverEtapa, save, remove, refresh } =
    useNegociacoes();
  const { user, pode } = useAuth();
  const ehCorretor = user?.role === 'corretor';

  const [corretores, setCorretores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [modal, setModal] = useState({ open: false, negociacao: null });
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null);

  // Modo seleção (distribuir em lote)
  const [selecionando, setSelecionando] = useState(false);
  const [selecionadas, setSelecionadas] = useState(() => new Set());
  const [distribuirAberto, setDistribuirAberto] = useState(false);

  // Só conta o que está visível no quadro (filtros podem esconder cartões já marcados).
  // Ordem do quadro: coluna a coluna, para o rodízio misturar etapas entre os corretores.
  const idsSelecionados = useMemo(
    () =>
      ETAPAS.flatMap((etapa) =>
        negociacoes.filter((n) => n.etapa === etapa.id && selecionadas.has(n.id)).map((n) => n.id)
      ),
    [negociacoes, selecionadas]
  );
  const selecionadasVisiveis = useMemo(() => new Set(idsSelecionados), [idsSelecionados]);

  const toggleSelect = useCallback((negociacao) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(negociacao.id)) next.delete(negociacao.id);
      else next.add(negociacao.id);
      return next;
    });
  }, []);

  const selectMany = useCallback((lista, marcar) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      lista.forEach((n) => (marcar ? next.add(n.id) : next.delete(n.id)));
      return next;
    });
  }, []);

  const sairSelecao = () => {
    setSelecionando(false);
    setSelecionadas(new Set());
  };

  const handleDistribuir = async (corretorIds) => {
    setSaving(true);
    try {
      const result = await negociacoesService.distribuir(idsSelecionados, corretorIds);
      setDistribuirAberto(false);
      sairSelecao();
      await refresh();
      showAlert('success', `${result.total} negociação(ões) distribuída(s) entre ${corretorIds.length} corretor(es)`);
      return true;
    } catch (err) {
      showAlert('error', err.message || 'Erro ao distribuir negociações');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    corretoresService.getOpcoes().then(setCorretores).catch(() => setCorretores([]));
  }, []);

  const showAlert = useCallback((type, message) => {
    setAlert({ type, message });
    if (type === 'success') setTimeout(() => setAlert(null), 3000);
  }, []);

  // Recarrega clientes ao abrir o formulário, para incluir leads que acabaram de chegar
  const openModal = (negociacao = null) => {
    setModal({ open: true, negociacao });
    clientesService.getAll().then(setClientes).catch(() => setClientes([]));
  };
  const closeModal = () => setModal({ open: false, negociacao: null });

  const handleSubmit = async (data) => {
    setSaving(true);
    const result = await save(modal.negociacao?.id, data);
    setSaving(false);
    if (result.success) {
      closeModal();
      showAlert('success', modal.negociacao ? 'Negociação atualizada!' : 'Negociação criada!');
    } else {
      showAlert('error', result.error || 'Erro ao salvar negociação');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Excluir esta negociação? Essa ação não pode ser desfeita.')) return;
    setSaving(true);
    const result = await remove(modal.negociacao.id);
    setSaving(false);
    if (result.success) {
      closeModal();
      showAlert('success', 'Negociação excluída');
    } else {
      showAlert('error', result.error || 'Erro ao excluir negociação');
    }
  };

  const handleMove = async (negociacao, etapa) => {
    const result = await moverEtapa(negociacao, etapa);
    if (!result.success) showAlert('error', result.error || 'Não foi possível mover a negociação');
  };

  const atrasadas = negociacoes.filter((n) => situacaoProximaAcao(n.proxima_acao_em) === 'atrasada').length;
  const hoje = negociacoes.filter((n) => situacaoProximaAcao(n.proxima_acao_em) === 'hoje').length;
  const semAcao = negociacoes.filter((n) => !n.proxima_acao && !n.proxima_acao_em).length;
  const temFiltro = filtros.busca || filtros.corretor_id || filtros.status !== 'em_andamento';

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Negociações</h1>
          <p className="text-gray-600">Funil de vendas para acompanhamento na daily</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={RefreshCw} onClick={refresh} disabled={loading} loading={loading}>
            Atualizar
          </Button>
          {!selecionando && pode('negociacoes.distribuir') && (
            <Button variant="secondary" icon={CheckSquare} onClick={() => setSelecionando(true)}>
              Distribuir
            </Button>
          )}
          {pode('negociacoes.criar') && (
            <Button variant="primary" icon={Plus} onClick={() => openModal()}>
              Nova negociação
            </Button>
          )}
        </div>
      </div>

      {selecionando && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 mb-4 px-4 py-3 rounded-xl bg-blue-900 text-white shadow-lg">
          <span className="text-sm font-medium">
            {idsSelecionados.length} selecionada(s)
            <span className="font-normal text-blue-200"> — clique nos cartões para marcar</span>
          </span>
          <div className="flex flex-wrap gap-2 ml-auto">
            <button
              type="button"
              onClick={() => selectMany(negociacoes, true)}
              className="px-3 py-1.5 rounded-lg text-sm hover:bg-blue-800"
            >
              Selecionar todas ({negociacoes.length})
            </button>
            <button
              type="button"
              onClick={() => setSelecionadas(new Set())}
              disabled={idsSelecionados.length === 0}
              className="px-3 py-1.5 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-40"
            >
              Limpar
            </button>
            <Button
              variant="secondary"
              size="sm"
              icon={Users}
              onClick={() => setDistribuirAberto(true)}
              disabled={idsSelecionados.length === 0}
            >
              Escolher corretores
            </Button>
            <button
              type="button"
              onClick={sairSelecao}
              className="px-3 py-1.5 rounded-lg text-sm hover:bg-blue-800"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      {error && !alert && <Alert type="error" message={error} onClose={refresh} />}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end mb-3">
        <div className="md:col-span-5">
          <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={filtros.busca}
              onChange={(e) => updateFiltro('busca', e.target.value)}
              placeholder="Cliente, título ou próxima ação"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
        {/* Corretor vê só as próprias negociações: filtro por corretor não se aplica */}
        {!ehCorretor && (
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Corretor</label>
            <select
              value={filtros.corretor_id}
              onChange={(e) => updateFiltro('corretor_id', e.target.value)}
              className={inputClass}
            >
              <option value="">Todos</option>
              <option value="sem">Sem corretor</option>
              {corretores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            value={filtros.status}
            onChange={(e) => updateFiltro('status', e.target.value)}
            className={inputClass}
          >
            {Object.entries(STATUS_NEGOCIACAO).map(([id, s]) => (
              <option key={id} value={id}>
                {s.label}
              </option>
            ))}
            <option value="">Todos</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <button
            type="button"
            onClick={limparFiltros}
            disabled={!temFiltro}
            className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={16} />
            Limpar filtros
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <span className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-gray-700">
          {negociacoes.length} negociação(ões)
        </span>
        {atrasadas > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">{atrasadas} atrasada(s)</span>
        )}
        {hoje > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-medium">{hoje} para hoje</span>
        )}
        {semAcao > 0 && (
          <span className="px-2.5 py-1 rounded-full bg-gray-200 text-gray-700">{semAcao} sem próxima ação</span>
        )}
      </div>

      {loading && negociacoes.length === 0 ? (
        <Spinner />
      ) : (
        <div className={`transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <KanbanBoard
            negociacoes={negociacoes}
            onOpen={openModal}
            onMove={handleMove}
            podeMover={pode('negociacoes.editar')}
            selectionMode={selecionando}
            selectedIds={selecionadasVisiveis}
            onToggleSelect={toggleSelect}
            onSelectMany={selectMany}
          />
        </div>
      )}

      <DistribuirModal
        isOpen={distribuirAberto}
        total={idsSelecionados.length}
        corretores={corretores}
        onConfirm={handleDistribuir}
        onClose={() => setDistribuirAberto(false)}
        saving={saving}
      />

      <Modal
        isOpen={modal.open}
        onClose={closeModal}
        title={modal.negociacao ? (pode('negociacoes.editar') ? 'Editar negociação' : 'Negociação') : 'Nova negociação'}
      >
        <NegociacaoForm
          key={modal.negociacao?.id ?? 'nova'}
          negociacao={modal.negociacao}
          clientes={clientes}
          corretores={corretores}
          onSubmit={handleSubmit}
          onDelete={pode('negociacoes.excluir') ? handleDelete : null}
          onCancel={closeModal}
          saving={saving}
          readOnly={Boolean(modal.negociacao) && !pode('negociacoes.editar')}
          esconderCorretor={ehCorretor}
        />
      </Modal>
    </div>
  );
};

export default Negociacoes;

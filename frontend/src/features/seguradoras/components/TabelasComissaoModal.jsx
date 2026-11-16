import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';
import Spinner from '../../../components/common/Spinner/Spinner';
import TabelaComissaoForm from './TabelaComissaoForm';
import { seguradorasService } from '../../../api/services/seguradoras.service';
import { modalidadeLabel, resumoTabela } from '../comissao';
import { formatDate } from '../../../utils/formatters';

const TabelasComissaoModal = ({ seguradora, onClose, onChanged }) => {
  const [tabelas, setTabelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // null = lista; { tabela: null } = nova; { tabela } = editar
  const [editando, setEditando] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTabelas(await seguradorasService.getTabelas(seguradora.id));
      setError(null);
    } catch (err) {
      setError(err.message || 'Erro ao carregar tabelas');
    } finally {
      setLoading(false);
    }
  }, [seguradora.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (data) => {
    setSaving(true);
    try {
      if (editando.tabela) await seguradorasService.updateTabela(editando.tabela.id, data);
      else await seguradorasService.createTabela(seguradora.id, data);
      setEditando(null);
      await load();
      onChanged();
    } catch (err) {
      setError(err.message || 'Erro ao salvar tabela');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tabela) => {
    if (!window.confirm(`Excluir a tabela "${tabela.nome}"?`)) return;
    try {
      await seguradorasService.deleteTabela(tabela.id);
      await load();
      onChanged();
    } catch (err) {
      setError(err.message || 'Erro ao excluir tabela');
    }
  };

  const titulo = editando
    ? `${editando.tabela ? 'Editar' : 'Nova'} tabela de comissão — ${seguradora.nome}`
    : `Tabelas de comissão — ${seguradora.nome}`;

  return (
    <Modal isOpen onClose={onClose} title={titulo} size="lg">
      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      {editando ? (
        <TabelaComissaoForm
          key={editando.tabela?.id ?? 'nova'}
          tabela={editando.tabela}
          onSubmit={handleSubmit}
          onCancel={() => setEditando(null)}
          saving={saving}
        />
      ) : loading ? (
        <Spinner />
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            As apólices que usam uma tabela geram as comissões parcela a parcela por ela. O corretor recebe repasse
            apenas da <strong>1ª parcela</strong> — o percentual do cadastro dele sobre o valor efetivamente recebido. As
            demais parcelas ficam com a corretora.
          </p>

          {tabelas.length === 0 && (
            <p className="text-sm text-gray-500 py-4">
              Nenhuma tabela cadastrada. Crie uma tabela para cada regra de comissão do contrato (por produto,
              modalidade ou campanha).
            </p>
          )}

          {tabelas.map((t) => (
            <div
              key={t.id}
              className={`rounded-lg border p-4 ${t.ativa ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-70'}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800">
                    {t.nome}
                    {!t.ativa && <span className="ml-2 text-xs font-normal text-gray-500">(inativa)</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {modalidadeLabel(t.modalidade)}
                    {(t.vigencia_inicio || t.vigencia_fim) &&
                      ` · vigência ${t.vigencia_inicio ? formatDate(t.vigencia_inicio) : '…'} a ${
                        t.vigencia_fim ? formatDate(t.vigencia_fim) : '…'
                      }`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditando({ tabela: t })}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-blue-700"
                    aria-label={`Editar ${t.nome}`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t)}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-red-600"
                    aria-label={`Excluir ${t.nome}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-700 mt-2">{resumoTabela(t)}</p>
              {t.estorno_meses != null && (
                <p className="text-xs text-gray-500 mt-1">
                  Estorno se o cliente cancelar em até {t.estorno_meses} {t.estorno_meses === 1 ? 'mês' : 'meses'}
                </p>
              )}
              {t.observacoes && <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{t.observacoes}</p>}
            </div>
          ))}

          <Button variant="primary" icon={Plus} onClick={() => setEditando({ tabela: null })}>
            Nova tabela de comissão
          </Button>
        </div>
      )}
    </Modal>
  );
};

export default TabelasComissaoModal;

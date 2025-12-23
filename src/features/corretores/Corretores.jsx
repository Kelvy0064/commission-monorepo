import React, { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useCorretores } from './hooks/useCorretores';
import CorretoresTable from './components/CorretoresTable';
import CorretorForm from '../../components/forms/CorretorForm/CorretorForm';
import Modal from '../../components/common/Modal/Modal';
import Button from '../../components/common/Button/Button';
import Alert from '../../components/common/Alert/Alert';
import { useModal } from '../../hooks/useModal';

const Corretores = () => {
  const {
    corretores,
    loading,
    error,
    createCorretor,
    updateCorretor,
    deleteCorretor,
    refresh,
  } = useCorretores();

  const { isOpen, modalData, openModal, closeModal } = useModal();
  const [alert, setAlert] = useState(null);

  const handleCreate = () => {
    openModal(null);
  };

  const handleEdit = (corretor) => {
    openModal(corretor);
  };

  const handleSubmit = async (formData) => {
    const result = modalData
      ? await updateCorretor(modalData.id, formData)
      : await createCorretor(formData);

    if (result.success) {
      closeModal();
      setAlert({
        type: 'success',
        message: modalData 
          ? 'Corretor atualizado com sucesso!' 
          : 'Corretor criado com sucesso!',
      });
      setTimeout(() => setAlert(null), 3000);
    } else {
      setAlert({
        type: 'error',
        message: result.error || 'Erro ao salvar corretor',
      });
    }
  };

  const handleDelete = async (id) => {
    const result = await deleteCorretor(id);
    
    if (result.success) {
      setAlert({
        type: 'success',
        message: 'Corretor excluído com sucesso!',
      });
      setTimeout(() => setAlert(null), 3000);
    } else if (!result.cancelled) {
      setAlert({
        type: 'error',
        message: result.error || 'Erro ao excluir corretor',
      });
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Corretores</h1>
        <p className="text-gray-600">Gerencie os corretores da sua equipe</p>
      </div>

      {/* Alert */}
      {alert && (
        <Alert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Error */}
      {error && !alert && (
        <Alert
          type="error"
          message={error}
          onClose={() => setAlert(null)}
        />
      )}

      {/* Actions */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Total: <span className="font-semibold">{corretores.length}</span> corretor(es)
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              icon={RefreshCw}
              onClick={refresh}
              disabled={loading}
              loading={loading}
            >
              Atualizar
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={handleCreate}
            >
              Novo Corretor
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <CorretoresTable
          corretores={corretores}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      {/* Modal */}
      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={modalData ? 'Editar Corretor' : 'Novo Corretor'}
        size="md"
      >
        <CorretorForm
          corretor={modalData}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          loading={loading}
        />
      </Modal>
    </div>
  );
};

export default Corretores;

import React, { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useSeguradoras } from './hooks/useSeguradoras';
import SeguradorasTable from './components/SeguradorasTable';
import TabelasComissaoModal from './components/TabelasComissaoModal';
import SeguradoraForm from '../../components/forms/SeguradoraForm/SeguradoraForm';
import Modal from '../../components/common/Modal/Modal';
import Button from '../../components/common/Button/Button';
import Alert from '../../components/common/Alert/Alert';
import Card from '../../components/common/Card/Card';
import { useModal } from '../../hooks/useModal';
import { useAuth } from '../../context/AuthContext';

const Seguradoras = () => {
  const { pode } = useAuth();
  const podeEditar = pode('seguradoras.editar');
  const { seguradoras, loading, error, createSeguradora, updateSeguradora, deleteSeguradora, refresh } = useSeguradoras();
  const { isOpen, modalData, openModal, closeModal } = useModal();
  const [alert, setAlert] = useState(null);
  const [comissoesDe, setComissoesDe] = useState(null);

  const handleSubmit = async (formData) => {
    const result = modalData
      ? await updateSeguradora(modalData.id, formData)
      : await createSeguradora(formData);

    if (result.success) {
      closeModal();
      setAlert({
        type: 'success',
        message: modalData ? 'Seguradora atualizada com sucesso!' : 'Seguradora criada com sucesso!',
      });
      setTimeout(() => setAlert(null), 3000);
    } else {
      setAlert({ type: 'error', message: result.error || 'Erro ao salvar seguradora' });
    }
  };

  const handleDelete = async (id) => {
    const result = await deleteSeguradora(id);
    if (result.success) {
      setAlert({ type: 'success', message: 'Seguradora excluída com sucesso!' });
      setTimeout(() => setAlert(null), 3000);
    } else if (!result.cancelled) {
      setAlert({ type: 'error', message: result.error || 'Erro ao excluir seguradora' });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Seguradoras</h1>
        <p className="text-gray-600">Gerencie as seguradoras parceiras</p>
      </div>

      {alert && <Alert type={alert.type} message={alert.message} onClose={() => setAlert(null)} />}
      {error && !alert && <Alert type="error" message={error} onClose={() => setAlert(null)} />}

      <Card
        className="mb-6"
        actions={
          <>
            <Button variant="secondary" icon={RefreshCw} onClick={refresh} disabled={loading} loading={loading}>
              Atualizar
            </Button>
            {podeEditar && (
              <Button variant="primary" icon={Plus} onClick={() => openModal(null)}>
                Nova Seguradora
              </Button>
            )}
          </>
        }
      >
        <div className="text-sm text-gray-600">
          Total: <span className="font-semibold">{seguradoras.length}</span> seguradora(s)
        </div>
      </Card>

      <Card>
        <SeguradorasTable
          seguradoras={seguradoras}
          loading={loading}
          onEdit={openModal}
          onDelete={handleDelete}
          onComissoes={pode('tabelas_comissao.ver') ? setComissoesDe : null}
          podeEditar={podeEditar}
        />
      </Card>

      {comissoesDe && (
        <TabelasComissaoModal
          seguradora={comissoesDe}
          onClose={() => setComissoesDe(null)}
          onChanged={refresh}
          readOnly={!pode('tabelas_comissao.editar')}
        />
      )}

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={modalData ? (podeEditar ? 'Editar Seguradora' : 'Seguradora') : 'Nova Seguradora'}
      >
        <SeguradoraForm
          seguradora={modalData}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          loading={loading}
          readOnly={!podeEditar}
        />
      </Modal>
    </div>
  );
};

export default Seguradoras;
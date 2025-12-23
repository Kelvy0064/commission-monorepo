import React, { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useClientes } from './hooks/useClientes';
import ClientesTable from './components/ClientesTable';
import ClienteForm from '../../components/forms/ClienteForm/ClienteForm';
import Modal from '../../components/common/Modal/Modal';
import Button from '../../components/common/Button/Button';
import Alert from '../../components/common/Alert/Alert';
import Card from '../../components/common/Card/Card';
import { useModal } from '../../hooks/useModal';

const Clientes = () => {
  const { clientes, loading, error, createCliente, updateCliente, deleteCliente, refresh } = useClientes();
  const { isOpen, modalData, openModal, closeModal } = useModal();
  const [alert, setAlert] = useState(null);

  const handleSubmit = async (formData) => {
    const result = modalData
      ? await updateCliente(modalData.id, formData)
      : await createCliente(formData);

    if (result.success) {
      closeModal();
      setAlert({
        type: 'success',
        message: modalData ? 'Cliente atualizado com sucesso!' : 'Cliente criado com sucesso!',
      });
      setTimeout(() => setAlert(null), 3000);
    } else {
      setAlert({ type: 'error', message: result.error || 'Erro ao salvar cliente' });
    }
  };

  const handleDelete = async (id) => {
    const result = await deleteCliente(id);
    if (result.success) {
      setAlert({ type: 'success', message: 'Cliente excluído com sucesso!' });
      setTimeout(() => setAlert(null), 3000);
    } else if (!result.cancelled) {
      setAlert({ type: 'error', message: result.error || 'Erro ao excluir cliente' });
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Clientes</h1>
        <p className="text-gray-600">Gerencie seus clientes</p>
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
            <Button variant="primary" icon={Plus} onClick={() => openModal(null)}>
              Novo Cliente
            </Button>
          </>
        }
      >
        <div className="text-sm text-gray-600">
          Total: <span className="font-semibold">{clientes.length}</span> cliente(s)
        </div>
      </Card>

      <Card>
        <ClientesTable clientes={clientes} loading={loading} onEdit={openModal} onDelete={handleDelete} />
      </Card>

      <Modal isOpen={isOpen} onClose={closeModal} title={modalData ? 'Editar Cliente' : 'Novo Cliente'}>
        <ClienteForm cliente={modalData} onSubmit={handleSubmit} onCancel={closeModal} loading={loading} />
      </Modal>
    </div>
  );
};

export default Clientes;
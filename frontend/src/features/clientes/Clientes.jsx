import React, { useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useClientes } from './hooks/useClientes';
import ClientesTable from './components/ClientesTable';
import ClientesFilters from './components/ClientesFilters';
import ClienteForm from '../../components/forms/ClienteForm/ClienteForm';
import Modal from '../../components/common/Modal/Modal';
import Pagination from '../../components/common/Pagination/Pagination';
import Button from '../../components/common/Button/Button';
import Alert from '../../components/common/Alert/Alert';
import Card from '../../components/common/Card/Card';
import { useModal } from '../../hooks/useModal';
import { useAuth } from '../../context/AuthContext';

const Clientes = () => {
  const { pode } = useAuth();
  const {
    clientes,
    loading,
    error,
    filtros,
    updateFiltro,
    limparFiltros,
    page,
    pageSize,
    total,
    totalPages,
    setPage,
    setPageSize,
    createCliente,
    updateCliente,
    deleteCliente,
    refresh,
  } = useClientes();
  const temFiltro = Object.values(filtros).some(Boolean);
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
            {pode('clientes.criar') && (
              <Button variant="primary" icon={Plus} onClick={() => openModal(null)}>
                Novo Cliente
              </Button>
            )}
          </>
        }
      >
        <ClientesFilters filtros={filtros} onChange={updateFiltro} onClear={limparFiltros} />
        <div className="text-sm text-gray-600 mt-3">
          {temFiltro ? 'Encontrados' : 'Total'}: <span className="font-semibold">{total}</span> cliente(s)
        </div>
      </Card>

      <Card>
        <ClientesTable
          clientes={clientes}
          loading={loading}
          emptyMessage={temFiltro ? 'Nenhum cliente encontrado com esses filtros' : 'Nenhum cliente cadastrado'}
          onEdit={openModal}
          onDelete={handleDelete}
          podeEditar={pode('clientes.editar')}
          podeExcluir={pode('clientes.excluir')}
        />
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          disabled={loading}
        />
      </Card>

      <Modal
        isOpen={isOpen}
        onClose={closeModal}
        title={modalData ? (pode('clientes.editar') ? 'Editar Cliente' : 'Cliente') : 'Novo Cliente'}
      >
        <ClienteForm
          cliente={modalData}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          loading={loading}
          readOnly={Boolean(modalData) && !pode('clientes.editar')}
        />
      </Modal>
    </div>
  );
};

export default Clientes;
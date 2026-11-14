import React, { useState, useEffect } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { useApolices } from './hooks/useApolices';
import ApolicesTable from './components/ApolicesTable';
import ApoliceForm from '../../components/forms/ApoliceForm/ApoliceForm';
import Modal from '../../components/common/Modal/Modal';
import Button from '../../components/common/Button/Button';
import Alert from '../../components/common/Alert/Alert';
import Card from '../../components/common/Card/Card';
import { useModal } from '../../hooks/useModal';
// ADICIONAR ESTES IMPORTS
import { corretoresService } from '../../api/services/corretores.service';
import { seguradorasService } from '../../api/services/seguradoras.service';
import { clientesService } from '../../api/services/clientes.service';

const Apolices = () => {
  const { apolices, loading, error, createApolice, updateApolice, deleteApolice, refresh } = useApolices();
  const { isOpen, modalData, openModal, closeModal } = useModal();
  const [alert, setAlert] = useState(null);
  
  // ADICIONAR ESTES ESTADOS
  const [corretores, setCorretores] = useState([]);
  const [seguradoras, setSeguradoras] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loadingFormData, setLoadingFormData] = useState(false);

  // ADICIONAR ESTE useEffect
  useEffect(() => {
    loadFormData();
  }, []);

  // ADICIONAR ESTA FUNÇÃO
  const loadFormData = async () => {
    setLoadingFormData(true);
    try {
      const [corretoresData, seguradorasData, clientesData] = await Promise.all([
        corretoresService.getAll(),
        seguradorasService.getAll(),
        clientesService.getAll(),
      ]);
      
      console.log('Dados carregados:', {
        corretores: corretoresData.length,
        seguradoras: seguradorasData.length,
        clientes: clientesData.length,
      });
      
      setCorretores(corretoresData);
      setSeguradoras(seguradorasData);
      setClientes(clientesData);
    } catch (err) {
      console.error('Erro ao carregar dados do formulário:', err);
      setAlert({ type: 'error', message: 'Erro ao carregar dados do formulário' });
    } finally {
      setLoadingFormData(false);
    }
  };

  const handleSubmit = async (formData) => {
    const result = modalData
      ? await updateApolice(modalData.id, formData)
      : await createApolice(formData);

    if (result.success) {
      closeModal();
      setAlert({
        type: 'success',
        message: modalData ? 'Apólice atualizada com sucesso!' : 'Apólice criada com sucesso!',
      });
      setTimeout(() => setAlert(null), 3000);
    } else {
      setAlert({ type: 'error', message: result.error || 'Erro ao salvar apólice' });
    }
  };

  const handleDelete = async (id) => {
    const result = await deleteApolice(id);
    if (result.success) {
      setAlert({ type: 'success', message: 'Apólice excluída com sucesso!' });
      setTimeout(() => setAlert(null), 3000);
    } else if (!result.cancelled) {
      setAlert({ type: 'error', message: result.error || 'Erro ao excluir apólice' });
    }
  };

  const apolicesAtivas = apolices.filter(a => a.status === 'ativa').length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Apólices</h1>
        <p className="text-gray-600">Gerencie as apólices de seguros</p>
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
              Nova Apólice
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            Total: <span className="font-semibold">{apolices.length}</span> apólice(s)
          </div>
          <div>
            Ativas: <span className="font-semibold text-green-600">{apolicesAtivas}</span>
          </div>
        </div>
      </Card>

      <Card>
        <ApolicesTable apolices={apolices} loading={loading} onEdit={openModal} onDelete={handleDelete} />
      </Card>

      <Modal isOpen={isOpen} onClose={closeModal} title={modalData ? 'Editar Apólice' : 'Nova Apólice'} size="lg">
        {/* IMPORTANTE: PASSAR AS PROPS */}
        <ApoliceForm
          apolice={modalData}
          onSubmit={handleSubmit}
          onCancel={closeModal}
          loading={loading || loadingFormData}
          corretores={corretores}
          seguradoras={seguradoras}
          clientes={clientes}
        />
      </Modal>
    </div>
  );
};

export default Apolices;
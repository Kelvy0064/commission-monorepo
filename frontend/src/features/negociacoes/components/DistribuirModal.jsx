import React, { useState } from 'react';
import { Users } from 'lucide-react';
import Modal from '../../../components/common/Modal/Modal';
import Button from '../../../components/common/Button/Button';

// Quantas negociações cada corretor recebe no rodízio (os primeiros ficam com a sobra)
const previa = (total, quantidade) =>
  Array.from({ length: quantidade }, (_, i) => Math.floor(total / quantidade) + (i < total % quantidade ? 1 : 0));

const DistribuirModal = ({ isOpen, total, corretores, onConfirm, onClose, saving }) => {
  const [escolhidos, setEscolhidos] = useState([]);

  const ativos = corretores.filter((c) => c.status === 'ativo');
  const toggle = (id) =>
    setEscolhidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const quantidades = previa(total, escolhidos.length);
  const nomePorId = Object.fromEntries(ativos.map((c) => [c.id, c.nome]));

  const close = () => {
    setEscolhidos([]);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={`Distribuir ${total} negociação(ões)`} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Escolha um ou mais corretores. Com mais de um, as negociações são divididas igualmente entre eles. O
          cliente de cada negociação também recebe o corretor, se ainda não tiver um.
        </p>

        {ativos.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum corretor ativo cadastrado.</p>
        ) : (
          <fieldset className="space-y-1 max-h-64 overflow-y-auto">
            <legend className="sr-only">Corretores</legend>
            {ativos.map((c) => (
              <label key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={escolhidos.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="w-4 h-4 accent-blue-600"
                  disabled={saving}
                />
                <span className="text-sm text-gray-800">{c.nome}</span>
              </label>
            ))}
          </fieldset>
        )}

        {escolhidos.length > 0 && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm">
            <p className="font-medium text-blue-900 mb-1">Prévia</p>
            <ul className="space-y-0.5 text-blue-900">
              {escolhidos.map((id, i) => (
                <li key={id} className="flex justify-between gap-2">
                  <span className="truncate">{nomePorId[id]}</span>
                  <span className="font-semibold shrink-0">{quantidades[i]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="primary"
            icon={Users}
            className="flex-1"
            onClick={async () => {
              const ok = await onConfirm(escolhidos);
              if (ok) setEscolhidos([]);
            }}
            disabled={saving || escolhidos.length === 0 || total === 0}
            loading={saving}
          >
            Distribuir
          </Button>
          <Button variant="secondary" className="flex-1" onClick={close} disabled={saving}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DistribuirModal;

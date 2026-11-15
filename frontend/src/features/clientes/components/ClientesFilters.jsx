import React, { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { corretoresService } from '../../../api/services/corretores.service';
import { STATUS } from '../../../utils/constants';

const inputClass =
  'w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm';

const ClientesFilters = ({ filtros, onChange, onClear }) => {
  const [corretores, setCorretores] = useState([]);

  useEffect(() => {
    corretoresService
      .getAll()
      .then(setCorretores)
      .catch(() => setCorretores([]));
  }, []);

  const temFiltro = Object.values(filtros).some(Boolean);

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
      <div className="md:col-span-5">
        <label className="block text-xs font-medium text-gray-600 mb-1">Buscar</label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={filtros.busca}
            onChange={(e) => onChange('busca', e.target.value)}
            placeholder="Nome, CPF/CNPJ, email ou telefone"
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      <div className="md:col-span-3">
        <label className="block text-xs font-medium text-gray-600 mb-1">Corretor</label>
        <select
          value={filtros.corretor_id}
          onChange={(e) => onChange('corretor_id', e.target.value)}
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

      <div className="md:col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
        <select
          value={filtros.status}
          onChange={(e) => onChange('status', e.target.value)}
          className={inputClass}
        >
          <option value="">Todos</option>
          <option value={STATUS.LEAD}>Lead</option>
          <option value={STATUS.ATIVO}>Ativo</option>
          <option value={STATUS.INATIVO}>Inativo</option>
          <option value={STATUS.CANCELADO}>Cancelado</option>
        </select>
      </div>

      <div className="md:col-span-2">
        <button
          type="button"
          onClick={onClear}
          disabled={!temFiltro}
          className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X size={16} />
          Limpar filtros
        </button>
      </div>
    </div>
  );
};

export default ClientesFilters;

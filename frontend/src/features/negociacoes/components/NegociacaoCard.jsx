import React from 'react';
import { CalendarClock, User } from 'lucide-react';
import { STATUS_NEGOCIACAO, situacaoProximaAcao, formatDataHora } from '../constants';

const ACAO_STYLES = {
  atrasada: 'bg-red-100 text-red-700',
  hoje: 'bg-amber-100 text-amber-800',
  futura: 'bg-gray-100 text-gray-700',
};

const ACAO_PREFIX = {
  atrasada: 'Atrasada · ',
  hoje: 'Hoje · ',
  futura: '',
};

const NegociacaoCard = ({
  negociacao,
  onOpen,
  onDragStart,
  onDragEnd,
  dragging,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}) => {
  const status = STATUS_NEGOCIACAO[negociacao.status] || STATUS_NEGOCIACAO.em_andamento;
  const situacao = situacaoProximaAcao(negociacao.proxima_acao_em);
  const temAcao = negociacao.proxima_acao || negociacao.proxima_acao_em;

  // No modo seleção, clicar marca/desmarca; fora dele, abre a negociação
  const activate = () => (selectionMode ? onToggleSelect(negociacao) : onOpen(negociacao));

  const stateClasses = selected
    ? 'border-blue-500 ring-2 ring-blue-500 bg-blue-50'
    : 'border-gray-200 bg-white hover:border-blue-300';

  return (
    <div
      role={selectionMode ? 'checkbox' : 'button'}
      aria-checked={selectionMode ? selected : undefined}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      }}
      draggable={!selectionMode}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(negociacao.id));
        onDragStart(negociacao);
      }}
      onDragEnd={onDragEnd}
      onClick={activate}
      className={`w-full text-left rounded-lg border p-3 shadow-sm hover:shadow-md transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${stateClasses} ${
        selectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${dragging ? 'opacity-40' : ''}`}
    >
      <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1.5">
        {selectionMode && (
          <input
            type="checkbox"
            checked={selected}
            readOnly
            tabIndex={-1}
            aria-hidden="true"
            className="w-4 h-4 mr-1 accent-blue-600 pointer-events-none"
          />
        )}
        <span className={`w-2 h-2 rounded-sm ${status.dot}`} aria-hidden="true" />
        {status.label}
      </div>

      <p className="text-sm font-semibold text-gray-800 leading-snug break-words">{negociacao.cliente_nome}</p>
      {negociacao.titulo && <p className="text-xs text-gray-500 mt-0.5 break-words">{negociacao.titulo}</p>}

      <div className="flex items-center gap-1 text-xs text-gray-500 mt-2">
        <User className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{negociacao.corretor_nome || 'Sem corretor'}</span>
      </div>

      {temAcao ? (
        <div
          className={`flex items-start gap-1.5 mt-2 px-2 py-1.5 rounded-md text-xs font-medium ${
            ACAO_STYLES[situacao] || ACAO_STYLES.futura
          }`}
        >
          <CalendarClock className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
          <span className="break-words">
            {ACAO_PREFIX[situacao] || ''}
            {negociacao.proxima_acao || 'Próxima ação'}
            {negociacao.proxima_acao_em && ` — ${formatDataHora(negociacao.proxima_acao_em)}`}
          </span>
        </div>
      ) : (
        <p className="mt-2 text-xs italic text-gray-400">Sem próxima ação</p>
      )}
    </div>
  );
};

export default NegociacaoCard;

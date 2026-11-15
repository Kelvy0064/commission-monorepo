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

const NegociacaoCard = ({ negociacao, onOpen, onDragStart, onDragEnd, dragging }) => {
  const status = STATUS_NEGOCIACAO[negociacao.status] || STATUS_NEGOCIACAO.em_andamento;
  const situacao = situacaoProximaAcao(negociacao.proxima_acao_em);
  const temAcao = negociacao.proxima_acao || negociacao.proxima_acao_em;

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(negociacao);
        }
      }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(negociacao.id));
        onDragStart(negociacao);
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(negociacao)}
      className={`w-full text-left bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md hover:border-blue-300 transition cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-blue-500 ${
        dragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-center gap-1.5 text-xs text-gray-600 mb-1.5">
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

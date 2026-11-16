import React, { useState } from 'react';
import NegociacaoCard from './NegociacaoCard';
import { ETAPAS, situacaoProximaAcao } from '../constants';

const KanbanBoard = ({
  negociacoes,
  onOpen,
  onMove,
  podeMover = true,
  selectionMode = false,
  selectedIds = new Set(),
  onToggleSelect,
  onSelectMany,
}) => {
  const [arrastando, setArrastando] = useState(null);
  const [colunaAlvo, setColunaAlvo] = useState(null);

  const handleDrop = (etapa) => {
    if (arrastando) onMove(arrastando, etapa);
    setArrastando(null);
    setColunaAlvo(null);
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
      {ETAPAS.map((etapa) => {
        const cards = negociacoes.filter((n) => n.etapa === etapa.id);
        const atrasadas = cards.filter((n) => situacaoProximaAcao(n.proxima_acao_em) === 'atrasada').length;
        const isAlvo = colunaAlvo === etapa.id && arrastando?.etapa !== etapa.id;
        const colunaToda = cards.length > 0 && cards.every((n) => selectedIds.has(n.id));

        return (
          <section
            key={etapa.id}
            aria-label={etapa.label}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (colunaAlvo !== etapa.id) setColunaAlvo(etapa.id);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setColunaAlvo(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(etapa.id);
            }}
            className={`flex flex-col shrink-0 w-72 rounded-xl border transition-colors ${
              isAlvo ? 'bg-blue-50 border-blue-300' : 'bg-gray-100 border-gray-200'
            }`}
          >
            <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-700 truncate">
                {etapa.label} <span className="font-normal text-gray-500">({cards.length})</span>
              </h2>
              {selectionMode && cards.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onSelectMany(cards, !colunaToda)}
                  className="shrink-0 text-xs font-medium text-blue-700 hover:underline"
                >
                  {colunaToda ? 'Desmarcar' : 'Selecionar todas'}
                </button>
              ) : (
                atrasadas > 0 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                    {atrasadas} atrasada{atrasadas > 1 ? 's' : ''}
                  </span>
                )
              )}
            </header>

            <div className="flex flex-col gap-2 p-2 min-h-[8rem] max-h-[calc(100vh-17rem)] overflow-y-auto">
              {cards.map((negociacao) => (
                <NegociacaoCard
                  key={negociacao.id}
                  negociacao={negociacao}
                  onOpen={onOpen}
                  onDragStart={setArrastando}
                  onDragEnd={() => {
                    setArrastando(null);
                    setColunaAlvo(null);
                  }}
                  dragging={arrastando?.id === negociacao.id}
                  selectionMode={selectionMode}
                  podeArrastar={podeMover}
                  selected={selectedIds.has(negociacao.id)}
                  onToggleSelect={onToggleSelect}
                />
              ))}
              {cards.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">Nenhuma negociação</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default KanbanBoard;

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// Números de página a exibir, com "…" quando houver muitas páginas: 1 … 4 5 6 … 20
const getPageNumbers = (page, totalPages) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['…', p] : [p]));
};

const Pagination = ({ page, pageSize, total, totalPages, onPageChange, onPageSizeChange, disabled }) => {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const buttonBase =
    'min-w-[2.25rem] h-9 px-2 inline-flex items-center justify-center rounded-lg text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-gray-200">
      <div className="flex items-center gap-3 text-sm text-gray-600">
        <span>
          Mostrando <span className="font-semibold">{from}</span>–<span className="font-semibold">{to}</span> de{' '}
          <span className="font-semibold">{total}</span>
        </span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className="px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          disabled={disabled}
          aria-label="Itens por página"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} por página
            </option>
          ))}
        </select>
      </div>

      <nav className="flex items-center gap-1" aria-label="Paginação">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={disabled || page <= 1}
          className={`${buttonBase} text-gray-700 hover:bg-gray-100`}
          aria-label="Página anterior"
        >
          <ChevronLeft size={18} />
        </button>

        {getPageNumbers(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap-${i}`} className="px-1 text-gray-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              disabled={disabled}
              aria-current={p === page ? 'page' : undefined}
              className={`${buttonBase} ${
                p === page ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={disabled || page >= totalPages}
          className={`${buttonBase} text-gray-700 hover:bg-gray-100`}
          aria-label="Próxima página"
        >
          <ChevronRight size={18} />
        </button>
      </nav>
    </div>
  );
};

export default Pagination;

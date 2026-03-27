'use client';

import { useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPage: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPage, onPageChange }: PaginationProps) {
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  }, [currentPage, onPageChange]);

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPage) onPageChange(currentPage + 1);
  }, [currentPage, totalPage, onPageChange]);

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={goToPreviousPage}
        disabled={currentPage === 1}
        className="p-2 hover:bg-surface-subtle rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Página anterior"
      >
        <ChevronLeft size={20} className="text-content-muted" />
      </button>
      <span className="text-[14px] font-normal text-content-secondary">
        Página <span className="font-semibold">{currentPage}</span> de{' '}
        <span className="font-semibold">{totalPage}</span>
      </span>
      <button
        onClick={goToNextPage}
        disabled={currentPage === totalPage}
        className="p-2 hover:bg-surface-subtle rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Próxima página"
      >
        <ChevronRight size={20} className="text-content-muted" />
      </button>
    </div>
  );
}

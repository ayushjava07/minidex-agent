import { useMemo, useState } from "react";

export function usePagination({ total = 0, initialPage = 1, perPage = 20 } = {}) {
  const [page, setPage] = useState(initialPage);
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  const pages = useMemo(() => {
    const range = [];
    const maxVisible = 5;
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  }, [page, totalPages]);

  return { page, setPage, totalPages, pages, hasNext: page < totalPages, hasPrev: page > 1, next: () => setPage(p => Math.min(p + 1, totalPages)), prev: () => setPage(p => Math.max(p - 1, 1)) };
}

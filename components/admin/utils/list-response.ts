export interface LegacyPagination {
  page?: number;
  totalPages?: number;
  total?: number;
  limit?: number;
}

export interface LegacyListResponse<T> {
  data?: T[];
  pagination?: LegacyPagination;
}

export interface ResolvedPagination {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
}

export function resolveListResponse<T>(
  payload: LegacyListResponse<T> | T[],
  pageSize: number,
  currentPage: number
): { items: T[]; pagination: ResolvedPagination } {
  const items = Array.isArray(payload) ? payload : payload?.data ?? [];
  const pagination = Array.isArray(payload) ? undefined : payload?.pagination;

  const limit = typeof pagination?.limit === 'number' && pagination.limit > 0 ? pagination.limit : pageSize;
  const total = typeof pagination?.total === 'number' ? pagination.total : items.length;
  const totalPagesFromPayload = typeof pagination?.totalPages === 'number' ? pagination.totalPages : undefined;
  const totalPages = Math.max(1, totalPagesFromPayload ?? (limit > 0 ? Math.ceil(total / limit) : 1));
  const pageFromPayload = typeof pagination?.page === 'number' ? pagination.page : undefined;
  const page = pageFromPayload && pageFromPayload > 0 ? pageFromPayload : currentPage > 0 ? currentPage : 1;

  return {
    items,
    pagination: {
      page,
      totalPages,
      total,
      limit
    }
  };
}

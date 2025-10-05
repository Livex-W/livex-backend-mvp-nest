export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  offset: number;
  search?: string;
  sort?: string[];
}

export interface SortOption {
  field: string;
  direction: 'ASC' | 'DESC';
}

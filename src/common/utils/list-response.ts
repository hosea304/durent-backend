/** Bentuk list konsisten: { data: [], meta } — FE state empty = array kosong + meta.total (FRONTEND_PREPARATION §3). */
export interface ListMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ListResponse<T> {
  data: T[];
  meta: ListMeta;
}

export function listResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): ListResponse<T> {
  return { data, meta: { page, limit, total } };
}

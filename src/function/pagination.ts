import { DEFAULT_PAGE_NUMBER, DEFAULT_PAGE_LIMIT } from "../config/constants";

interface PaginatedResult<T> {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  prevPage: number | null; // Use null for no prev/next page for clarity
  nextPage: number | null;
  itemPerPage: number;
  data: T[];
}

/**
 * Paginates an array of data or formats pagination metadata if data is already sliced.
 *
 * @param data - The array of data items to paginate OR the pre-sliced data for the current page.
 * @param page - The current page number (1-indexed). Defaults to `DEFAULT_PAGE_NUMBER`.
 * @param limit - The number of items per page. Defaults to `DEFAULT_PAGE_LIMIT`.
 * @param totalItemsOverride - Optional. If provided, this value is used as the total number of items,
 *                             assuming `data` is already the paginated slice for the current page.
 *                             If not provided, `data.length` is used as totalItems and `data` will be sliced.
 * @returns A paginated result object.
 */
export const paginateResults = <T>(
  data: T[],
  page?: number,
  limit?: number,
  totalItemsOverride?: number
): PaginatedResult<T> => {
    const currentPage = (page && !isNaN(page) && page > 0) ? page : DEFAULT_PAGE_NUMBER;
    const pageSize = (limit && !isNaN(limit) && limit > 0) ? limit : DEFAULT_PAGE_LIMIT;

    const totalItems = totalItemsOverride !== undefined ? totalItemsOverride : data.length;
    const totalPages = Math.ceil(totalItems / pageSize);

    let paginatedData = data;
    // If totalItemsOverride is not provided, it means 'data' is the full dataset that needs slicing.
    // If totalItemsOverride IS provided, it means 'data' is already the pre-sliced data for the current page.
    if (totalItemsOverride === undefined) {
        const startIndex = (currentPage - 1) * pageSize;
        paginatedData = data.slice(startIndex, startIndex + pageSize);
    }

    return {
      totalItems,
      totalPages,
      currentPage,
      prevPage: currentPage > 1 ? currentPage - 1 : null,
      nextPage: currentPage < totalPages ? currentPage + 1 : null,
      itemPerPage: pageSize,
      data: paginatedData,
    };
  };

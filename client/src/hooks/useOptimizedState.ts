import { useState, useTransition, useDeferredValue, useCallback } from 'react';

export function useOptimizedSearch(initialValue = '') {
  const [searchValue, setSearchValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(searchValue);

  const handleSearch = useCallback((value: string) => {
    startTransition(() => {
      setSearchValue(value);
    });
  }, []);

  return {
    searchValue,
    deferredSearch,
    isPending,
    handleSearch,
    setSearchValue: handleSearch,
  };
}

export function useOptimizedFilter<T>(initialValue: T) {
  const [filterValue, setFilterValue] = useState<T>(initialValue);
  const [isPending, startTransition] = useTransition();
  const deferredFilter = useDeferredValue(filterValue);

  const handleFilter = useCallback((value: T) => {
    startTransition(() => {
      setFilterValue(value);
    });
  }, []);

  return {
    filterValue,
    deferredFilter,
    isPending,
    handleFilter,
    setFilterValue: handleFilter,
  };
}

export function useDeferredList<T>(items: T[]) {
  const deferredItems = useDeferredValue(items);
  return deferredItems;
}

export function useNonBlockingUpdate<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  const setValueNonBlocking = useCallback((newValue: T | ((prev: T) => T)) => {
    startTransition(() => {
      setValue(newValue);
    });
  }, []);

  return [value, setValueNonBlocking, isPending] as const;
}

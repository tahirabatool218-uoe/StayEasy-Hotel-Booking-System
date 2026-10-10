import { useCallback, useEffect, useState } from 'react';
import { getApiError } from '../utils/errors';

// Loads data from a *stable* fetcher (a service method or a useCallback) and
// exposes { status, data, error, reload, setData }. State is only written from
// promise callbacks and event handlers, never synchronously inside the effect.
export default function useApiData(fetcher, fallbackMessage) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    fetcher()
      .then((data) => active && setState({ status: 'success', data, error: '' }))
      .catch((err) => active && setState({ status: 'error', data: null, error: getApiError(err, fallbackMessage) }));
    return () => {
      active = false;
    };
  }, [fetcher, fallbackMessage, nonce]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, status: 'loading', error: '' }));
    setNonce((n) => n + 1);
  }, []);

  const setData = useCallback((updater) => {
    setState((prev) => ({ ...prev, data: typeof updater === 'function' ? updater(prev.data) : updater }));
  }, []);

  return { ...state, reload, setData };
}

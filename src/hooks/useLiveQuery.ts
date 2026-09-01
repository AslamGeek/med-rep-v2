import { useEffect, useState } from 'react'

export function useLiveQuery<T>(query: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [data, setData] = useState<T>()

  useEffect(() => {
    let cancelled = false
    const run = () => {
      void query().then((value) => {
        if (!cancelled) setData(value)
      })
    }
    run()
    const onChange = () => run()
    window.addEventListener('medrep-db', onChange)
    return () => {
      cancelled = true
      window.removeEventListener('medrep-db', onChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return data
}

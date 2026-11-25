import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

/** Listens live to any collection. */
export function useCollection<T>(name: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, name),
      (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T));
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      }
    );
    return unsub;
  }, [name]);

  return { data, loading, error };
}

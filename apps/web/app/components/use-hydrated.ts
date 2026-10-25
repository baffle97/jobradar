import { useEffect, useState } from "react";

// false on the server and during hydration, true after; lets forms add a
// "js=1" field without a hydration mismatch.
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

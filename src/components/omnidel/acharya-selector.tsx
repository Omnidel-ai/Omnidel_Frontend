"use client";

import { useState, useEffect, createContext, useContext, useCallback } from "react";
import { CustomSelect } from "@/components/omnidel/custom-select";
import { useTr } from "@/lib/client/language";

const STORAGE_KEY = "omnidel-selected-acharya";

interface Acharya {
  id: string;
  slug: string;
  display_name: string;
  is_active: boolean;
}

interface AcharyaContextValue {
  acharya: string;
  acharyaId: string;
  acharyas: Acharya[];
  setAcharya: (slug: string) => void;
  loading: boolean;
}

const AcharyaContext = createContext<AcharyaContextValue>({
  acharya: "",
  acharyaId: "",
  acharyas: [],
  setAcharya: () => {},
  loading: true,
});

export function useAcharya() {
  return useContext(AcharyaContext);
}

function getSaved(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function AcharyaProvider({ children }: { children: React.ReactNode }) {
  const [acharyas, setAcharyas] = useState<Acharya[]>([]);
  const [selected, setSelected] = useState(getSaved);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/acharyas")
      .then(r => r.json())
      .then(d => {
        const items = (d.items || d.acharyas || []) as Acharya[];
        setAcharyas(items);
        const saved = getSaved();
        if (!saved && items.length > 0) {
          setSelected(items[0].slug);
          localStorage.setItem(STORAGE_KEY, items[0].slug);
        } else if (saved && !items.find(a => a.slug === saved) && items.length > 0) {
          setSelected(items[0].slug);
          localStorage.setItem(STORAGE_KEY, items[0].slug);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const setAcharya = useCallback((slug: string) => {
    setSelected(slug);
    localStorage.setItem(STORAGE_KEY, slug);
  }, []);

  const current = acharyas.find(a => a.slug === selected) || acharyas[0];

  return (
    <AcharyaContext.Provider value={{
      acharya: current?.slug || "",
      acharyaId: current?.id || "",
      acharyas,
      setAcharya,
      loading,
    }}>
      {children}
    </AcharyaContext.Provider>
  );
}

export function AcharyaDropdown() {
  const tr = useTr();
  const { acharya, acharyas, setAcharya } = useAcharya();

  if (acharyas.length <= 1) return null;

  return (
    <CustomSelect
      value={acharya}
      onChange={setAcharya}
      placeholder={tr("Select Acharya")}
      options={acharyas.map(a => ({ value: a.slug, label: a.display_name }))}
    />
  );
}

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { Datos, Gasto, MetaAhorro, ProductoSirena, Recurrente, CompraSirena } from '../lib/tipos';

export interface TodosLosDatos extends Datos {
  recurrentes: Recurrente[];
  productos: ProductoSirena[];
  metas: MetaAhorro[];
  compras: CompraSirena[];
}

/** Carga todo en memoria (son pocos datos) y se actualiza sola cuando cambia la base. */
export function useDatos(): TodosLosDatos | undefined {
  return useLiveQuery(async () => {
    const [ajustes, categorias, gastos, ingresos, depositos, diasLibres, planificados, recurrentes, productos, metas, compras] = await Promise.all([
      db.ajustes.get('ajustes'), db.categorias.orderBy('orden').toArray(), db.gastos.toArray(), db.ingresos.toArray(),
      db.depositos.toArray(), db.diasLibres.toArray(), db.planificados.toArray(), db.recurrentes.toArray(),
      db.productos.orderBy('orden').toArray(), db.metas.toArray(), db.compras.toArray(),
    ]);
    if (!ajustes) return undefined;
    const ordenRec = ['rec-pasaje', 'rec-gimnasio', 'rec-whey', 'rec-creatina'];
    const pos = (id: string) => (ordenRec.includes(id) ? ordenRec.indexOf(id) : 99);
    recurrentes.sort((a, b) => pos(a.id) - pos(b.id) || a.nombre.localeCompare(b.nombre));
    return { ajustes, categorias, gastos, ingresos, depositos, diasLibres, planificados, recurrentes, productos, metas, compras };
  });
}

// ---- Avisos (toast con deshacer) ----

interface Aviso { texto: string; accion?: { etiqueta: string; fn: () => void } }
interface Ui {
  avisar: (texto: string, accion?: Aviso['accion']) => void;
  abrirGasto: (g?: Gasto) => void;
}

const UiCtx = createContext<Ui>({ avisar: () => {}, abrirGasto: () => {} });
export const useUi = () => useContext(UiCtx);

export function ProveedorUi({ children, abrirGasto }: { children: ReactNode; abrirGasto: (g?: Gasto) => void }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const t = useRef<number | undefined>(undefined);
  const avisar = useCallback((texto: string, accion?: Aviso['accion']) => {
    window.clearTimeout(t.current);
    setAviso({ texto, accion });
    t.current = window.setTimeout(() => setAviso(null), accion ? 6000 : 3500);
  }, []);
  useEffect(() => () => window.clearTimeout(t.current), []);
  return (
    <UiCtx.Provider value={{ avisar, abrirGasto }}>
      {children}
      <div aria-live="polite" className="sr">{aviso?.texto}</div>
      {aviso && (
        <div className="toast" role="status">
          <span>{aviso.texto}</span>
          {aviso.accion && (
            <button onClick={() => { aviso.accion!.fn(); setAviso(null); }}>{aviso.accion.etiqueta}</button>
          )}
        </div>
      )}
    </UiCtx.Provider>
  );
}

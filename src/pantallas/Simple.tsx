import { useState } from 'react';
import { db } from '../db/db';
import { nuevoId, rd } from '../lib/formato';
import type { Ajustes } from '../lib/tipos';
import { CeldaNumero } from '../ui/comunes';

type Apartado = NonNullable<Ajustes['apartados']>[number];

export const APARTADOS_INICIALES: Apartado[] = [
  { id: 'ap-sirena', nombre: 'Sirena (dieta)', monto: 3974 },
  { id: 'ap-transporte', nombre: 'Transporte', monto: 4200 },
];

const LISTA_SIRENA: [string, string, number][] = [
  ['Huevos Wala (30 u)', '4 cartones', 820],
  ['Leche entera Wala 1 L', '17 cartones', 1003],
  ['Yogurt bebible Wala 8 oz', '15 botellas', 585],
  ['Mantequilla de maní Wala 12 oz', '1 frasco', 214],
  ['Guineos', '10 lb', 200],
  ['Avena integral Wala 600 g', '2 fundas', 98],
  ['Pan viga blanco Wala 820 g', '2 panes', 210],
  ['Queso Gouda Wala en lonjas', '2 paquetes', 440],
  ['Atún Zerca en aceite 170 g', '4 latas', 224],
  ['Lechuga dulce', '5 unidades', 180],
];

/** Vista sencilla: lo que gano por quincena, lo que aparto y lo que me queda. */
export function Simple({ a }: { a: Ajustes }) {
  const apartados = a.apartados ?? APARTADOS_INICIALES;
  const guardar = (lista: Apartado[]) => db.ajustes.update('ajustes', { apartados: lista });
  const total = apartados.reduce((s, x) => s + x.monto, 0);
  const queda = a.ingresoQuincenal - total;
  const [verLista, setVerLista] = useState(false);

  return (
    <main className="pila">
      <h1 className="sr">Mi quincena</h1>

      <section className="tarjeta pila">
        <label className="campo"><span>Lo que gano cada quincena (RD$)</span>
          <CeldaNumero etiqueta="Ingreso por quincena" valor={a.ingresoQuincenal} onCambio={(n) => db.ajustes.update('ajustes', { ingresoQuincenal: n })} />
        </label>
      </section>

      <section className="tarjeta">
        <h2>Apartar cada quincena</h2>
        <ul className="lista">
          {apartados.map((x, i) => (
            <li key={x.id} className="pila" style={{ gap: 6 }}>
              <div className="fila" style={{ gap: 8 }}>
                <input type="text" value={x.nombre} aria-label="Nombre" maxLength={40} style={{ flex: 1, minWidth: 0 }}
                  onChange={(e) => guardar(apartados.map((y, j) => (j === i ? { ...y, nombre: e.target.value } : y)))} />
                <div style={{ width: 120 }}>
                  <CeldaNumero etiqueta={`Monto de ${x.nombre}`} valor={x.monto} onCambio={(n) => guardar(apartados.map((y, j) => (j === i ? { ...y, monto: n } : y)))} />
                </div>
                <button className="btn plano" aria-label={`Quitar ${x.nombre}`} onClick={() => guardar(apartados.filter((_, j) => j !== i))}>✕</button>
              </div>
              {x.id === 'ap-sirena' && (
                <button className="btn plano chico" style={{ alignSelf: 'flex-start' }} onClick={() => setVerLista(!verLista)}>
                  {verLista ? 'Ocultar lista' : 'Ver lista de la Sirena'}
                </button>
              )}
              {x.id === 'ap-sirena' && verLista && (
                <ul className="lista chico">
                  {LISTA_SIRENA.map(([p, c, m]) => (
                    <li key={p} className="fila"><span>{p} <span className="sec">· {c}</span></span><span className="num">{rd(m)}</span></li>
                  ))}
                  <li className="fila fuerte"><span>Total</span><span className="num">{rd(LISTA_SIRENA.reduce((s, r) => s + r[2], 0))}</span></li>
                </ul>
              )}
            </li>
          ))}
        </ul>
        <button className="btn" style={{ marginTop: 10 }} onClick={() => guardar([...apartados, { id: nuevoId(), nombre: 'Otro', monto: 0 }])}>+ Agregar</button>
      </section>

      <section className={`heroe ${queda < 0 ? 'excedido' : ''}`}>
        <div className="fila"><span className="sec">Gano</span><span className="num">{rd(a.ingresoQuincenal)}</span></div>
        <div className="fila"><span className="sec">Aparto</span><span className="num">− {rd(total)}</span></div>
        <div className="etq" style={{ marginTop: 10 }}>Me queda cada quincena</div>
        <div className="cifra-grande">{rd(queda)}</div>
      </section>
    </main>
  );
}

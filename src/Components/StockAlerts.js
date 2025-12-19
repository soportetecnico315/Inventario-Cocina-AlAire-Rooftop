import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

const StockAlerts = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const inventoryCollection = collection(db, 'inventory');
    const q = query(inventoryCollection, orderBy('name'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inventoryData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInventory(inventoryData);
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener el inventario para las alertas: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const lowStockItems = useMemo(() =>
    inventory.filter(item => item.bodega <= item.stockMin)
  , [inventory]);

  return (
    <div className="report-section">
      <h3>Productos con Stock Bajo ({lowStockItems.length})</h3>
      <p>Estos productos tienen una cantidad en <strong>bodega</strong> igual o inferior a su stock mínimo definido.</p>
      {loading ? <p>Cargando reporte...</p> : (
        <div className="table-responsive-wrapper">
          <table className="report-table">
            <thead>
              <tr><th>Producto</th><th>Stock en Bodega</th><th>Stock Mínimo</th><th>Stock Total</th></tr>
            </thead>
            <tbody>
              {lowStockItems.length > 0 ? lowStockItems.map(item => (
                <tr key={item.id} className="low-stock-row">
                  <td data-label="Producto">{item.name}</td><td data-label="Stock en Bodega">{item.bodega}</td><td data-label="Stock Mínimo">{item.stockMin}</td><td data-label="Stock Total">{item.bodega + item.cocina}</td>
                </tr>
              )) : (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>¡Excelente! No hay productos con stock bajo en bodega.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default StockAlerts;
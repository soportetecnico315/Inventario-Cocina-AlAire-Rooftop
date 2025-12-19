import React, { useState, useEffect, useMemo } from 'react';
import { rt_db } from '../firebase';
import { ref, onValue, query, orderByChild } from 'firebase/database';

const StockAlerts = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const inventoryRef = ref(rt_db, 'inventory');
    const q = query(inventoryRef, orderByChild('name'));

    const unsubscribe = onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const inventoryList = Object.keys(data).map(key => {
          const itemData = data[key];
          return {
            id: key,
            ...itemData,
            bodega: Number(itemData.bodega || 0),
            cocina: Number(itemData.cocina || 0),
            stockMin: Number(itemData.stockMin || 0),
          };
        });
        setInventory(inventoryList);
      } else {
        setInventory([]);
      }
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
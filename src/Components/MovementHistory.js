import React, { useState, useEffect } from 'react';
import { rt_db } from '../firebase'; // Cambiamos a Realtime Database
import { ref, onValue, query, orderByChild } from 'firebase/database';
import './MovementHistory.css';

const MovementHistory = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(15);

  useEffect(() => {
    const movementsRef = ref(rt_db, 'movements');
    // Ordenamos por 'timestamp'. En RTDB, esto funciona mejor si los timestamps son números negativos.
    // Por ahora, lo dejaremos así y lo ajustaremos si el orden no es el esperado.
    const q = query(movementsRef, orderByChild('timestamp'));

    const unsubscribe = onValue(q, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const movementsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).reverse(); // Invertimos para mostrar los más recientes primero
        setMovements(movementsList);
      } else {
        setMovements([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error al obtener el historial de movimientos: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = movements.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(movements.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="config-section">
      <h3>Historial de Movimientos</h3>
      <div className="history-filters">
        {/* Aquí podrían ir filtros por fecha o responsable en el futuro */}
      </div>

      {loading ? <p>Cargando historial...</p> : (
        <div className="table-responsive-wrapper">
          <table className="admin-table history-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th>Cantidad</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? currentItems.map(mov => (
                <tr key={mov.id}>
                  <td data-label="Fecha">{mov.timestamp ? new Date(mov.timestamp).toLocaleString('es-ES') : 'N/A'}</td>
                  <td data-label="Producto">{mov.productName}</td>
                  <td data-label="Tipo">{mov.type}</td>
                  <td data-label="Cantidad">{mov.quantity}</td>
                  <td data-label="Responsable">{mov.responsible}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center' }}>No hay movimientos que coincidan con los filtros.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav className="pagination">
          <button
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className="pagination-btn">
            Anterior
          </button>
          <span style={{ padding: '0 10px' }}>
            Página {currentPage} de {totalPages}
          </span>
          <button
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="pagination-btn">
            Siguiente
          </button>
        </nav>
      )}
    </div>
  );
};

export default MovementHistory;
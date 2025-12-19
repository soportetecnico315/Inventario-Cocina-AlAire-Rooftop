import React, { useState, useEffect, useMemo } from 'react';
import { rt_db } from '../firebase'; // Cambiamos a Realtime Database
import { ref, onValue, query, orderByChild, startAt, endAt, get } from 'firebase/database';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Estilos del calendario
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import './Reporte.css';

// Registrar los componentes de Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const Reporte = () => {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [movementDates, setMovementDates] = useState([]); // Cambiamos a fechas de movimientos
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState(''); // 'diario', 'semanal', 'mensual'
  const [chartData, setChartData] = useState(null);
  const [reportTitle, setReportTitle] = useState(''); // Nuevo estado para el título del reporte

  // 1. Cargar inventario y fechas de movimientos desde Realtime Database
  useEffect(() => {
    const inventoryRef = ref(rt_db, 'inventory');
    const unsubscribeInv = onValue(inventoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const inventoryList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setInventory(inventoryList);
      } else {
        setInventory([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error al cargar el inventario: ", error);
      setLoading(false);
    });

    const movementsRef = ref(rt_db, 'movements');
    const unsubscribeMovements = onValue(movementsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const dates = Object.values(data).map(mov => new Date(mov.timestamp));
        setMovementDates(dates);
      } else {
        setMovementDates([]);
      }
    });

    return () => {
      unsubscribeInv();
      unsubscribeMovements();
    };
  }, []);

  // 2. Memo para calcular productos con stock bajo
  const lowStockItems = useMemo(() => {
    return inventory.filter(item => item.bodega <= item.stockMin);
  }, [inventory]);

  // 3. Funciones para el modal y el calendario
  const openModal = (type) => {
    setFilterType(type);
    setIsModalOpen(true);
  };

  const handleDateChange = async (date) => {
    setIsModalOpen(false);
    let startDate, endDate;
    let title = '';

    if (filterType === 'diario') {
      startDate = new Date(date.setHours(0, 0, 0, 0));
      endDate = new Date(date.setHours(23, 59, 59, 999));
      title = `Reporte del ${startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    } else if (filterType === 'semanal') {
      // Lógica para rango semanal (asumiendo que 'date' es un array [inicio, fin])
      startDate = new Date(date[0].setHours(0, 0, 0, 0));
      endDate = new Date(date[1].setHours(23, 59, 59, 999));
      title = `Reporte del ${startDate.getDate()} al ${endDate.getDate()} de ${endDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}`;
    } else if (filterType === 'mensual') {
      // Lógica para rango mensual
      startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
      title = `Reporte del mes de ${startDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}`;
    }

    setReportTitle(title);
    await generateChartData(startDate, endDate, title);
  };

  // 4. Función para generar los datos del gráfico
  const generateChartData = async (startDate, endDate, reportLabel) => {
    const movementsRef = ref(rt_db, 'movements');
    const q = query(
      movementsRef,
      orderByChild('timestamp'),
      startAt(startDate.getTime()),
      endAt(endDate.getTime())
    );

    const querySnapshot = await get(q);
    const salidas = {}; // { productName: totalQuantity }

    querySnapshot.forEach(childSnapshot => {
      const movement = childSnapshot.val();
      if (['salida-cocina', 'salida-bodega'].includes(movement.type)) {
        if (salidas[movement.productName]) {
          salidas[movement.productName] += movement.quantity;
        } else {
          salidas[movement.productName] = movement.quantity;
        }
      }
    });

    if (Object.keys(salidas).length === 0) {
      setChartData(null); // No hay datos para mostrar
      setReportTitle(''); // Limpiamos el título si no hay datos
      alert("No se encontraron salidas en el período seleccionado.");
      return;
    }

    setChartData({
      labels: Object.keys(salidas),
      datasets: [{
        label: 'Total de Salidas', // El título se mostrará fuera del gráfico
        data: Object.values(salidas),
        backgroundColor: 'rgba(132, 81, 26, 0.6)',
        borderColor: 'rgba(132, 81, 26, 1)',
        borderWidth: 1,
      }],
    });
  };

  // 5. Función para estilizar el calendario
  const tileClassName = ({ date, view }) => {
    if (view === 'month') {
      const isMovementDate = movementDates.some(
        movementDate => movementDate.toDateString() === date.toDateString()
      );
      if (isMovementDate) {
        return 'snapshot-date';
      }
    }
    return null;
  };

  // 6. Opciones de estilo para el gráfico
 const chartOptions = {
  responsive: true,
  maintainAspectRatio: false, // 👈 obligatorio
  layout: {
    padding: {
      top: 10,
      bottom: 10,
      left: 10,
      right: 10,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        drawBorder: false,
        color: 'rgba(255,255,255,0.1)',
      },
      border: {
        display: false,
      },
      ticks: {
        color: '#eff1f3',
      },
    },
    x: {
      grid: {
        drawBorder: false,
        color: 'rgba(255,255,255,0.1)',
      },
      border: {
        display: false,
      },
      ticks: {
        color: '#eff1f3',
      },
    },
  },
  plugins: {
    legend: {
      labels: {
        color: '#eff1f3',
      },
    },
  },
};



  return (
    <div className="report-container">
      <h2 className="report-title">Reportes de Inventario</h2>

      {/* --- Sección de Stock de Alerta --- */}
      <div className="report-section">
        <h3>Stock de Alerta</h3>
        <p>Productos con inventario igual o por debajo del mínimo establecido.</p>
        <div className="table-responsive-wrapper">
          {loading ? <p>Cargando...</p> : lowStockItems.length > 0 ? (
            <table className="report-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Stock en Bodega</th>
                  <th>Stock en Cocina</th>
                  <th>Stock Mínimo</th>
                  <th>Stock Total (B+C)</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map(item => (
                  <tr key={item.id} className="low-stock-row">
                    <td>{item.name}</td>
                    <td>{item.bodega}</td>
                    <td>{item.cocina}</td>
                    <td>{item.stockMin}</td>
                    <td>{item.bodega + item.cocina}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="no-data-message">No hay productos con stock bajo.</p>
          )}
        </div>
      </div>

      {/* --- Sección de Reporte de Salidas --- */}
      <div className="report-section">
        <h3>Reporte de Salidas</h3>
        <div className="report-filters-buttons">
          <button onClick={() => openModal('diario')} className={`filter-btn ${filterType === 'diario' ? 'active' : ''}`}>Diario</button>
          <button onClick={() => openModal('semanal')} className={`filter-btn ${filterType === 'semanal' ? 'active' : ''}`}>Semanal</button>
          <button onClick={() => openModal('mensual')} className={`filter-btn ${filterType === 'mensual' ? 'active' : ''}`}>Mensual</button>
        </div>

        {chartData ? (
          <div className="chart-container">
            {reportTitle && <h4 className="chart-title">{reportTitle}</h4>}
            <Bar data={chartData} options={chartOptions} />
          </div>
        ) : (
          <p className="no-data-message">Selecciona un período para ver el reporte de salidas.</p>
        )}
      </div>

      {/* --- Modal con Calendario --- */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Selecciona el Período</h3>
            <div className="calendar-wrapper">
              <Calendar
                onChange={handleDateChange}
                selectRange={filterType === 'semanal'}
                view={filterType === 'mensual' ? 'year' : 'month'}
                onClickMonth={filterType === 'mensual' ? handleDateChange : null}
                tileClassName={tileClassName}
              />
            </div>
            <div className="modal-actions">
              <button onClick={() => setIsModalOpen(false)} className="cancel-btn">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reporte;

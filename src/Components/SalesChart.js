import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'top', labels: { color: '#eff1f3' }},
    title: { display: true, color: '#eff1f3', font: { size: 16 }},
  },
  scales: {
    y: { beginAtZero: true, ticks: { color: '#dbe4ee', stepSize: 1 }, grid: { color: 'rgba(255, 255, 255, 0.1)' }},
    x: { ticks: { color: '#dbe4ee' }, grid: { color: 'rgba(255, 255, 255, 0.1)' }}
  }
};

const SalesChart = ({ reportConfig }) => {
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    const generateChartData = async () => {
      if (!reportConfig) return;

      setLoadingChart(true);
      let newChartData = { labels: [], datasets: [] };
      const { type, snapshotId, dateRange, month } = reportConfig;

      try {
        if (type === 'daily' && snapshotId) {
          const snapshotDoc = (await getDocs(query(collection(db, 'inventory_snapshots'), where('__name__', '==', snapshotId)))).docs[0];
          const selected = snapshotDoc ? { id: snapshotDoc.id, ...snapshotDoc.data() } : null;

          if (selected && selected.inventory) {
            const itemsWithOutput = selected.inventory.filter(item => item.salida > 0);
            const reportDate = selected.createdAt ? new Date(selected.createdAt.seconds * 1000).toLocaleDateString('es-ES') : 'Fecha desconocida';
            newChartData = {
              labels: itemsWithOutput.map(item => item.name),
              datasets: [{
                label: `Salidas del día ${reportDate}`,
                data: itemsWithOutput.map(item => item.salida),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
              }]
            };
          }
        } else if ((type === 'weekly' && dateRange) || (type === 'monthly' && month)) {
          let startDate, endDate, label;

          if (type === 'weekly') {
            startDate = new Date(`${dateRange.start}T00:00:00`);
            endDate = new Date(`${dateRange.end}T23:59:59`);
            label = `Salidas Totales (${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()})`;
          } else { // monthly
            const [year, monthNum] = month.split('-');
            startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
            endDate = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59, 999);
            label = `Salidas Totales (${startDate.toLocaleString('es-ES', { month: 'long', year: 'numeric' })})`;
          }

          const movementsRef = collection(db, 'movements');
          const q = query(movementsRef,
            where('timestamp', '>=', Timestamp.fromDate(startDate)),
            where('timestamp', '<=', Timestamp.fromDate(endDate)),
            where('type', 'in', ['salida-cocina', 'salida-bodega'])
          );

          const querySnapshot = await getDocs(q);
          const outputs = {}; // { productName: totalQuantity }
          querySnapshot.forEach(doc => {
            const movement = doc.data();
            outputs[movement.productName] = (outputs[movement.productName] || 0) + movement.quantity;
          });

          const productNames = Object.keys(outputs);
          const quantities = Object.values(outputs);

          if (productNames.length > 0) {
            newChartData = {
              labels: productNames,
              datasets: [{
                label,
                data: quantities,
                backgroundColor: type === 'weekly' ? 'rgba(54, 162, 235, 0.6)' : 'rgba(75, 192, 192, 0.6)',
              }]
            };
          }
        }
      } catch (error) {
        console.error(`Error al generar el reporte ${type}: `, error);
      }

      setChartData(newChartData);
      setLoadingChart(false);
    };

    generateChartData();
  }, [reportConfig]);

  return (
    <div className="chart-container">
      {loadingChart ? <p>Generando gráfico...</p> :
        (chartData.labels && chartData.labels.length > 0 ?
          <Bar options={chartOptions} data={chartData} /> :
          <p className="no-data-message">No hay datos de salida para mostrar con los filtros seleccionados.</p>
        )
      }
    </div>
  );
};

export default SalesChart;
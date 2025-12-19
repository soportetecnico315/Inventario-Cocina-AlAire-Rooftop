import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

const DateRangeModal = ({ isOpen, onClose, onGenerateReport, mode }) => {
  const [snapshots, setSnapshots] = useState([]);
  const [tempSelectedSnapshotId, setTempSelectedSnapshotId] = useState('');
  const [tempDateRange, setTempDateRange] = useState({ start: '', end: '' });
  const [tempSelectedMonth, setTempSelectedMonth] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Cargar snapshots para el reporte diario
      if (mode === 'daily') {
        const fetchSnapshots = async () => {
          const snapshotsCollection = collection(db, 'inventory_snapshots');
          const q = query(snapshotsCollection, orderBy('createdAt', 'desc'));
          const snapshotDocs = await getDocs(q);
          const snapshotsData = snapshotDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setSnapshots(snapshotsData);
          if (snapshotsData.length > 0) {
            setTempSelectedSnapshotId(snapshotsData[0].id);
          }
        };
        fetchSnapshots();
      }

      // Inicializar valores por defecto para los filtros
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const todayStr = today.toISOString().split('T')[0];
      setTempDateRange({ start: firstDayOfMonth, end: todayStr });
      setTempSelectedMonth(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    let reportConfig = { type: mode };
    if (mode === 'daily') {
      reportConfig.snapshotId = tempSelectedSnapshotId;
    } else if (mode === 'weekly') {
      const start = new Date(tempDateRange.start);
      const end = new Date(tempDateRange.end);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 8) {
        alert("El rango para el reporte semanal no puede exceder los 8 días.");
        return;
      }
      reportConfig.dateRange = tempDateRange;
    } else if (mode === 'monthly') {
      reportConfig.month = tempSelectedMonth;
    }
    onGenerateReport(reportConfig);
    onClose();
  };

  const renderContent = () => {
    switch (mode) {
      case 'daily':
        return (
          <select value={tempSelectedSnapshotId} onChange={(e) => setTempSelectedSnapshotId(e.target.value)} disabled={snapshots.length === 0}>
            <option value="" disabled>Selecciona un día de cierre</option>
            {snapshots.map(snap => (
              <option key={snap.id} value={snap.id}>
                Cierre del {snap.createdAt ? new Date(snap.createdAt.seconds * 1000).toLocaleString('es-ES') : 'N/A'}
              </option>
            ))}
          </select>
        );
      case 'weekly':
        return (
          <div className="date-range-picker">
            <label>Desde:</label>
            <input type="date" name="start" value={tempDateRange.start} onChange={(e) => setTempDateRange(prev => ({ ...prev, start: e.target.value }))} />
            <label>Hasta:</label>
            <input type="date" name="end" value={tempDateRange.end} onChange={(e) => setTempDateRange(prev => ({ ...prev, end: e.target.value }))} />
          </div>
        );
      case 'monthly':
        return <input type="month" value={tempSelectedMonth} onChange={(e) => setTempSelectedMonth(e.target.value)} />;
      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Seleccionar Rango</h3>
        <div className="modal-body">{renderContent()}</div>
        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn">Cancelar</button>
          <button onClick={handleConfirm} className="submit-btn">Confirmar</button>
        </div>
      </div>
    </div>
  );
};

export default DateRangeModal;
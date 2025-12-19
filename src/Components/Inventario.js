import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, serverTimestamp, doc, deleteDoc, updateDoc, runTransaction, addDoc } from 'firebase/firestore';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import './Inventario.css';

const Inventario = ({ userData }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    bodega: '',
    cocina: '',
    stockMin: '',
    stockMax: ''
  });
  const [editingItem, setEditingItem] = useState(null); // Para almacenar el ítem que se está editando
  const [searchTerm, setSearchTerm] = useState(''); // Estado para el término de búsqueda
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'ascending' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10); // 10 ítems por página
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // Estado para controlar el guardado
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false); // Estado para el modal de descarga
  const [movementData, setMovementData] = useState({
    itemId: '',
    type: '',
    quantity: ''
  });
  const [movementItemName, setMovementItemName] = useState('');
  const [movementSuggestions, setMovementSuggestions] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [isObservationsModalOpen, setIsObservationsModalOpen] = useState(false);
  const [observationItem, setObservationItem] = useState(null);
  const [isInventoryClosed, setIsInventoryClosed] = useState(false);

  // Leer datos del inventario en tiempo real
  useEffect(() => {
    const inventoryCollection = collection(db, 'inventory');
    
    // onSnapshot ahora incluye un manejador de errores
    const unsubscribe = onSnapshot(inventoryCollection, 
      (snapshot) => {
      const inventoryData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setInventory(inventoryData);
      setLoading(false);
    }, 
    (error) => {
      console.error("Error al obtener el inventario: ", error);
      alert("No se pudo cargar el inventario. Revisa las reglas de Firestore.");
      setLoading(false);
    });

    // Limpiar el listener al desmontar el componente
    return () => unsubscribe();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewItem({ ...newItem, [name]: value });
  };

  const handleSaveItem = async (e) => { // Renombramos a handleSaveItem para manejar añadir y editar
    e.preventDefault();
    const itemToSave = editingItem || newItem; // Si estamos editando, usamos editingItem, si no, newItem

    if (!itemToSave.name || !itemToSave.bodega || !itemToSave.cocina || !itemToSave.stockMin || !itemToSave.stockMax) {
      alert("Por favor, completa todos los campos.");
      return;
    }

    setIsSaving(true); // Deshabilitar botón

    try {
      const commonData = {
        responsable: `${userData?.nombre || ''} ${userData?.apellidos || ''}`.trim() || 'N/A',
        lastUpdated: serverTimestamp() // Fecha y hora del servidor
      };

      if (editingItem) {
        // Si estamos editando, actualizamos el documento existente
        const itemDocRef = doc(db, 'inventory', editingItem.id);
        await updateDoc(itemDocRef, {
          ...itemToSave, // Usamos todos los campos del item en edición
          ...commonData  // Sobrescribimos con los datos comunes (responsable, fecha)
        });
        alert(`Producto "${itemToSave.name}" actualizado con éxito.`);
      } else {
        // Si estamos añadiendo, creamos un nuevo documento
        const docData = {
          ...itemToSave,
          ...commonData,
          ingreso: 0, // Solo se inicializa en 0 al añadir
          salida: 0,   // Solo se inicializa en 0 al añadir
        };
        // Usamos addDoc para crear el nuevo producto en Firestore
        await addDoc(collection(db, 'inventory'), docData);
        alert(`Producto "${itemToSave.name}" añadido con éxito.`);
      }

      // Limpiar el formulario y cerrar el modal
      setNewItem({ name: '', bodega: '', cocina: '', stockMin: '', stockMax: '' });
      setEditingItem(null); // Limpiar el ítem en edición
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error detallado al guardar el producto: ", error);
      alert("Ocurrió un error al guardar el producto. Revisa la consola para más detalles.");
    } finally {
      setIsSaving(false); // Habilitar botón de nuevo
    }
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDeleteItem = async (id, name) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el producto "${name}"?`)) {
      try {
        // Referencia al documento específico que queremos eliminar
        const itemDocRef = doc(db, 'inventory', id);
        await deleteDoc(itemDocRef);
        // Firestore en tiempo real actualizará el estado 'inventory' automáticamente
        alert(`Producto "${name}" eliminado con éxito.`);
      } catch (error) {
        console.error("Error al eliminar el producto: ", error);
        alert("Ocurrió un error al eliminar el producto.");
      }
    }
  };

  const handleOpenObservationsModal = (item) => {
    setObservationItem(item);
    setIsObservationsModalOpen(true);
  };

  const handleMovementChange = (e) => {
    const { name, value } = e.target;
    setMovementData(prev => ({ ...prev, [name]: value }));
  };

  const handleMovementItemNameChange = (e) => {
    const value = e.target.value;
    setMovementItemName(value);

    if (value.trim()) {
      const suggestions = inventory.filter(item =>
        item.name.toLowerCase().includes(value.toLowerCase())
      );
      setMovementSuggestions(suggestions);
    } else {
      setMovementSuggestions([]);
    }

    // Si el nombre ya no coincide con un producto, limpiamos el ID
    const exactMatch = inventory.find(item => item.name.toLowerCase() === value.toLowerCase());
    setMovementData(prev => ({ ...prev, itemId: exactMatch ? exactMatch.id : '' }));
  };

  const handleSuggestionClick = (suggestion) => {
    setMovementItemName(suggestion.name);
    setMovementData(prev => ({ ...prev, itemId: suggestion.id }));
    setMovementSuggestions([]); // Ocultar sugerencias
  };

  const handleRegisterMovement = async (e) => {
    e.preventDefault();
    const { itemId, type, quantity } = movementData;

    if (!itemId || !type || !quantity || Number(quantity) <= 0) {
      alert("Por favor, selecciona un producto, un tipo de movimiento y una cantidad válida.");
      return;
    }

    //setIsRegistering(true); // Descomentar si se vuelve a usar
    const itemDocRef = doc(db, 'inventory', itemId);
    const movementQuantity = Number(quantity);

    const responsibleName = `${userData?.nombre || ''} ${userData?.apellidos || ''}`.trim() || 'N/A';
    try {
      await runTransaction(db, async (transaction) => {
        const itemDoc = await transaction.get(itemDocRef);
        if (!itemDoc.exists()) {
          throw new Error("El producto no existe.");
        }

        const currentData = itemDoc.data();
        // Capturar estado antes del movimiento
        const beforeBodega = currentData.bodega;
        const beforeCocina = currentData.cocina;

        let newBodega = currentData.bodega;
        let newCocina = currentData.cocina;
        let newIngreso = currentData.ingreso;
        let newSalida = currentData.salida;

        switch (type) {
          case 'ingreso-bodega':
            newBodega += movementQuantity;
            newIngreso += movementQuantity;
            break;
          case 'ingreso-cocina':
            newCocina += movementQuantity;
            newIngreso += movementQuantity;
            break;
          case 'bodega-cocina':
            if (currentData.bodega < movementQuantity) throw new Error("No hay suficiente stock en bodega para la transferencia.");
            newBodega -= movementQuantity;
            newCocina += movementQuantity;
            break;
          case 'salida-cocina':
            if (currentData.cocina < movementQuantity) throw new Error("No hay suficiente stock en cocina para la salida.");
            newCocina -= movementQuantity;
            newSalida += movementQuantity;
            break;
          case 'salida-bodega':
            if (currentData.bodega < movementQuantity) throw new Error("No hay suficiente stock en bodega para la salida.");
            newBodega -= movementQuantity;
            newSalida += movementQuantity;
            break;
          default:
            throw new Error("Tipo de movimiento no válido.");
        }

        transaction.update(itemDocRef, { bodega: newBodega, cocina: newCocina, ingreso: newIngreso, salida: newSalida, lastUpdated: serverTimestamp(), responsable: `${userData?.nombre || ''} ${userData?.apellidos || ''}`.trim() || 'N/A' });

        // Registrar el movimiento en la colección 'movements'
        const productName = inventory.find(item => item.id === itemId)?.name || 'Producto Desconocido';
        const newMovementDocRef = doc(collection(db, 'movements')); // Firestore genera un nuevo ID

        transaction.set(newMovementDocRef, {
          productId: itemId,
          productName: productName,
          type: type,
          quantity: movementQuantity,
          beforeBodega: beforeBodega,
          beforeCocina: beforeCocina,
          afterBodega: newBodega,
          afterCocina: newCocina,
          responsible: responsibleName,
          timestamp: serverTimestamp()
        });

      });

      alert("Movimiento registrado con éxito.");
      setMovementData({ itemId: '', type: '', quantity: '' }); // Reset form
      setMovementItemName(''); // Limpiar el campo de nombre del producto
    } catch (error) {
      console.error("Error al registrar el movimiento: ", error);
      alert(`Error: ${error.message}`);
    }
  };
  // --- Placeholder para las funciones de descarga ---
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const tableColumn = ["Nombre", "Bodega", "Ingreso", "Salida", "Cocina", "Total"];
    const tableRows = [];

    // Usamos la lista filtrada completa, no solo la página actual
    filteredInventory.forEach(item => {
      const itemData = [
        item.name,
        item.bodega,
        item.ingreso,
        item.salida,
        item.cocina,
        item.bodega + item.cocina,
      ];
      tableRows.push(itemData);
    });

    // Encabezado del reporte
    doc.setFontSize(18);
    doc.text("Reporte de Inventario", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generado por: ${userData?.nombre || ''} ${userData?.apellidos || ''}`.trim(), 14, 30);
    doc.text(`Fecha: ${new Date().toLocaleString('es-ES')}`, 14, 36);

    // Generar la tabla
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [18, 40, 54] }
    });

    doc.save('reporte_inventario.pdf');
    setIsDownloadModalOpen(false);
  };

  const handleDownloadImage = () => {
    // Crear un elemento temporal para renderizar el reporte
    const reportElement = document.createElement('div');
    // Aplicar estilos para que se vea bien
    reportElement.style.padding = '20px';
    reportElement.style.background = '#223843';
    reportElement.style.color = 'white';
    reportElement.style.width = '800px'; // Ancho fijo para la captura

    // Contenido del reporte
    let tableHTML = `
      <h1 style="text-align: center;">Reporte de Inventario</h1>
      <p>Generado por: ${`${userData?.nombre || ''} ${userData?.apellidos || ''}`.trim()}</p>
      <p>Fecha: ${new Date().toLocaleString('es-ES')}</p>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background-color: #f8f9fa; color: rgb(18, 40, 54);">
            <th style="padding: 8px; border: 1px solid #ddd;">Nombre</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Bodega</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Ingreso</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Salida</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Cocina</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${filteredInventory.map(item => `
            <tr style="background-color: rgba(0,0,0,0.1);">
              <td style="padding: 8px; border: 1px solid #444;">${item.name}</td>
              <td style="padding: 8px; border: 1px solid #444;">${item.bodega}</td>
              <td style="padding: 8px; border: 1px solid #444;">${item.ingreso}</td>
              <td style="padding: 8px; border: 1px solid #444;">${item.salida}</td>
              <td style="padding: 8px; border: 1px solid #444;">${item.cocina}</td>
              <td style="padding: 8px; border: 1px solid #444;">${item.bodega + item.cocina}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    reportElement.innerHTML = tableHTML;

    // Añadir el elemento temporal al DOM (fuera de la vista)
    reportElement.style.position = 'absolute';
    reportElement.style.left = '-9999px';
    document.body.appendChild(reportElement);

    html2canvas(reportElement).then(canvas => {
      const link = document.createElement('a');
      link.download = 'reporte_inventario.png';
      link.href = canvas.toDataURL('image/png');
      link.click();

      // Limpiar el elemento temporal
      document.body.removeChild(reportElement);
      setIsDownloadModalOpen(false);
    });
  };

  // Lógica de ordenamiento
  const sortedInventory = useMemo(() => {
    let sortableItems = [...inventory];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key].toLowerCase() < b[sortConfig.key].toLowerCase()) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key].toLowerCase() > b[sortConfig.key].toLowerCase()) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [inventory, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // El filtrado ahora se aplica sobre la lista ordenada
  const filteredInventory = sortedInventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredInventory.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="inventario-container">
      <h2 className="inventario-title">Gestión de Inventario</h2>
      <div className="inventario-header">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Buscar por nombre..."
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
          <button onClick={() => setIsModalOpen(true)} className="add-product-btn" disabled={isInventoryClosed}>Agregar Producto</button>
        
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingItem ? 'Editar Producto' : 'Añadir Nuevo Producto'}</h3> 
            <form onSubmit={handleSaveItem} className="modal-form">
              <input type="text" name="name" value={editingItem ? editingItem.name : newItem.name} onChange={handleInputChange} placeholder="Nombre del Producto" required />
              <div className="form-row">
                <input type="number" name="bodega" value={editingItem ? editingItem.bodega : newItem.bodega} onChange={handleInputChange} placeholder="Cant. en Bodega" required />
                <input type="number" name="cocina" value={editingItem ? editingItem.cocina : newItem.cocina} onChange={handleInputChange} placeholder="Cant. en Cocina" required />
              </div>
              <div className="form-row">
                <input type="number" name="stockMin" value={editingItem ? editingItem.stockMin : newItem.stockMin} onChange={handleInputChange} placeholder="Stock Mínimo" required />
                <input type="number" name="stockMax" value={editingItem ? editingItem.stockMax : newItem.stockMax} onChange={handleInputChange} placeholder="Stock Máximo" required />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="cancel-btn">Cancelar</button>
                <button type="submit" className="submit-btn" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar Producto'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <p>Cargando inventario...</p> : (
        <table className="inventory-table">
          <thead>
            <tr>
              <th 
                onClick={() => requestSort('name')} 
                className={`sortable-header ${sortConfig.key === 'name' ? sortConfig.direction : ''}`}
              >
                Producto
              </th>
              <th>Bodega</th>
              <th>Ingreso</th>
              <th>Salida</th>
              <th>Cocina</th>
              <th>Total</th>
              <th>Stock Min</th>
              <th>Stock Max</th>
              <th>Responsable</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {currentItems.map(item => (
              <tr key={item.id}>
                <td data-label="Nombre">{item.name}</td>
                <td data-label="Bodega">{item.bodega}</td>
                <td data-label="Ingreso">{item.ingreso}</td>
                <td data-label="Salida">{item.salida}</td>
                <td data-label="Cocina">{item.cocina}</td>
                <td data-label="Total">{item.bodega + item.cocina}</td>
                <td data-label="Stock Min">{item.stockMin}</td>
                <td data-label="Stock Max">{item.stockMax}</td>
                <td data-label="Responsable">
                  <div className="responsable-wrapper">
                    <div className="responsable-name">{item.responsable}</div>
                    <div className="responsable-date"> {/* Asegúrate de que item.lastUpdated sea un objeto Timestamp de Firebase */}
                      Fecha: {item.lastUpdated ? new Date(item.lastUpdated.seconds * 1000).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                    </div>
                  </div>
                </td>
                <td className="actions-cell">
                  <button className="icon-btn edit-btn" onClick={() => handleOpenEditModal(item)} disabled={isInventoryClosed}>✏️</button>
                  <button className="icon-btn delete-btn" onClick={() => handleDeleteItem(item.id, item.name)} disabled={isInventoryClosed}>🗑️</button>
                  <button className="icon-btn observation-btn" onClick={() => handleOpenObservationsModal(item)}>💬</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
      {isObservationsModalOpen && observationItem && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Observaciones para {observationItem.name}</h3>
            <div className="observations-content" style={{ color: 'white', minHeight: '100px' }}>
              {observationItem.observations ? (
                <p>{observationItem.observations}</p>
              ) : (
                <p>No hay observaciones para este producto.</p>
              )}
            </div>
            <div className="modal-actions">
              <button onClick={() => setIsObservationsModalOpen(false)} className="cancel-btn">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* El formulario de registro de movimiento solo se muestra si el usuario tiene el permiso */}
        <div className="movement-registration-container">
          <h3 className="movement-title">Registro de Movimiento</h3>
          <form onSubmit={handleRegisterMovement} className="movement-form">
            <div className="form-group">
              <label htmlFor="itemId">Nombre del Producto</label>
              <div className="autocomplete-wrapper">
                <input
                  type="text"
                  id="movementItemName"
                  name="movementItemName"
                  value={movementItemName}
                  onChange={handleMovementItemNameChange}
                  placeholder="Escribe para buscar un producto..."
                  required
                  autoComplete="off"
                />
                {movementSuggestions.length > 0 && (
                  <ul className="suggestions-list">
                    {movementSuggestions.map(suggestion => (
                      <li key={suggestion.id} onClick={() => handleSuggestionClick(suggestion)}>{suggestion.name}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="type">Tipo de Movimiento</label>
              <select id="type" name="type" value={movementData.type} onChange={handleMovementChange} required>
                <option value="" disabled>Selecciona un tipo</option>
                <option value="ingreso-bodega">Ingreso a Bodega</option>
                <option value="ingreso-cocina">Ingreso a Cocina</option>
                <option value="bodega-cocina">Bodega a Cocina (Transferencia)</option>
                <option value="salida-cocina">Salida de Cocina</option>
                <option value="salida-bodega">Salida de Bodega</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="quantity">Cantidad</label>
              <input
                id="quantity"
                type="number"
                name="quantity"
                value={movementData.quantity}
                onChange={handleMovementChange}
                placeholder="Cantidad"
                min="1"
                required
              />
            </div>
            <button type="submit" className="footer-btn save-btn">
              Registrar Movimiento
            </button>
          </form>
        </div>
      
      {totalPages > 1 && ( // Mostrar paginación solo si hay más de una página
        <nav className="pagination">
          <button 
            onClick={() => paginate(currentPage - 1)} 
            disabled={currentPage === 1}
            className="pagination-btn">Anterior</button>
          {pageNumbers.map(number => (
            <button key={number} onClick={() => paginate(number)} className={`pagination-btn ${currentPage === number ? 'active' : ''}`}>
              {number}
            </button>
          ))}
          <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}
            className="pagination-btn">Siguiente</button>
        </nav>
      )}

      <div className="table-actions-footer">
        <button 
          onClick={() => setIsInventoryClosed(!isInventoryClosed)} 
          className={`footer-btn ${isInventoryClosed ? 'reviewed-btn' : 'save-btn'}`}
        >
          {isInventoryClosed ? 'Reabrir Inventario' : 'Cerrar Inventario'}
        </button>
        <button onClick={() => setIsDownloadModalOpen(true)} className="footer-btn download-btn">Descargar</button>
      </div>

      {isDownloadModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Descargar Reporte</h3>
            <p>Elige el formato en el que deseas descargar el reporte de inventario.</p>
            <div className="download-options">
              <button onClick={handleDownloadPDF} className="download-option-btn pdf-btn">
                Descargar PDF
              </button>
              <button onClick={handleDownloadImage} className="download-option-btn image-btn">
                Descargar Imagen
              </button>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => setIsDownloadModalOpen(false)} className="cancel-btn">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventario;
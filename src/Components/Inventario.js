import React, { useState, useEffect, useMemo } from 'react';
import { rt_db } from '../firebase';
import { ref, onValue, serverTimestamp, remove, update, runTransaction, push, set } from 'firebase/database';
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
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false); // Estado para el modal de confirmación de borrado
  const [itemToDelete, setItemToDelete] = useState(null); // Estado para el ítem a eliminar
  const [isMovementPromptOpen, setIsMovementPromptOpen] = useState(false); // Nuevo estado para el modal de prompt de observaciones
  const [isObservationInputOpen, setIsObservationInputOpen] = useState(false); // Nuevo estado para el modal de input de observaciones
  const [pendingMovementData, setPendingMovementData] = useState(null); // Datos del movimiento pendientes
  const [pendingResponsibleName, setPendingResponsibleName] = useState(''); // Nombre del responsable pendiente
  const [currentMovementObservationText, setCurrentMovementObservationText] = useState(''); // Texto de la observación del movimiento
  const [isClosingInventory, setIsClosingInventory] = useState(false); // Estado para la acción de guardar/cerrar

  // Leer datos del inventario en tiempo real
  useEffect(() => {
    const inventoryRef = ref(rt_db, 'inventory');
    
    // onSnapshot ahora incluye un manejador de errores
    const unsubscribe = onValue(inventoryRef, 
      (snapshot) => {
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
            stockMax: Number(itemData.stockMax || 0),
          };
        });
        setInventory(inventoryList);
      } else {
        setInventory([]);
      }
      setLoading(false);
    }, 
    (error) => {
      console.error("Error al obtener el inventario: ", error);
      alert("No se pudo cargar el inventario. Revisa las reglas de la base de datos.");
      setLoading(false);
    });

    // Limpiar el listener al desmontar el componente
    return () => unsubscribe();
  }, []);

  // Leer el estado de cierre del inventario
  useEffect(() => {
    const statusRef = ref(rt_db, 'app_state/inventory_status');
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const data = snapshot.val();
      setIsInventoryClosed(!!(data && data.isClosed));
    }, (error) => {
      console.error("Error al obtener el estado del inventario: ", error);
    });
    return () => unsubscribe();
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    // Si el input es de tipo 'number', convierte el valor a número.
    const parsedValue = type === 'number' ? Number(value) : value;
    setNewItem({ ...newItem, [name]: parsedValue });
  };

  const handleSaveItem = async (e) => { // Renombramos a handleSaveItem para manejar añadir y editar
    e.preventDefault();
    // Si estamos editando, fusionamos los datos originales con los nuevos. Si no, usamos el nuevo ítem.
    const finalItem = editingItem ? { ...editingItem, ...newItem } : newItem;

    // Validación más robusta que permite el valor 0 en campos numéricos
    if (
      !finalItem.name || 
      finalItem.bodega === '' || finalItem.bodega === null ||
      finalItem.cocina === '' || finalItem.cocina === null ||
      finalItem.stockMin === '' || finalItem.stockMin === null ||
      finalItem.stockMax === '' || finalItem.stockMax === null) {
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
        const itemRef = ref(rt_db, `inventory/${editingItem.id}`);
        await update(itemRef, {
          ...finalItem, // Usamos el objeto fusionado para la actualización
          ...commonData  // Sobrescribimos con los datos comunes (responsable, fecha)
        });
        alert(`Producto "${finalItem.name}" actualizado con éxito.`);
      } else {
        // Si estamos añadiendo, creamos un nuevo documento
        const docData = {
          ...finalItem,
          ...commonData,
          ingreso: 0, // Solo se inicializa en 0 al añadir
          salida: 0,   // Solo se inicializa en 0 al añadir
        };
        // Usamos push y set para crear el nuevo producto en Realtime Database
        const newItemRef = push(ref(rt_db, 'inventory'));
        await set(newItemRef, docData);
        alert(`Producto "${finalItem.name}" añadido con éxito.`);
      }

      // Limpiar el formulario y cerrar el modal
      setNewItem({ name: '', bodega: '', cocina: '', stockMin: '', stockMax: '' });
      setEditingItem(null); // Limpiar el ítem en edición
      setNewItem({ name: '', bodega: '', cocina: '', stockMin: '', stockMax: '' }); // Resetear formulario
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
    setNewItem(item); // Precargar los datos del ítem en el formulario
    setIsModalOpen(true);
  };

  const handleDeleteItem = (item) => {
    setItemToDelete(item);
    setIsDeleteConfirmOpen(true);
  };

  const confirmDeleteItem = async () => {
    if (itemToDelete) {
      try {
        const itemRef = ref(rt_db, `inventory/${itemToDelete.id}`);
        await remove(itemRef);
        alert(`Producto "${itemToDelete.name}" eliminado con éxito.`);
      } catch (error) {
        console.error("Error al eliminar el producto: ", error);
        alert("Ocurrió un error al eliminar el producto.");
      } finally {
        // Cerrar el modal y limpiar el estado
        setIsDeleteConfirmOpen(false);
        setItemToDelete(null);
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
        (item.name || '').toLowerCase().includes(value.toLowerCase())
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

  // Nueva función para ejecutar el registro del movimiento, con o sin observaciones
  const executeMovementRegistration = async (addObservations) => {
    const { itemId, type, quantity } = pendingMovementData;
    const movementQuantity = Number(quantity);
    const responsibleName = pendingResponsibleName;
    const observations = addObservations ? currentMovementObservationText : '';

    if (!itemId || !type || !quantity || Number(quantity) <= 0) {
      alert("Por favor, selecciona un producto, un tipo de movimiento y una cantidad válida.");
      return;
    }

    // Declarar las variables en el ámbito exterior para que sean accesibles después de la transacción.
    let beforeBodega, beforeCocina;

    //setIsRegistering(true); // Descomentar si se vuelve a usar
    const itemRef = ref(rt_db, `inventory/${itemId}`);
    try {
      await runTransaction(itemRef, (currentData) => {
        if (!currentData) {
          // Si no hay datos, la transacción se aborta retornando undefined.
          // Lanzamos un error para que el catch lo maneje.
          throw new Error("El producto no existe o no se pudo cargar.");
        }
        // Capturar estado antes del movimiento
        // Asignar a las variables del ámbito exterior.
        beforeBodega = currentData.bodega;
        beforeCocina = currentData.cocina;

        let newBodega = Number(currentData.bodega); // Asegurarse de que sean números
        let newCocina = Number(currentData.cocina); // Asegurarse de que sean números
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

        const updateData = {
          bodega: newBodega,
          cocina: newCocina,
          ingreso: newIngreso,
          salida: newSalida,
          lastUpdated: serverTimestamp(),
          responsable: responsibleName,
        };

        // Actualizar el campo 'observations' del producto en el inventario
        if (observations) {
          updateData.observations = observations;
        }
        return updateData; // La transacción de RTDB retorna el nuevo estado
      });

      // --- Escritura del movimiento (fuera de la transacción) ---
      const productName = inventory.find(item => item.id === itemId)?.name || 'Producto Desconocido';
      const newMovementRef = push(ref(rt_db, 'movements'));
      await set(newMovementRef, {
        productId: itemId,
        productName: productName,
        type: type,
        quantity: movementQuantity,
        // Los valores 'after' se obtienen re-leyendo el inventario, que ya se actualizó.
        // Para simplificar, los calculamos de nuevo.
        beforeBodega: beforeBodega,
        beforeCocina: beforeCocina,
        responsible: responsibleName,
        timestamp: serverTimestamp(),
        observations: observations,
      });

      alert("Movimiento registrado con éxito.");
      setMovementData({ itemId: '', type: '', quantity: '' }); // Reset form
      setMovementItemName(''); // Limpiar el campo de nombre del producto
    } catch (error) {
      console.error("Error al registrar el movimiento: ", error);
      alert(`Error: ${error.message}`);
    } finally {
      // Limpiar estados temporales y cerrar modales de movimiento
      setIsMovementPromptOpen(false);
      setIsObservationInputOpen(false);
      setPendingMovementData(null);
      setPendingResponsibleName('');
      setCurrentMovementObservationText('');
    }
  };
  
  const handleRegisterMovement = (e) => {
    e.preventDefault(); // Prevenir el envío del formulario por defecto
    if (!movementData.itemId || !movementData.type || !movementData.quantity || Number(movementData.quantity) <= 0) {
      alert("Por favor, selecciona un producto, un tipo de movimiento y una cantidad válida.");
      return;
    }

    const responsibleName = `${userData?.nombre || ''} ${userData?.apellidos || ''}`.trim() || 'N/A';
    
    // Almacenar los datos del movimiento y abrir el modal de prompt de observaciones
    setPendingMovementData(movementData);
    setPendingResponsibleName(responsibleName);
    setIsMovementPromptOpen(true);
  };

  const handleSaveMovementObservations = () => {
    executeMovementRegistration(true); // Ejecutar el registro con observaciones
  };

  const handleCancelMovementObservations = () => {
    setIsObservationInputOpen(false);
    setCurrentMovementObservationText(''); // Limpiar el texto si se cancela
    // Si el usuario cancela las observaciones, aún puede querer registrar el movimiento sin ellas
    // O simplemente cancelar todo el proceso. Aquí asumimos que cancelar observaciones cancela el movimiento.
    // Si se desea registrar sin observaciones al cancelar, se llamaría a executeMovementRegistration(false);
    // Por ahora, solo cerramos el modal y limpiamos.
    setIsMovementPromptOpen(false); // Asegurarse de que el prompt también se cierre
  };

  const handleNoObservations = () => {
    executeMovementRegistration(false); // Ejecutar el registro sin observaciones
  };

  const handleSaveAndCloseInventory = async () => {
    if (!window.confirm("¿Estás seguro de que quieres guardar y cerrar el inventario? No podrás realizar más modificaciones hasta que sea revisado.")) {
      return;
    }

    setIsClosingInventory(true);
    const responsibleName = `${userData?.nombre || ''} ${userData?.apellidos || ''}`.trim() || 'N/A';
    const snapshotData = {
      createdAt: serverTimestamp(),
      responsible: responsibleName,
      inventory: inventory // Guardamos una copia completa del inventario
    };

    try {
      // 1. Guardar el snapshot en una nueva colección
      const newSnapshotRef = push(ref(rt_db, 'inventory_snapshots'));
      await set(newSnapshotRef, snapshotData);

      // 2. Actualizar el estado para cerrar el inventario
      const statusRef = ref(rt_db, 'app_state/inventory_status');
      await set(statusRef, { isClosed: true });
      alert("Inventario guardado y cerrado con éxito.");
    } catch (error) {
      console.error("Error al guardar el snapshot del inventario: ", error);
      alert("Ocurrió un error al guardar el inventario. Por favor, inténtalo de nuevo.");
    } finally {
      setIsClosingInventory(false);
    }
  };
  const handleReopenInventory = async () => {
    if (window.confirm("¿Estás seguro de que quieres reabrir el inventario? Se reiniciarán los contadores de Ingreso, Salida y las observaciones de todos los productos.")) {
      setIsSaving(true); // Usamos el estado de guardado para deshabilitar botones
      try {
        const updates = {};
        
        // Iterar sobre todos los productos en el estado local del inventario
        inventory.forEach(item => {
          updates[`/inventory/${item.id}/ingreso`] = 0;
          updates[`/inventory/${item.id}/salida`] = 0;
          updates[`/inventory/${item.id}/observations`] = null; // En RTDB, null elimina la clave
        });

        // Actualizar el estado para reabrir el inventario
        updates['/app_state/inventory_status/isClosed'] = false;

        // Ejecutar todas las actualizaciones en una sola operación
        await update(ref(rt_db), updates);

        alert("Inventario reabierto. Los contadores y observaciones han sido reiniciados.");
      } catch (error) {
        console.error("Error al reabrir el inventario: ", error);
        alert("Ocurrió un error al reabrir el inventario.");
      } finally {
        setIsSaving(false);
      }
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
        // Asegurarse de que los valores a comparar sean strings
        const valA = (a[sortConfig.key] || '').toString().toLowerCase();
        const valB = (b[sortConfig.key] || '').toString().toLowerCase();
        if (valA < valB) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (valA > valB) {
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
    (item.name || '').toLowerCase().includes(searchTerm.toLowerCase())
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
              <input type="text" name="name" value={newItem.name} onChange={handleInputChange} placeholder="Nombre del Producto" required />
              <div className="form-row">
                <input type="number" name="bodega" value={newItem.bodega} onChange={handleInputChange} placeholder="Cant. en Bodega" required />
                <input type="number" name="cocina" value={newItem.cocina} onChange={handleInputChange} placeholder="Cant. en Cocina" required />
              </div>
              <div className="form-row">
                <input type="number" name="stockMin" value={newItem.stockMin} onChange={handleInputChange} placeholder="Stock Mínimo" required />
                <input type="number" name="stockMax" value={newItem.stockMax} onChange={handleInputChange} placeholder="Stock Máximo" required />
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
                  <button className="icon-btn delete-btn" onClick={() => handleDeleteItem(item)} disabled={isInventoryClosed}>🗑️</button>
                  <button className="icon-btn observation-btn" onClick={() => handleOpenObservationsModal(item)}>💬
                    {item.observations && <span className="observation-dot"></span>}
                  </button>
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

      {/* Modal de confirmación para eliminar producto */}
      {isDeleteConfirmOpen && itemToDelete && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Confirmar Eliminación</h3>
            <p style={{color: 'white', fontSize: '1.1rem', textAlign: 'center', margin: '2rem 0'}}>
              ¿Estás seguro de que quieres eliminar el producto "{itemToDelete.name}"?
            </p>
            <div className="modal-actions">
              <button onClick={() => setIsDeleteConfirmOpen(false)} className="cancel-btn">
                Cancelar
              </button>
              <button onClick={confirmDeleteItem} className="submit-btn" style={{backgroundColor: '#e03131'}}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para preguntar si hay observaciones en el movimiento */}
      {isMovementPromptOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>¿Deseas añadir observaciones a este movimiento?</h3>
            <div className="modal-actions">
              <button type="button" onClick={() => {
                setIsMovementPromptOpen(false);
                setIsObservationInputOpen(true); // Abrir el modal de input de observaciones
              }} className="submit-btn">Sí</button>
              <button type="button" onClick={handleNoObservations} className="cancel-btn">No</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para introducir observaciones del movimiento */}
      {isObservationInputOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Añadir Observaciones al Movimiento</h3>
            <textarea
              value={currentMovementObservationText}
              onChange={(e) => setCurrentMovementObservationText(e.target.value)}
              placeholder="Escribe tus observaciones aquí..."
              rows="5"
              className="modal-textarea"
            ></textarea>
            <div className="modal-actions">
              <button type="button" onClick={handleCancelMovementObservations} className="cancel-btn">Cancelar</button>
              <button type="button" onClick={handleSaveMovementObservations} className="submit-btn">Guardar Observación</button>
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
            <button type="submit" className="footer-btn save-btn" disabled={isInventoryClosed}>
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
        <button onClick={handleSaveAndCloseInventory} className="footer-btn save-btn" disabled={isInventoryClosed || isClosingInventory}>
          {isClosingInventory ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={handleReopenInventory} className="footer-btn reviewed-btn" disabled={!isInventoryClosed || isSaving}>
          {isSaving ? 'Procesando...' : 'Revisado'}
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
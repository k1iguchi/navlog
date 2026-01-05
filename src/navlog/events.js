function handleDeleteButtonClick(event) {
    const table = document.getElementById('navlog-table');
    const row = event.target.closest('tr');
    table.deleteRow(row.rowIndex);
    updateTotals();
}

function handleAddButtonClick(event) {
    const row = event.target.closest('tr');
    addRow(row.rowIndex);
}

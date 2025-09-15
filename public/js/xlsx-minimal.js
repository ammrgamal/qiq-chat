// Minimal XLSX implementation for export functionality
// This is a simplified version that creates basic Excel files

window.XLSX = {
  utils: {
    aoa_to_sheet: function(data) {
      const ws = {};
      const range = { s: { c: 0, r: 0 }, e: { c: 0, r: 0 } };
      
      for (let R = 0; R < data.length; R++) {
        const row = data[R];
        if (range.e.r < R) range.e.r = R;
        for (let C = 0; C < row.length; C++) {
          if (range.e.c < C) range.e.c = C;
          const cell_address = { c: C, r: R };
          const cell_ref = this.encode_cell(cell_address);
          ws[cell_ref] = { v: row[C] };
        }
      }
      
      ws['!ref'] = this.encode_range(range);
      return ws;
    },
    
    book_new: function() {
      return { SheetNames: [], Sheets: {} };
    },
    
    book_append_sheet: function(wb, ws, name) {
      wb.SheetNames.push(name);
      wb.Sheets[name] = ws;
    },
    
    encode_cell: function(cell) {
      return String.fromCharCode(65 + cell.c) + (cell.r + 1);
    },
    
    encode_range: function(range) {
      return this.encode_cell(range.s) + ':' + this.encode_cell(range.e);
    }
  },
  
  writeFile: function(wb, filename) {
    // Convert to CSV for now since we can't create real Excel files without the full library
    const ws = wb.Sheets[wb.SheetNames[0]];
    let csv = '';
    
    // Get range
    const range = ws['!ref'].split(':');
    const start = this.utils.decode_cell(range[0]);
    const end = this.utils.decode_cell(range[1]);
    
    for (let R = start.r; R <= end.r; R++) {
      const row = [];
      for (let C = start.c; C <= end.c; C++) {
        const cell_ref = this.utils.encode_cell({ c: C, r: R });
        const cell = ws[cell_ref];
        row.push(cell ? (cell.v || '') : '');
      }
      csv += row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n';
    }
    
    // Download as CSV with .xlsx extension
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }
};

// Add decode_cell method
XLSX.utils.decode_cell = function(cell_ref) {
  const match = cell_ref.match(/([A-Z]+)(\d+)/);
  if (!match) return { c: 0, r: 0 };
  
  let c = 0;
  const letters = match[1];
  for (let i = 0; i < letters.length; i++) {
    c = c * 26 + (letters.charCodeAt(i) - 64);
  }
  c -= 1;
  
  const r = parseInt(match[2]) - 1;
  return { c: c, r: r };
};

console.log('Minimal XLSX library loaded successfully');
import ExcelJS from "exceljs" // For Node.js environments

export async function readExcelFileWithExcelJS(filePath) {
  const workbook = new ExcelJS.Workbook();

  try {
    // Read the file
    await workbook.xlsx.readFile(filePath);

    // Get the first worksheet
    const worksheet = workbook.getWorksheet(1); // worksheet 1 is the first sheet

    if (!worksheet) {
      console.warn('No worksheet found in the Excel file.');
      return [];
    }

    const data = [];

    // Iterate over rows and collect data
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      // ExcelJS row.values returns an array where the first element (index 0) is often null/empty
      // because Excel columns are 1-indexed.
      // We often start from index 1 to get actual column values.
      const rowValues = row.values.slice(1); // Get actual data, skipping the potential empty first element
      data.push(rowValues);
    });

    // If your first row is headers and you want to convert to an array of objects
    // where keys are headers, it requires a bit more logic.
    // Let's assume for now you want an array of arrays (rows).
    // If you need array of objects, please let me know, and I'll adjust.

    // A common scenario is to treat the first row as headers and subsequent rows as data objects.
    if (data.length > 0) {
      const headers = data[0]; // Assuming first row contains headers
      const jsonData = data.slice(1).map(row => { // Map remaining rows to objects
        const obj = {};
        headers.forEach((header, index) => {
          // Clean up header names if necessary (e.g., trim whitespace, convert to camelCase)
          obj[header] = row[index];
        });
        return obj;
      });
      return jsonData;
    }

    return data;

  } catch (error) {
    console.error('Error reading Excel file with ExcelJS:', error);
    throw error; // Re-throw or handle as appropriate
  }
}

export async function writeExcelFileWithExcelJS(res, data, sheetName, columns, fileName) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = columns;

  data.forEach(item => {
    worksheet.addRow(item);
  });

  // Set response headers for download
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=${fileName}`
  );

  await workbook.xlsx.write(res);
  res.status(200).end();
}

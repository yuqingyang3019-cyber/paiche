const ExcelJS = require("exceljs");
const { chinaDate, outputFilename, sheetTitle } = require("./date");

const FACTORY = "乌达君正";
const DEFAULT_QUANTITY = 37;
const DEFAULT_DESTINATION = "后旗团羊";
const DATA_FONT = { name: "宋体", size: 10 };

function setCell(worksheet, row, col, value) {
  const cell = worksheet.getCell(row, col);
  cell.value = value;
  cell.font = DATA_FONT;
  cell.alignment = { vertical: "middle", horizontal: "center" };
  cell.border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
}

async function fillDispatchWorkbook(vehicles, day = chinaDate()) {
  if (!Array.isArray(vehicles) || vehicles.length === 0) {
    throw new Error("至少填写一辆车");
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetTitle(day));
  worksheet.columns = [
    { width: 12 },
    { width: 14 },
    { width: 10 },
    { width: 12 },
    { width: 22 },
    { width: 14 },
    { width: 10 },
    { width: 10 },
    { width: 14 },
  ];

  worksheet.mergeCells("A1:I1");
  worksheet.getCell("A1").value = "君正报号及装车注意事项";
  worksheet.getCell("A1").font = { name: "宋体", size: 14, bold: true };
  worksheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };

  const headers = ["提货工厂", "车牌号", "挂车号", "司机姓名", "身份证号", "随车电话", "预提数量", "预提数量", "流向"];
  headers.forEach((header, index) => setCell(worksheet, 2, index + 1, header));

  vehicles.forEach((vehicle, index) => {
    const row = index + 3;
    setCell(worksheet, row, 1, FACTORY);
    setCell(worksheet, row, 2, vehicle.plate);
    setCell(worksheet, row, 4, vehicle.name);
    setCell(worksheet, row, 5, vehicle.idCard);
    setCell(worksheet, row, 6, Number(vehicle.phone));
    setCell(worksheet, row, 7, DEFAULT_QUANTITY);
    setCell(worksheet, row, 8, DEFAULT_QUANTITY);
    setCell(worksheet, row, 9, DEFAULT_DESTINATION);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer: Buffer.from(buffer), filename: outputFilename(day) };
}

module.exports = {
  fillDispatchWorkbook,
};

export const TABLE_COLUMNS = [
  { key: "factory", label: "提货工厂", required: false },
  { key: "plate", label: "车牌号", required: true },
  { key: "trailer", label: "挂车号", required: false },
  { key: "name", label: "司机姓名", required: true },
  { key: "idCard", label: "身份证号", required: true },
  { key: "phone", label: "随车电话", required: true },
  { key: "quantityA", label: "预提数量", required: true },
  { key: "quantityB", label: "预提数量", required: true },
  { key: "destination", label: "流向", required: true },
];

export function toTableRow(vehicle) {
  return {
    factory: "乌达君正",
    plate: vehicle.plate,
    trailer: "",
    name: vehicle.name,
    idCard: vehicle.idCard,
    phone: vehicle.phone,
    quantityA: 37,
    quantityB: 37,
    destination: "后旗团羊",
  };
}

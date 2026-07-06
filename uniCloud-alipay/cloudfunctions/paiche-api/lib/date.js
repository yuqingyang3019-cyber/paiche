function chinaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    iso: `${values.year}-${String(values.month).padStart(2, "0")}-${String(values.day).padStart(2, "0")}`,
  };
}

function dateLabel(day = chinaDate()) {
  return `${day.month}月${day.day}日`;
}

function outputFilename(day = chinaDate()) {
  return `乌达君正${day.month}.${day.day}.xlsx`;
}

function sheetTitle(day = chinaDate()) {
  return `君正派车模板（${day.year}年${day.month}月${day.day}日）`;
}

module.exports = {
  chinaDate,
  dateLabel,
  outputFilename,
  sheetTitle,
};

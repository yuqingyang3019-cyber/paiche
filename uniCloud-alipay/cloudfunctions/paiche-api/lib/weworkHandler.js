const { dateLabel } = require("./date");
const { fillDispatchWorkbook } = require("./excel");
const { parseDispatchText, usesLlmParse } = require("./dispatch");
const { appendVehicles, clearVehicles, loadVehicles } = require("./storage");
const { extractXmlField } = require("./weworkCrypto");

const GENERATE_KEYWORDS = new Set(["生成", "生成今日", "导出", "生成excel"]);
const LIST_KEYWORDS = new Set(["列表", "今日列表", "查看列表"]);
const CLEAR_KEYWORDS = new Set(["清空", "清除", "重置"]);
const HELP_KEYWORDS = new Set(["帮助", "help", "?", "？"]);

const LLM_WAIT_TEXT = "正在用大模型识别车信息，约 10–20 秒，请稍候…";
const GENERATE_WAIT_TEXT = "正在生成 Excel，请稍候…";

function normalizeCommand(text) {
  return String(text || "").trim().toLowerCase().replace(/\s+/g, "");
}

function looksLikeVehicleText(text) {
  return ["车号", "姓名", "电话", "身份证", "身份证号"].some((hint) => String(text || "").includes(hint));
}

function buildOperationGuide() {
  const label = dateLabel();
  return `【乌达派车助手 · 操作指南】

添加车辆
从个人微信长按车信息，转发到本应用（需逐条转发，不可合并）

常用指令
列表 — 查看${label}已收录车辆
生成 — 导出${label} Excel 文件
清空 — 清除${label}列表后重新录入
帮助 — 再次查看本说明`;
}

async function operationGuide(userid, note) {
  const parts = [];
  if (note) parts.push(note);
  if (userid) {
    const vehicles = await loadVehicles(userid);
    if (vehicles.length) parts.push(`${dateLabel()}已收录 ${vehicles.length} 辆，发送「生成」可导出 Excel。`);
  }
  parts.push(buildOperationGuide());
  return parts.join("\n\n");
}

function formatVehicleSummary(vehicles) {
  if (!vehicles.length) return `${dateLabel()}列表为空。`;
  const lines = [`${dateLabel()}共 ${vehicles.length} 辆：`];
  vehicles.forEach((vehicle, index) => lines.push(`${index + 1}. ${vehicle.plate || "?"} · ${vehicle.name || "?"}`));
  return lines.join("\n");
}

async function sendActiveText(client, userid, content) {
  try {
    await client.sendText(userid, content);
    return true;
  } catch (error) {
    console.error("wework active reply failed", error);
    return false;
  }
}

async function handleVehicleText(userid, content, client) {
  const viaLlm = usesLlmParse();
  if (viaLlm) await sendActiveText(client, userid, LLM_WAIT_TEXT);

  let result;
  try {
    result = await parseDispatchText(content);
  } catch (error) {
    const reply = await operationGuide(userid, `识别失败：${error.message || error}`);
    if (viaLlm && await sendActiveText(client, userid, reply)) return { replyText: null, deliveredViaApi: true };
    return { replyText: reply, deliveredViaApi: false };
  }

  const vehicles = result.vehicles || [];
  const warnings = result.warnings || [];
  if (!vehicles.length) {
    const note = warnings.length ? warnings.join("；") : "未能识别为完整车信息。";
    const reply = await operationGuide(userid, note);
    if (viaLlm && await sendActiveText(client, userid, reply)) return { replyText: null, deliveredViaApi: true };
    return { replyText: reply, deliveredViaApi: false };
  }

  const allVehicles = await appendVehicles(userid, vehicles);
  const added = vehicles.map((vehicle) => `${vehicle.plate || "?"}·${vehicle.name || "?"}`).join("、");
  const lines = [`已添加 ${vehicles.length} 辆：${added}`, `${dateLabel()}共 ${allVehicles.length} 辆。`];
  if (warnings.length) lines.push(`提示：${warnings.join("；")}`);
  lines.push(`凑齐后发送「生成」获取${dateLabel()} Excel。`);
  const reply = lines.join("\n");
  if (viaLlm && await sendActiveText(client, userid, reply)) return { replyText: null, deliveredViaApi: true };
  return { replyText: reply, deliveredViaApi: false };
}

async function handleGenerate(userid, client) {
  const vehicles = await loadVehicles(userid);
  if (!vehicles.length) {
    return { replyText: await operationGuide(userid, `${dateLabel()}列表为空，请先转发车信息。`), deliveredViaApi: false };
  }
  try {
    await sendActiveText(client, userid, GENERATE_WAIT_TEXT);
    const { buffer, filename } = await fillDispatchWorkbook(vehicles);
    await client.sendFile(userid, filename, buffer);
    if (await sendActiveText(client, userid, `已生成 ${filename}，请在聊天中查收文件。`)) {
      return { replyText: null, deliveredViaApi: true };
    }
    return { replyText: `已生成 ${filename}，但发送确认消息失败。请检查聊天中的文件。`, deliveredViaApi: false };
  } catch (error) {
    return { replyText: await operationGuide(userid, `生成失败：${error.message || error}`), deliveredViaApi: false };
  }
}

async function handleIncomingXml(xml, client) {
  const userid = extractXmlField(xml, "FromUserName") || "unknown";
  const msgType = extractXmlField(xml, "MsgType");
  if (msgType === "event" && extractXmlField(xml, "Event") === "subscribe") {
    return { replyText: await operationGuide(userid, "欢迎使用乌达派车助手。"), deliveredViaApi: false };
  }
  if (msgType !== "text") {
    return { replyText: await operationGuide(userid, "暂不支持该类型消息，请按下方说明操作。"), deliveredViaApi: false };
  }

  const content = extractXmlField(xml, "Content").trim();
  if (!content) return { replyText: await operationGuide(userid, "消息内容为空。"), deliveredViaApi: false };

  const command = normalizeCommand(content);
  const normalizeSet = (set) => new Set([...set].map(normalizeCommand));
  if (normalizeSet(HELP_KEYWORDS).has(command)) return { replyText: await operationGuide(userid), deliveredViaApi: false };
  if (normalizeSet(LIST_KEYWORDS).has(command)) return { replyText: formatVehicleSummary(await loadVehicles(userid)), deliveredViaApi: false };
  if (normalizeSet(CLEAR_KEYWORDS).has(command)) {
    await clearVehicles(userid);
    return { replyText: `已清空${dateLabel()}列表。\n\n${buildOperationGuide()}`, deliveredViaApi: false };
  }
  if (normalizeSet(GENERATE_KEYWORDS).has(command)) return handleGenerate(userid, client);
  if (!looksLikeVehicleText(content)) return { replyText: await operationGuide(userid, "未能识别为车信息或指令。"), deliveredViaApi: false };
  return handleVehicleText(userid, content, client);
}

module.exports = {
  handleIncomingXml,
};

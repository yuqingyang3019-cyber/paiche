const { fillDispatchWorkbook } = require("./lib/excel");
const { json, jsonBody, binary, bodyText, normalizePath, text } = require("./lib/http");
const { parseDispatchText } = require("./lib/dispatch");
const { WeWorkClient } = require("./lib/weworkClient");
const { buildTextReplyXml, decryptEcho, decryptMessage, encryptMessage, extractXmlField } = require("./lib/weworkCrypto");
const { handleIncomingXml } = require("./lib/weworkHandler");
const { appendVehicles, clearVehicles, loadVehicles, removeVehicle } = require("./lib/storage");

function settings() {
  return {
    corpId: (process.env.WEWORK_CORP_ID || "").trim(),
    agentId: Number(process.env.WEWORK_AGENT_ID || 0),
    agentSecret: (process.env.WEWORK_AGENT_SECRET || "").trim(),
    token: (process.env.WEWORK_TOKEN || "69Ku5OIg").trim(),
    encodingAesKey: (process.env.WEWORK_ENCODING_AES_KEY || "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG").trim(),
  };
}

function callbackEnabled(config) {
  return Boolean(config.corpId && config.token && config.encodingAesKey);
}

function optionsResponse() {
  return json(204, {});
}

async function handleParse(event) {
  const payload = jsonBody(event);
  const result = await parseDispatchText(String(payload.text || ""));
  return json(200, { ok: true, ...result });
}

async function handleGenerate(event) {
  const payload = jsonBody(event);
  if (!Array.isArray(payload.vehicles) || payload.vehicles.length === 0) {
    return json(400, { detail: "vehicles 不能为空" });
  }
  const { buffer, filename } = await fillDispatchWorkbook(payload.vehicles);
  return binary(200, buffer, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

function webUserid(payload) {
  const clientId = String(payload.clientId || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(clientId)) {
    throw new Error("clientId 无效");
  }
  return `web:${clientId}`;
}

async function handleList(event) {
  const payload = jsonBody(event);
  return json(200, { ok: true, vehicles: await loadVehicles(webUserid(payload)) });
}

async function handleAppend(event) {
  const payload = jsonBody(event);
  const userid = webUserid(payload);
  const incoming = Array.isArray(payload.vehicles) ? payload.vehicles : [];
  if (!incoming.length) return json(400, { detail: "vehicles 不能为空" });

  const current = await loadVehicles(userid);
  const plates = new Set(current.map((item) => item.plate));
  const toAdd = [];
  const skipped = [];
  for (const vehicle of incoming) {
    if (!vehicle || !vehicle.plate) continue;
    if (plates.has(vehicle.plate)) {
      skipped.push(vehicle.plate);
      continue;
    }
    toAdd.push(vehicle);
    plates.add(vehicle.plate);
  }

  const vehicles = toAdd.length ? await appendVehicles(userid, toAdd) : current;
  return json(200, { ok: true, vehicles, added: toAdd.length, skipped });
}

async function handleRemove(event) {
  const payload = jsonBody(event);
  const id = String(payload.id || "").trim();
  if (!id) return json(400, { detail: "id 不能为空" });
  return json(200, { ok: true, vehicles: await removeVehicle(webUserid(payload), id) });
}

async function handleClear(event) {
  const payload = jsonBody(event);
  await clearVehicles(webUserid(payload));
  return json(200, { ok: true, vehicles: [] });
}

function handleWeWorkVerify(event) {
  const config = settings();
  if (!callbackEnabled(config)) return json(503, { detail: "企业微信回调未配置，请设置 WEWORK_CORP_ID（及 Token / EncodingAESKey）" });
  const query = event.queryStringParameters || {};
  const echostr = query.echostr || "";
  try {
    const echo = decryptEcho(config, query.msg_signature || "", query.timestamp || "", query.nonce || "", echostr);
    return text(200, echo);
  } catch (error) {
    console.error("wework verify failed", error);
    return json(403, { detail: "签名校验失败" });
  }
}

async function handleWeWorkCallback(event) {
  const config = settings();
  if (!callbackEnabled(config)) return json(503, { detail: "企业微信回调未配置，请设置 WEWORK_CORP_ID（及 Token / EncodingAESKey）" });
  const query = event.queryStringParameters || {};
  try {
    const xml = decryptMessage(config, query.msg_signature || "", query.timestamp || "", query.nonce || "", bodyText(event));
    const client = new WeWorkClient(config);
    const { replyText, deliveredViaApi } = await handleIncomingXml(xml, client);
    if (deliveredViaApi || !replyText) return text(200, "success");

    const replyXml = buildTextReplyXml(
      extractXmlField(xml, "FromUserName"),
      extractXmlField(xml, "ToUserName"),
      replyText,
      query.timestamp
    );
    const encrypted = encryptMessage(config, replyXml, query.nonce || "", query.timestamp);
    return text(200, encrypted, "application/xml; charset=utf-8");
  } catch (error) {
    console.error("wework callback failed", error);
    return text(200, "success");
  }
}

exports.main = async (event) => {
  const method = String(event.httpMethod || "GET").toUpperCase();
  const path = normalizePath(event.path);

  try {
    if (method === "OPTIONS") return optionsResponse();
    if (method === "GET" && path === "/health") return json(200, { ok: "true" });
    if (method === "POST" && path === "/api/dispatch/parse") return handleParse(event);
    if (method === "POST" && path === "/api/dispatch/generate") return handleGenerate(event);
    if (method === "POST" && path === "/api/dispatch/list") return handleList(event);
    if (method === "POST" && path === "/api/dispatch/append") return handleAppend(event);
    if (method === "POST" && path === "/api/dispatch/remove") return handleRemove(event);
    if (method === "POST" && path === "/api/dispatch/clear") return handleClear(event);
    if (method === "GET" && path === "/api/wework/callback") return handleWeWorkVerify(event);
    if (method === "POST" && path === "/api/wework/callback") return handleWeWorkCallback(event);
    return json(404, { detail: "Not Found" });
  } catch (error) {
    console.error("request failed", { method, path, error });
    return json(500, { detail: error.message || String(error) });
  }
};

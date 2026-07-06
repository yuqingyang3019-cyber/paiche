const https = require("https");

const SYSTEM_PROMPT = `你是派车信息提取助手。从微信聊天文本中提取车辆信息。
规则：
1. 只输出严格 JSON，不要 Markdown 或其它说明。
2. 输出格式：{"vehicles":[{"plate":"车牌","name":"司机姓名","phone":"11位手机号","idCard":"18位身份证号"}],"warnings":[]}
3. 文本里可能有多辆车，全部提取；字段名可能是车号/车牌、姓名/司机、电话/手机等，按语义识别。
4. 某辆车缺字段时放入 warnings，不要编造。
5. 忽略车皮、自卸、国六等与表格无关的信息。`;

const PATTERNS = {
  plate: /车号[：:]\s*(\S+)/,
  name: /姓名[：:]\s*(\S+)/,
  phone: /电话[：:]\s*(\d{11})/,
  idCard: /身份证号[：:]\s*([\dXx]{18})/,
};
const REQUIRED_FIELDS = ["plate", "name", "phone", "idCard"];

function usesLlmParse() {
  return Boolean((process.env.DASHSCOPE_API_KEY || process.env.LLM_API_KEY || "").trim());
}

function normalizeVehicle(raw) {
  const plate = String(raw.plate || "").trim();
  const name = String(raw.name || "").trim();
  const phone = String(raw.phone || "").replace(/\D/g, "");
  const idCard = String(raw.idCard || "").trim().toUpperCase();
  if (!plate || !name || !/^\d{11}$/.test(phone) || !/^[\dX]{18}$/.test(idCard)) {
    return null;
  }
  return { plate, name, phone, idCard };
}

function extractBlock(block) {
  const vehicle = {};
  const warnings = [];
  for (const key of REQUIRED_FIELDS) {
    const match = PATTERNS[key].exec(block);
    if (match) {
      vehicle[key] = key === "idCard" ? match[1].toUpperCase() : match[1];
    } else {
      warnings.push(`缺少${key}`);
    }
  }
  return { vehicle, warnings };
}

function parseRegex(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return { vehicles: [], warnings: ["请输入车信息"] };
  let blocks = normalized.split(/(?=车号[：:])/).map((part) => part.trim()).filter(Boolean);
  if (!blocks.length) blocks = [normalized];

  const vehicles = [];
  const warnings = [];
  blocks.forEach((block, index) => {
    const result = extractBlock(block);
    if (Object.keys(result.vehicle).length === REQUIRED_FIELDS.length) {
      vehicles.push(result.vehicle);
    } else {
      warnings.push(`${result.vehicle.plate || `第${index + 1}条`}: ${result.warnings.join("、")}`);
    }
  });
  return { vehicles, warnings };
}

function postJson(url, payload, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload));
    const request = https.request(
      url,
      {
        method: "POST",
        timeout: timeoutMs,
        headers: {
          "content-type": "application/json",
          "content-length": body.length,
          ...headers,
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${text}`));
            return;
          }
          try {
            resolve(JSON.parse(text));
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("timeout", () => request.destroy(new Error("request timeout")));
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

async function parseWithLlm(text) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return { vehicles: [], warnings: ["请输入车信息"] };

  const apiKey = (process.env.DASHSCOPE_API_KEY || process.env.LLM_API_KEY || "").trim();
  if (!apiKey) throw new Error("缺少环境变量 DASHSCOPE_API_KEY");
  const baseUrl = (process.env.DASHSCOPE_BASE_URL || process.env.LLM_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
  const model = (process.env.DASHSCOPE_MODEL || process.env.LLM_MODEL || "glm-5").trim();
  const timeoutMs = Number(process.env.DASHSCOPE_TIMEOUT_SECONDS || process.env.LLM_TIMEOUT_SECONDS || 60) * 1000;

  const payload = await postJson(
    `${baseUrl}/chat/completions`,
    {
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: normalized },
      ],
    },
    { authorization: `Bearer ${apiKey}` },
    timeoutMs
  );

  let content = String(payload.choices?.[0]?.message?.content || "{}").trim();
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\s*|\s*```$/gi, "").trim();
  }
  const parsed = JSON.parse(content);
  const vehicles = [];
  const warnings = (parsed.warnings || []).map(String);
  (parsed.vehicles || []).forEach((raw, index) => {
    const vehicle = normalizeVehicle(raw || {});
    if (vehicle) {
      vehicles.push(vehicle);
    } else {
      warnings.push(`${raw?.plate || `第${index + 1}条`}: 字段不完整`);
    }
  });
  if (!vehicles.length && !warnings.length) warnings.push("未识别到完整车信息");
  return { vehicles, warnings };
}

async function parseDispatchText(text) {
  if (!usesLlmParse()) return parseRegex(text);
  try {
    return await parseWithLlm(text);
  } catch (error) {
    const fallback = parseRegex(text);
    if (fallback.vehicles.length) return fallback;
    const message = String(error && error.message ? error.message : error);
    const hint = message.includes("invalid_api_key") || message.includes("401")
      ? "大模型 API Key 无效，请联系管理员更新 DASHSCOPE_API_KEY"
      : `大模型识别失败：${message}`;
    return { vehicles: [], warnings: [hint, ...(fallback.warnings || [])] };
  }
}

module.exports = {
  parseDispatchText,
  parseRegex,
  usesLlmParse,
};

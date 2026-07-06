const https = require("https");

const API_BASE = "https://qyapi.weixin.qq.com/cgi-bin";

function requestJson(url, options = {}, body) {
  return new Promise((resolve, reject) => {
    const data = body == null
      ? null
      : Buffer.isBuffer(body)
        ? body
        : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
    const req = https.request(
      url,
      {
        method: options.method || "GET",
        timeout: options.timeout || 15000,
        headers: {
          ...(data ? { "content-length": data.length } : {}),
          ...(options.headers || {}),
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
    req.on("timeout", () => req.destroy(new Error("request timeout")));
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

class WeWorkClient {
  constructor(settings) {
    this.settings = settings;
    this.token = "";
    this.tokenExpiresAt = 0;
  }

  async getAccessToken() {
    const now = Date.now();
    if (this.token && now < this.tokenExpiresAt - 60000) return this.token;
    const url = `${API_BASE}/gettoken?corpid=${encodeURIComponent(this.settings.corpId)}&corpsecret=${encodeURIComponent(this.settings.agentSecret)}`;
    const payload = await requestJson(url);
    if (payload.errcode !== 0) throw new Error(`获取 access_token 失败：${payload.errmsg || JSON.stringify(payload)}`);
    this.token = payload.access_token;
    this.tokenExpiresAt = now + Number(payload.expires_in || 7200) * 1000;
    return this.token;
  }

  async sendText(userid, content) {
    await this.sendMessage({
      touser: userid,
      msgtype: "text",
      agentid: this.settings.agentId,
      text: { content },
      safe: 0,
    });
  }

  async sendFile(userid, filename, content) {
    const mediaId = await this.uploadFile(filename, content);
    await this.sendMessage({
      touser: userid,
      msgtype: "file",
      agentid: this.settings.agentId,
      file: { media_id: mediaId },
      safe: 0,
    });
  }

  async sendMessage(body) {
    const token = await this.getAccessToken();
    const payload = await requestJson(`${API_BASE}/message/send?access_token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    }, body);
    if (payload.errcode !== 0) throw new Error(`发送消息失败：${payload.errmsg || JSON.stringify(payload)}`);
  }

  async uploadFile(filename, content) {
    const token = await this.getAccessToken();
    const boundary = `----paiche${Date.now().toString(16)}`;
    const file = Buffer.from(content);
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="${encodeURIComponent(filename)}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`),
      file,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    const payload = await requestJson(`${API_BASE}/media/upload?access_token=${encodeURIComponent(token)}&type=file`, {
      method: "POST",
      timeout: 30000,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    }, body);
    if (payload.errcode !== 0) throw new Error(`上传文件失败：${payload.errmsg || JSON.stringify(payload)}`);
    return payload.media_id;
  }
}

module.exports = {
  WeWorkClient,
};

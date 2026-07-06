const crypto = require("crypto");

function sha1(...parts) {
  return crypto.createHash("sha1").update(parts.sort().join("")).digest("hex");
}

function keyBuffer(encodingAesKey) {
  return Buffer.from(`${encodingAesKey}=`, "base64");
}

function pkcs7Unpad(buffer) {
  const pad = buffer[buffer.length - 1];
  if (pad < 1 || pad > 32) return buffer;
  return buffer.subarray(0, buffer.length - pad);
}

function pkcs7Pad(buffer) {
  const blockSize = 32;
  const pad = blockSize - (buffer.length % blockSize || blockSize);
  return Buffer.concat([buffer, Buffer.alloc(pad, pad)]);
}

function extractXmlField(xml, tag) {
  const pattern = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}>([\\s\\S]*?)</${tag}>`);
  const match = pattern.exec(xml || "");
  return match ? (match[1] || match[2] || "") : "";
}

function verifySignature(token, timestamp, nonce, encrypt, msgSignature) {
  const expected = sha1(token, timestamp, nonce, encrypt);
  return expected === msgSignature;
}

function decryptPayload(settings, msgSignature, timestamp, nonce, encrypt) {
  if (!encrypt) throw new Error("缺少 Encrypt");
  if (!verifySignature(settings.token, timestamp, nonce, encrypt, msgSignature)) {
    throw new Error("消息签名校验失败");
  }

  const key = keyBuffer(settings.encodingAesKey);
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, key.subarray(0, 16));
  decipher.setAutoPadding(false);
  const decrypted = pkcs7Unpad(Buffer.concat([decipher.update(encrypt, "base64"), decipher.final()]));
  const length = decrypted.readUInt32BE(16);
  const xml = decrypted.subarray(20, 20 + length).toString("utf8");
  const receiveId = decrypted.subarray(20 + length).toString("utf8");
  if (settings.corpId && receiveId && receiveId !== settings.corpId) {
    throw new Error("CorpID 校验失败");
  }
  return xml;
}

function decryptMessage(settings, msgSignature, timestamp, nonce, encryptedXml) {
  return decryptPayload(settings, msgSignature, timestamp, nonce, extractXmlField(encryptedXml, "Encrypt"));
}

function decryptEcho(settings, msgSignature, timestamp, nonce, echostr) {
  return decryptPayload(settings, msgSignature, timestamp, nonce, echostr);
}

function encryptMessage(settings, xml, nonce, timestamp = String(Math.floor(Date.now() / 1000))) {
  const key = keyBuffer(settings.encodingAesKey);
  const xmlBuffer = Buffer.from(xml);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(xmlBuffer.length, 0);
  const random = crypto.randomBytes(16);
  const payload = pkcs7Pad(Buffer.concat([random, length, xmlBuffer, Buffer.from(settings.corpId)]));
  const cipher = crypto.createCipheriv("aes-256-cbc", key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  const encrypt = Buffer.concat([cipher.update(payload), cipher.final()]).toString("base64");
  const signature = sha1(settings.token, timestamp, nonce, encrypt);
  return `<xml><Encrypt><![CDATA[${encrypt}]]></Encrypt><MsgSignature><![CDATA[${signature}]]></MsgSignature><TimeStamp>${timestamp}</TimeStamp><Nonce><![CDATA[${nonce}]]></Nonce></xml>`;
}

function buildTextReplyXml(toUser, fromUser, content, timestamp = String(Math.floor(Date.now() / 1000))) {
  return `<xml><ToUserName><![CDATA[${toUser}]]></ToUserName><FromUserName><![CDATA[${fromUser}]]></FromUserName><CreateTime>${timestamp}</CreateTime><MsgType><![CDATA[text]]></MsgType><Content><![CDATA[${content}]]></Content></xml>`;
}

module.exports = {
  buildTextReplyXml,
  decryptEcho,
  decryptMessage,
  encryptMessage,
  extractXmlField,
  verifySignature,
};

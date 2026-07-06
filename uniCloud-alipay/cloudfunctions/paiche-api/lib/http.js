function normalizePath(path) {
  const value = path || "/";
  return value.startsWith("/") ? value : `/${value}`;
}

function bodyText(event) {
  if (!event || event.body == null) return "";
  if (event.isBase64Encoded) {
    return Buffer.from(event.body, "base64").toString("utf8");
  }
  return typeof event.body === "string" ? event.body : JSON.stringify(event.body);
}

function jsonBody(event) {
  const text = bodyText(event).trim();
  if (!text) return {};
  return JSON.parse(text);
}

function response(statusCode, headers, body, isBase64Encoded = false) {
  return {
    mpserverlessComposedResponse: true,
    statusCode,
    headers,
    body,
    isBase64Encoded,
  };
}

function json(statusCode, payload) {
  return response(
    statusCode,
    {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
    JSON.stringify(payload)
  );
}

function text(statusCode, body, contentType = "text/plain; charset=utf-8") {
  return response(
    statusCode,
    {
      "content-type": contentType,
      "access-control-allow-origin": "*",
    },
    body
  );
}

function binary(statusCode, buffer, filename, contentType) {
  return response(
    statusCode,
    {
      "content-type": contentType,
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "access-control-allow-origin": "*",
      "access-control-expose-headers": "content-disposition",
    },
    Buffer.from(buffer).toString("base64"),
    true
  );
}

module.exports = {
  binary,
  bodyText,
  json,
  jsonBody,
  normalizePath,
  response,
  text,
};

# Project Agent Notes

This project uses the uni-app / uniCloud ecosystem.

## Official References

- uni-app / uni-app x AI: https://doc.dcloud.net.cn/uni-app-x/ai/
- uni-agent: https://doc.dcloud.net.cn/uni-app-x/ai/uni-agent.html
- uniCloud: https://doc.dcloud.net.cn/uniCloud/
- AI Rules and MCP: https://doc.dcloud.net.cn/uni-app-x/tutorial/rules_mcp.html

## Cursor MCP

The project-level Cursor MCP config enables DCloud's official uni-app-x MCP server:

```json
{
  "mcpServers": {
    "uni-app-x": {
      "command": "npx",
      "args": ["-y", "uni-app-x-mcp"],
      "env": {
        "HTTP_PROXY": "http://127.0.0.1:7897",
        "HTTPS_PROXY": "http://127.0.0.1:7897",
        "npm_config_proxy": "http://127.0.0.1:7897",
        "npm_config_https_proxy": "http://127.0.0.1:7897",
        "npm_config_registry": "https://registry.npmjs.org"
      }
    }
  }
}
```

Use the MCP component context when generating or editing uni-app pages, especially when reusing easycom components already available in the project.

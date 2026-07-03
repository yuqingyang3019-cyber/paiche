# paiche

乌达派车填表助手 — 粘贴或企业微信转发车信息，自动生成今日 Excel。

## 本地运行

```bash
# 1. 安装依赖
python3 -m pip install -r agent/requirements-dev.txt

# 2. 构建 H5（Vue 3）
node frontend/build.mjs

# 3. 启动服务
cd agent && python3 -m uvicorn main:app --reload --port 9000
```

浏览器打开：http://127.0.0.1:9000

使用方式：粘贴一条或多条车信息 →「添加到列表」→ 可多次添加 → 凑齐后点「生成今日 Excel」。一次粘贴多条时，每条需以「车号：」开头。

解析：配置百炼 `DASHSCOPE_API_KEY` 后使用 glm-5 大模型；未配置时回退正则。

本地写在项目根目录 `.env.local`：

```bash
DASHSCOPE_API_KEY=你的百炼API密钥
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=glm-5

# 企业微信（可选，启用转发入服）
WEWORK_CORP_ID=企业ID
WEWORK_AGENT_ID=应用AgentId
WEWORK_AGENT_SECRET=应用Secret
WEWORK_TOKEN=回调Token（自定）
WEWORK_ENCODING_AES_KEY=回调EncodingAESKey（企微后台生成）
```

若使用业务空间专属域名，把 `DASHSCOPE_BASE_URL` 换成百炼控制台里显示的地址即可。

## 企业微信使用（推荐）

1. 注册 [企业微信](https://work.weixin.qq.com/) 并创建自建应用「乌达派车助手」
2. 部署 FC 后，在应用「接收消息」填写：
   - URL：`https://你的FC地址/api/wework/callback`
   - Token / EncodingAESKey：与 `.env.local` 一致
3. 手机安装企业微信，将个人微信里的车信息**逐条转发**到该应用
4. 在应用里发送「列表」查看今日车辆，发送「生成」获取 Excel 文件

指令：`帮助` · `列表` · `生成` · `清空`

## 空白模板

程序只使用 [`agent/template/wuda-junzheng.xlsx`](agent/template/wuda-junzheng.xlsx) 这份**预生成的空白模板**。

根目录的 `乌达君正7.1.xlsx` 只是样例参考，不会被程序直接读取。若表头或版式有更新，运行：

```bash
python3 scripts/build_blank_template.py
```

## 测试

```bash
cd agent && python3 -m pytest tests -q
```

## 部署 FC

```bash
node frontend/build.mjs
s deploy -t s.yaml --assume-yes
```

部署后把控制台给出的 **HTTPS** 地址填到企业微信回调 URL。

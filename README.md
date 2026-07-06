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

浏览器打开：http://127.0.0.1:9000（本地无路径前缀；线上为 `/paiche`）

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
```

`WEWORK_TOKEN` 与 `WEWORK_ENCODING_AES_KEY` 已写死在项目中，企微后台「接收消息」填下面两个固定值即可：

| 配置项 | 固定值 |
|---|---|
| Token | `69Ku5OIg` |
| EncodingAESKey | `abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG` |

若使用业务空间专属域名，把 `DASHSCOPE_BASE_URL` 换成百炼控制台里显示的地址即可。

## 线上地址

- H5：`https://agent.water-healer.com/paiche/`
- 企微回调：`https://agent.water-healer.com/paiche/api/wework/callback`

自定义域名路由 `/paiche/*` 在阿里云 FC 控制台配置，与 `s.yaml` 中的 `BASE_PATH=/paiche` 对应。

## 企业微信使用（推荐）

1. 注册 [企业微信](https://work.weixin.qq.com/) 并创建自建应用「乌达派车助手」
2. 在应用「接收消息」填写：
   - URL：`https://agent.water-healer.com/paiche/api/wework/callback`
   - Token：`69Ku5OIg`
   - EncodingAESKey：`abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG`
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
# 1. 构建 wheelhouse（与 wole 相同，离线安装依赖，加速冷启动）
bash scripts/build_wheelhouse.sh

# 2. 构建前端并部署
node frontend/build.mjs
s deploy -t s.yaml --assume-yes
```

也可 push 到 `main` 分支，由 GitHub Actions 自动构建 wheelhouse 并部署。

**冷启动原理**：CI 用 Docker 把 Python 依赖打成 Linux wheel 包（`agent/wheelhouse/`），随函数代码上传；FC 启动时 `bootstrap.sh` 从本地 wheelhouse 安装，不走公网 pip，通常几秒内完成。

域名 `agent.water-healer.com` 的路由在 FC 控制台维护；`s deploy` 只更新函数代码与环境变量。

## 部署 uniCloud 支付宝云

uniCloud 版本位于 [`uniCloud-alipay`](uniCloud-alipay)，后端已迁为 URL 化云函数 `paiche-api`，前端发布目录为 [`dist/h5`](dist/h5)。

首次发布需要你先在 HBuilderX 中完成：

1. 登录 DCloud 账号。
2. 打开本项目，并关联支付宝云服务空间。
3. 在 uniCloud 控制台为 `paiche-api` 配置环境变量：
   - `DASHSCOPE_API_KEY`
   - `DASHSCOPE_BASE_URL`
   - `DASHSCOPE_MODEL`
   - `WEWORK_CORP_ID`
   - `WEWORK_AGENT_ID`
   - `WEWORK_AGENT_SECRET`
   - `WEWORK_TOKEN`
   - `WEWORK_ENCODING_AES_KEY`
4. 为 `paiche-api` 开启 URL 化，拿到云函数基础地址。
   - 云函数：`paiche-api`
   - 建议 URL 化路径：`/paiche-api`
   - 开启后先访问 `云函数基础地址/health`，应返回 `{"ok":"true"}`。

本地 CLI 发布：

```bash
UNICLOUD_PROJECT=luche \
UNICLOUD_PROVIDER=alipay \
UNICLOUD_SPACE=你的支付宝云服务空间ID或名称 \
PAICHE_API_BASE=https://你的云函数URL化地址 \
bash scripts/deploy_unicloud.sh
```

发布完成后，把企业微信「接收消息」URL 改为：

```text
https://ai.water-healer.com/paiche-api/api/wework/callback
```

如果 `cli` 命令不存在，需要把 HBuilderX 的 CLI 工具目录加入 `PATH`，或直接在 HBuilderX 内使用右键上传云函数、数据库 schema 和前端网页托管。

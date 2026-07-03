(function () {
  const STORAGE_KEY = "luche-vehicles";
  const STORAGE_DATE_KEY = "luche-date";
  const TABLE_COLUMNS = [
    { key: "factory", label: "提货工厂", required: false },
    { key: "plate", label: "车牌号", required: true },
    { key: "trailer", label: "挂车号", required: false },
    { key: "name", label: "司机姓名", required: true },
    { key: "idCard", label: "身份证号", required: true },
    { key: "phone", label: "随车电话", required: true },
    { key: "quantityA", label: "预提数量", required: true },
    { key: "quantityB", label: "预提数量", required: true },
    { key: "destination", label: "流向", required: true },
  ];

  const state = {
    inputText: "",
    vehicles: loadVehicles(),
    parsing: false,
    generating: false,
    toast: { type: "", text: "" },
    progress: { value: 0, label: "", timer: null },
  };

  function todayKey() {
    const now = new Date();
    return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  }

  function todayLabel() {
    const now = new Date();
    return `${now.getMonth() + 1}月${now.getDate()}日`;
  }

  function todayFilename() {
    const now = new Date();
    return `乌达君正${now.getMonth() + 1}.${now.getDate()}.xlsx`;
  }

  function loadVehicles() {
    if (localStorage.getItem(STORAGE_DATE_KEY) !== todayKey()) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_DATE_KEY, todayKey());
      return [];
    }
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveVehicles() {
    localStorage.setItem(STORAGE_DATE_KEY, todayKey());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.vehicles));
  }

  function toTableRow(vehicle) {
    return {
      factory: "乌达君正",
      plate: vehicle.plate || "",
      trailer: "",
      name: vehicle.name || "",
      idCard: vehicle.idCard || "",
      phone: vehicle.phone || "",
      quantityA: 37,
      quantityB: 37,
      destination: "后旗团羊",
    };
  }

  function apiBase() {
    const marker = "/paiche";
    const pathname = window.location.pathname;
    if (pathname === marker || pathname.indexOf(`${marker}/`) === 0) {
      return marker;
    }
    return "";
  }

  async function readJson(response) {
    try {
      return await response.json();
    } catch {
      return {};
    }
  }

  function errorMessage(payload, fallback) {
    if (typeof payload.detail === "string") return payload.detail;
    if (payload.detail && payload.detail.message) return payload.detail.message;
    return fallback;
  }

  async function parseDispatchText(text) {
    const response = await fetch(`${apiBase()}/api/dispatch/parse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const payload = await readJson(response);
    if (!response.ok) {
      throw new Error(errorMessage(payload, "解析失败，请稍后重试"));
    }
    return payload;
  }

  async function generateDispatch(vehicles) {
    const response = await fetch(`${apiBase()}/api/dispatch/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vehicles }),
    });
    if (!response.ok) {
      const payload = await readJson(response);
      throw new Error(errorMessage(payload, "生成失败，请稍后重试"));
    }
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const filename = match ? decodeURIComponent(match[1]) : "乌达君正.xlsx";
    return { blob: await response.blob(), filename };
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(type, text) {
    state.toast = { type, text };
    render();
  }

  function clearToast() {
    state.toast = { type: "", text: "" };
  }

  function stopProgress() {
    if (state.progress.timer) {
      clearInterval(state.progress.timer);
      state.progress.timer = null;
    }
  }

  function startProgress(text, cap, stepMs, step) {
    stopProgress();
    state.progress.value = 8;
    state.progress.label = text;
    state.progress.timer = setInterval(function () {
      if (state.progress.value < cap) {
        state.progress.value = Math.min(cap, state.progress.value + step);
        render();
      }
    }, stepMs);
    render();
  }

  function finishProgress() {
    stopProgress();
    state.progress.value = 100;
    render();
  }

  function resetProgressLater() {
    setTimeout(function () {
      stopProgress();
      state.progress.value = 0;
      state.progress.label = "";
      render();
    }, 500);
  }

  function render() {
    const app = document.getElementById("app");
    const busy = state.parsing || state.generating;
    const hasVehicles = state.vehicles.length > 0;
    const rows = state.vehicles.map(toTableRow);

    app.innerHTML = `
      <main class="page">
        <header class="hero">
          <h1>乌达派车填表</h1>
          <p>粘贴微信原文即可，格式不用整理。</p>
        </header>

        <section class="panel">
          <label class="label" for="inputText">车信息</label>
          <textarea id="inputText" ${busy ? "disabled" : ""} placeholder="直接粘贴司机或老板发来的文字，可一次贴多条">${escapeHtml(state.inputText)}</textarea>
          <button id="addButton" class="btn btn-primary" style="margin-top: 14px" ${busy ? "disabled" : ""}>
            ${state.parsing ? '<span class="spinner"></span><span>正在识别…</span>' : "<span>添加到列表</span>"}
          </button>

          ${
            state.progress.value > 0
              ? `<div class="progress-panel">
                  <div class="progress-track">
                    <div class="progress-fill" style="width: ${state.progress.value}%"></div>
                  </div>
                  <p class="progress-label">${escapeHtml(state.progress.label)}（${state.progress.value}%）</p>
                </div>`
              : ""
          }

          ${state.toast.text ? `<p class="toast ${state.toast.type}">${escapeHtml(state.toast.text)}</p>` : ""}
        </section>

        <div class="section-head">
          <h2>${todayLabel()}列表${hasVehicles ? `<span class="count">（${state.vehicles.length} 辆）</span>` : ""}</h2>
          ${hasVehicles ? `<button id="clearButton" class="btn btn-ghost" type="button" ${busy ? "disabled" : ""}>清空</button>` : ""}
        </div>

        ${
          !hasVehicles
            ? '<div class="empty">还没有车辆。粘贴信息后点「添加到列表」。</div>'
            : `<div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      ${TABLE_COLUMNS.map((col) => `<th>${escapeHtml(col.label)}${col.required ? '<span class="required">（必填）</span>' : ""}</th>`).join("")}
                      <th class="action-col">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rows
                      .map(
                        (row, index) => `
                          <tr>
                            ${TABLE_COLUMNS.map((col) => `<td>${escapeHtml(row[col.key])}</td>`).join("")}
                            <td class="action-col">
                              <button class="btn btn-ghost danger remove-button" data-index="${index}" type="button" ${busy ? "disabled" : ""}>删除</button>
                            </td>
                          </tr>`
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>`
        }
      </main>

      ${
        hasVehicles
          ? `<footer class="bottom-bar">
              <div class="bottom-inner">
                <p class="filename">文件名：${todayFilename()}</p>
                <button id="downloadButton" class="btn btn-primary" ${busy ? "disabled" : ""}>
                  ${state.generating ? '<span class="spinner"></span><span>正在生成…</span>' : `<span>生成${todayLabel()} Excel</span>`}
                </button>
              </div>
            </footer>`
          : ""
      }
    `;

    bindEvents();
  }

  function bindEvents() {
    const input = document.getElementById("inputText");
    const addButton = document.getElementById("addButton");
    const clearButton = document.getElementById("clearButton");
    const downloadButton = document.getElementById("downloadButton");

    if (input) {
      input.addEventListener("input", function () {
        state.inputText = input.value;
      });
    }
    if (addButton) addButton.addEventListener("click", addToList);
    if (clearButton) clearButton.addEventListener("click", clearAll);
    if (downloadButton) downloadButton.addEventListener("click", downloadExcel);
    document.querySelectorAll(".remove-button").forEach(function (button) {
      button.addEventListener("click", function () {
        removeVehicle(Number(button.getAttribute("data-index")));
      });
    });
  }

  function removeVehicle(index) {
    state.vehicles.splice(index, 1);
    clearToast();
    saveVehicles();
    render();
  }

  function clearAll() {
    if (!state.vehicles.length || !window.confirm(`确定清空${todayLabel()}列表？`)) {
      return;
    }
    state.vehicles = [];
    clearToast();
    saveVehicles();
    render();
  }

  async function addToList() {
    clearToast();
    const input = document.getElementById("inputText");
    const text = (input ? input.value : state.inputText).trim();
    state.inputText = text;
    if (!text) {
      showToast("warning", "请先粘贴司机发来的车信息");
      return;
    }

    state.parsing = true;
    startProgress("大模型正在识别车信息，大约 10-20 秒", 92, 400, 4);
    try {
      const payload = await parseDispatchText(text);
      const incoming = payload.vehicles || [];
      if (!incoming.length) {
        showToast("warning", (payload.warnings || []).join("；") || "没有识别到完整车信息");
        return;
      }

      const plates = new Set(state.vehicles.map((item) => item.plate));
      let added = 0;
      const skipped = [];

      incoming.forEach(function (vehicle) {
        if (plates.has(vehicle.plate)) {
          skipped.push(vehicle.plate);
          return;
        }
        state.vehicles.push(vehicle);
        plates.add(vehicle.plate);
        added += 1;
      });

      state.inputText = "";
      saveVehicles();

      const notes = [];
      if (added) notes.push(`已添加 ${added} 辆`);
      if (skipped.length) notes.push(`重复跳过：${skipped.join("、")}`);
      if (payload.warnings && payload.warnings.length) notes.push(payload.warnings.join("；"));
      showToast(added ? "success" : "warning", notes.join("；") || "未添加新车辆");
    } catch (error) {
      showToast("error", error.message || "解析失败");
    } finally {
      finishProgress();
      state.parsing = false;
      resetProgressLater();
    }
  }

  async function downloadExcel() {
    clearToast();
    state.generating = true;
    startProgress("正在生成 Excel 表格", 96, 120, 8);
    try {
      const result = await generateDispatch(state.vehicles);
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast("success", `已生成 ${result.filename}`);
    } catch (error) {
      showToast("error", error.message || "生成失败");
    } finally {
      finishProgress();
      state.generating = false;
      resetProgressLater();
    }
  }

  window.addEventListener("error", function (event) {
    const app = document.getElementById("app");
    if (app && !app.innerHTML.trim()) {
      app.innerHTML = '<main class="page"><section class="panel"><h1>页面加载失败</h1><p class="toast error">请刷新重试，或换浏览器打开。</p></section></main>';
    }
    console.error(event.error || event.message);
  });

  render();
})();

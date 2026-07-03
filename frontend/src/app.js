import { createApp, computed, onUnmounted, ref } from "./assets/vue.esm-browser.js";
import { generateDispatch, parseDispatchText } from "./modules/api.js";
import { loadVehicles, saveVehicles, todayFilename, todayLabel } from "./modules/storage.js";
import { TABLE_COLUMNS, toTableRow } from "./modules/table.js";

function useProgress() {
  const value = ref(0);
  const label = ref("");
  let timer = null;

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start(text, cap = 92, stepMs = 400, step = 4) {
    stop();
    value.value = 8;
    label.value = text;
    timer = setInterval(() => {
      if (value.value < cap) {
        value.value = Math.min(cap, value.value + step);
      }
    }, stepMs);
  }

  function finish() {
    stop();
    value.value = 100;
  }

  function reset() {
    stop();
    value.value = 0;
    label.value = "";
  }

  onUnmounted(stop);

  return { value, label, start, finish, reset };
}

createApp({
  setup() {
    const inputText = ref("");
    const vehicles = ref(loadVehicles());
    const parsing = ref(false);
    const generating = ref(false);
    const toast = ref({ type: "", text: "" });
    const progress = useProgress();

    const hasVehicles = computed(() => vehicles.value.length > 0);
    const filename = computed(() => todayFilename());
    const dateLabel = computed(() => todayLabel());
    const busy = computed(() => parsing.value || generating.value);
    const tableRows = computed(() => vehicles.value.map(toTableRow));

    function showToast(type, text) {
      toast.value = { type, text };
    }

    function clearToast() {
      toast.value = { type: "", text: "" };
    }

    function persist() {
      saveVehicles(vehicles.value);
    }

    function removeVehicle(index) {
      vehicles.value.splice(index, 1);
      clearToast();
      persist();
    }

    function clearAll() {
      if (!vehicles.value.length || !window.confirm(`确定清空${todayLabel()}列表？`)) {
        return;
      }
      vehicles.value = [];
      clearToast();
      persist();
    }

    async function addToList() {
      clearToast();
      const text = inputText.value.trim();
      if (!text) {
        showToast("warning", "请先粘贴司机发来的车信息");
        return;
      }

      parsing.value = true;
      progress.start("大模型正在识别车信息，大约 10–20 秒");
      try {
        const payload = await parseDispatchText(text);
        const incoming = payload.vehicles || [];
        if (!incoming.length) {
          showToast("warning", payload.warnings?.join("；") || "没有识别到完整车信息");
          return;
        }

        const plates = new Set(vehicles.value.map((item) => item.plate));
        let added = 0;
        const skipped = [];

        for (const vehicle of incoming) {
          if (plates.has(vehicle.plate)) {
            skipped.push(vehicle.plate);
            continue;
          }
          vehicles.value.push(vehicle);
          plates.add(vehicle.plate);
          added += 1;
        }

        inputText.value = "";
        persist();

        const notes = [];
        if (added) notes.push(`已添加 ${added} 辆`);
        if (skipped.length) notes.push(`重复跳过：${skipped.join("、")}`);
        if (payload.warnings?.length) notes.push(payload.warnings.join("；"));
        showToast(added ? "success" : "warning", notes.join("；") || "未添加新车辆");
      } catch (error) {
        showToast("error", error.message || "解析失败");
      } finally {
        progress.finish();
        parsing.value = false;
        setTimeout(() => progress.reset(), 500);
      }
    }

    async function downloadExcel() {
      clearToast();
      generating.value = true;
      progress.start("正在生成 Excel 表格", 96, 120, 8);
      try {
        const { blob, filename: name } = await generateDispatch(vehicles.value);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = name;
        link.click();
        URL.revokeObjectURL(url);
        showToast("success", `已生成 ${name}`);
      } catch (error) {
        showToast("error", error.message || "生成失败");
      } finally {
        progress.finish();
        generating.value = false;
        setTimeout(() => progress.reset(), 500);
      }
    }

    return {
      inputText,
      vehicles,
      parsing,
      generating,
      busy,
      progress,
      toast,
      hasVehicles,
      filename,
      dateLabel,
      tableRows,
      columns: TABLE_COLUMNS,
      addToList,
      downloadExcel,
      removeVehicle,
      clearAll,
    };
  },
  template: `
    <main class="page">
      <header class="hero">
        <h1>乌达派车填表</h1>
        <p>粘贴微信原文即可，格式不用整理。</p>
      </header>

      <section class="panel">
        <label class="label" for="inputText">车信息</label>
        <textarea
          id="inputText"
          v-model="inputText"
          :disabled="busy"
          placeholder="直接粘贴司机或老板发来的文字，可一次贴多条"
        />
        <button class="btn btn-primary" style="margin-top: 14px" :disabled="busy" @click="addToList">
          <span v-if="parsing" class="spinner"></span>
          <span>{{ parsing ? '正在识别…' : '添加到列表' }}</span>
        </button>

        <div v-if="progress.value > 0" class="progress-panel">
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: progress.value + '%' }"></div>
          </div>
          <p class="progress-label">{{ progress.label }}（{{ progress.value }}%）</p>
        </div>

        <p v-if="toast.text" class="toast" :class="toast.type">{{ toast.text }}</p>
      </section>

      <div class="section-head">
        <h2>
          {{ dateLabel }}列表
          <span v-if="hasVehicles" class="count">（{{ vehicles.length }} 辆）</span>
        </h2>
        <button v-if="hasVehicles" class="btn btn-ghost" type="button" :disabled="busy" @click="clearAll">清空</button>
      </div>

      <div v-if="!hasVehicles" class="empty">还没有车辆。粘贴信息后点「添加到列表」。</div>

      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th v-for="col in columns" :key="col.key">
                {{ col.label }}<span v-if="col.required" class="required">（必填）</span>
              </th>
              <th class="action-col">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in tableRows" :key="vehicles[index].plate">
              <td v-for="col in columns" :key="col.key">{{ row[col.key] }}</td>
              <td class="action-col">
                <button class="btn btn-ghost danger" type="button" :disabled="busy" @click="removeVehicle(index)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>

    <footer v-if="hasVehicles" class="bottom-bar">
      <div class="bottom-inner">
        <p class="filename">文件名：{{ filename }}</p>
        <button class="btn btn-primary" :disabled="busy" @click="downloadExcel">
          <span v-if="generating" class="spinner"></span>
          <span>{{ generating ? '正在生成…' : `生成${dateLabel} Excel` }}</span>
        </button>
      </div>
    </footer>
  `,
}).mount("#app");

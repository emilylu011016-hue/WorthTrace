const DB_NAME = "worthtrace_mobile_v1";
const DB_VERSION = 1;
const RECORD_STORE = "offline_records";
const SETTINGS_KEY = "worthtrace_mobile_settings_v1";
const CUSTOM_CATEGORIES_KEY = "worthtrace_mobile_custom_categories_v1";

const baseCategories = {
  expense: ["餐饮", "交通", "购物", "居住", "日用", "医疗", "娱乐", "旅行", "人情", "学习", "运动", "宠物", "保险", "税费", "其他支出"],
  income: ["工资", "奖金", "副业", "投资收益", "分红", "利息", "报销", "退款", "红包", "租金", "其他收入"]
};

const settings = readSettings();
const customCategories = readCustomCategories();

const state = {
  view: "home",
  type: "expense",
  records: [],
  online: navigator.onLine,
  privacy: settings.privacy,
  theme: settings.theme
};

const pageTitle = document.querySelector("#pageTitle");
const offlineBanner = document.querySelector("#offlineBanner");
const syncCard = document.querySelector("#syncCard");
const syncCardTitle = document.querySelector("#syncCardTitle");
const syncCardText = document.querySelector("#syncCardText");
const syncCount = document.querySelector("#syncCount");
const syncDot = document.querySelector("#syncDot");
const localRecords = document.querySelector("#localRecords");
const bookForm = document.querySelector("#bookForm");
const dateInput = document.querySelector("#dateInput");
const amountInput = document.querySelector("#amountInput");
const categoryInput = document.querySelector("#categoryInput");
const noteInput = document.querySelector("#noteInput");
const syncDialog = document.querySelector("#syncDialog");
const syncDialogText = document.querySelector("#syncDialogText");
const privacyButton = document.querySelector("#privacyButton");
const themeButton = document.querySelector("#themeButton");
const themePanel = document.querySelector("#themePanel");
const categoryGrid = document.querySelector("#categoryGrid");
const categoryHint = document.querySelector("#categoryHint");
const homePendingCount = document.querySelector("#homePendingCount");

dateInput.value = new Date().toISOString().slice(0, 10);
applyTheme();
renderCategoryOptions();

document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.bookType) setBookType(button.dataset.bookType);
    navigate(button.dataset.nav);
  });
});

document.querySelectorAll(".segmented [data-type]").forEach((button) => {
  button.addEventListener("click", () => setBookType(button.dataset.type));
});

document.querySelectorAll(".theme-choice").forEach((button) => {
  button.addEventListener("click", () => {
    state.theme = button.dataset.theme;
    themePanel.hidden = true;
    writeSettings();
    applyTheme();
  });
});

privacyButton.addEventListener("click", () => {
  state.privacy = !state.privacy;
  writeSettings();
  render();
});

themeButton.addEventListener("click", () => {
  themePanel.hidden = !themePanel.hidden;
});

document.querySelector("#addCategoryButton").addEventListener("click", () => {
  const value = window.prompt(`新增${state.type === "income" ? "收入" : "支出"}分类名称`);
  const name = value?.trim();
  if (!name) return;
  const list = categoriesForType(state.type);
  if (!list.includes(name)) {
    customCategories[state.type].push(name);
    writeCustomCategories();
  }
  renderCategoryOptions(name);
});

bookForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const amount = Number(amountInput.value);
  if (!Number.isFinite(amount) || amount <= 0) {
    amountInput.focus();
    return;
  }
  const now = new Date().toISOString();
  const record = {
    local_id: crypto.randomUUID(),
    server_id: null,
    operation: "create",
    sync_status: "pending",
    transaction_type: state.type,
    amount,
    currency: "CNY",
    category: categoryInput.value,
    transaction_date: dateInput.value,
    note: noteInput.value.trim(),
    created_at: now,
    updated_at: now
  };
  state.records.unshift(record);
  await putRecord(record);
  amountInput.value = "";
  noteInput.value = "";
  render();
  navigate("home");
});

document.querySelector("#syncButton").addEventListener("click", showSyncDialog);
document.querySelector("#confirmSyncButton").addEventListener("click", showSyncDialog);
document.querySelector("#closeDialogButton").addEventListener("click", () => syncDialog.close());
document.querySelector("#mockSyncButton").addEventListener("click", async () => {
  state.records = state.records.map((record) => ({
    ...record,
    sync_status: "synced",
    server_id: record.server_id || `mock_${record.local_id}`
  }));
  await replaceRecords(state.records);
  syncDialog.close();
  render();
});

window.addEventListener("online", () => {
  state.online = true;
  render();
  if (pendingRecords().length > 0) showSyncDialog();
});

window.addEventListener("offline", () => {
  state.online = false;
  render();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

state.records = await readRecords();
render();

function navigate(view) {
  state.view = view;
  document.querySelectorAll(".view").forEach((section) => {
    section.classList.toggle("active", section.dataset.view === view);
  });
  document.querySelectorAll(".bottom-nav [data-nav]").forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === view);
  });
  pageTitle.textContent = {
    home: "今天",
    book: "记一笔",
    cashflow: "收支",
    allocation: "资产"
  }[view] || "今天";
}

function setBookType(type) {
  state.type = type;
  document.querySelectorAll(".segmented [data-type]").forEach((item) => {
    item.classList.toggle("active", item.dataset.type === type);
  });
  renderCategoryOptions();
}

function categoriesForType(type) {
  return [...baseCategories[type], ...customCategories[type]];
}

function renderCategoryOptions(selected = categoryInput.value) {
  const categories = categoriesForType(state.type);
  categoryInput.innerHTML = categories.map((category) => `<option>${escapeHtml(category)}</option>`).join("");
  categoryInput.value = categories.includes(selected) ? selected : categories[0];
  categoryHint.textContent = state.type === "income" ? "收入分类" : "支出分类";
  categoryGrid.innerHTML = categories.slice(0, 12).map((category) => (
    `<button type="button" data-category="${escapeHtml(category)}">${escapeHtml(category)}</button>`
  )).join("");
  categoryGrid.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      categoryInput.value = button.dataset.category;
    });
  });
}

function pendingRecords() {
  return state.records.filter((record) => record.sync_status !== "synced");
}

function render() {
  const pending = pendingRecords();
  syncCount.textContent = String(pending.length);
  homePendingCount.textContent = `${pending.length} 条`;
  syncDot.classList.toggle("offline", !state.online);
  offlineBanner.hidden = state.online;
  syncCard.hidden = pending.length === 0;
  syncCardTitle.textContent = pending.length ? `有 ${pending.length} 条记录待同步` : "没有待同步记录";
  syncCardText.textContent = state.online
    ? "已检测到网络。下一步会连接电脑本地服务。"
    : "离线记录会先保存在手机，连上电脑后同步。";
  privacyButton.textContent = state.privacy ? "显" : "隐";
  document.body.classList.toggle("privacy-on", state.privacy);
  document.querySelectorAll(".money").forEach((node) => {
    node.textContent = state.privacy ? "****" : node.dataset.value;
  });
  renderLocalRecords();
}

function renderLocalRecords() {
  if (!state.records.length) {
    localRecords.innerHTML = `
      <div class="list-row static">
        <i class="tile gold"></i>
        <span><b>还没有手机本地记录</b><small>先记一笔，看看待同步状态。</small></span>
        <em>空</em>
      </div>
    `;
    return;
  }
  localRecords.innerHTML = state.records.slice(0, 8).map((record) => {
    const sign = record.transaction_type === "income" ? "+" : "-";
    const status = record.sync_status === "synced" ? "已同步" : "待同步";
    return `
      <div class="list-row static">
        <i class="tile ${record.transaction_type === "income" ? "gold" : "rose"}"></i>
        <span>
          <b>${escapeHtml(record.category)}</b>
          <small>${record.transaction_date}${record.note ? ` · ${escapeHtml(record.note)}` : ""}</small>
        </span>
        <em>${sign}${state.privacy ? "****" : record.amount.toFixed(2)} · ${status}</em>
      </div>
    `;
  }).join("");
}

function showSyncDialog() {
  const pending = pendingRecords();
  syncDialogText.textContent = pending.length
    ? `当前有 ${pending.length} 条待同步记录。现在是原型模式，点击“模拟同步完成”会把它们标记为已同步。`
    : "当前没有待同步记录。";
  syncDialog.showModal();
}

function readSettings() {
  try {
    return { theme: "champagne", privacy: false, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { theme: "champagne", privacy: false };
  }
}

function writeSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ theme: state.theme, privacy: state.privacy }));
}

function readCustomCategories() {
  try {
    return { expense: [], income: [], ...JSON.parse(localStorage.getItem(CUSTOM_CATEGORIES_KEY) || "{}") };
  } catch {
    return { expense: [], income: [] };
  }
}

function writeCustomCategories() {
  localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(customCategories));
}

function applyTheme() {
  document.body.classList.remove("theme-champagne", "theme-sage", "theme-graphite");
  document.body.classList.add(`theme-${state.theme}`);
  document.querySelectorAll(".theme-choice").forEach((button) => {
    button.classList.toggle("active", button.dataset.theme === state.theme);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(RECORD_STORE)) {
        const store = db.createObjectStore(RECORD_STORE, { keyPath: "local_id" });
        store.createIndex("sync_status", "sync_status");
        store.createIndex("transaction_date", "transaction_date");
        store.createIndex("updated_at", "updated_at");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readRecords() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, "readonly");
    const request = tx.objectStore(RECORD_STORE).getAll();
    request.onsuccess = () => {
      resolve(request.result.sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
    };
    request.onerror = () => reject(request.error);
  });
}

async function putRecord(record) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, "readwrite");
    tx.objectStore(RECORD_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function replaceRecords(records) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(RECORD_STORE, "readwrite");
    const store = tx.objectStore(RECORD_STORE);
    store.clear();
    records.forEach((record) => store.put(record));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

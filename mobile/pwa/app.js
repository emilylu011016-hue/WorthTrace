const DB_NAME = "worthtrace_mobile_v1";
const DB_VERSION = 1;
const RECORD_STORE = "offline_records";

const state = {
  view: "home",
  type: "expense",
  records: [],
  online: navigator.onLine
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
const accountInput = document.querySelector("#accountInput");
const noteInput = document.querySelector("#noteInput");
const syncDialog = document.querySelector("#syncDialog");
const syncDialogText = document.querySelector("#syncDialogText");

dateInput.value = new Date().toISOString().slice(0, 10);

document.querySelectorAll("[data-nav]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.nav));
});

document.querySelectorAll(".segmented [data-type]").forEach((button) => {
  button.addEventListener("click", () => {
    state.type = button.dataset.type;
    document.querySelectorAll(".segmented [data-type]").forEach((item) => {
      item.classList.toggle("active", item === button);
    });
  });
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
    sync_status: state.online ? "pending" : "pending",
    transaction_type: state.type,
    amount,
    currency: "CNY",
    category: categoryInput.value,
    account: accountInput.value,
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
  if (pendingRecords().length > 0) {
    showSyncDialog();
  }
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
    wallet: "资产",
    monthend: "月末"
  }[view] || "今天";
}

function pendingRecords() {
  return state.records.filter((record) => record.sync_status !== "synced");
}

function render() {
  const pending = pendingRecords();
  syncCount.textContent = String(pending.length);
  syncDot.classList.toggle("offline", !state.online);
  offlineBanner.hidden = state.online;
  syncCard.hidden = pending.length === 0;
  syncCardTitle.textContent = pending.length ? `有 ${pending.length} 条记录待同步` : "没有待同步记录";
  syncCardText.textContent = state.online
    ? "已检测到网络。下一步会连接电脑本地服务。"
    : "离线记录会先保存在手机，连上电脑后同步。";
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
          <b>${record.category}</b>
          <small>${record.transaction_date} · ${record.account}${record.note ? ` · ${escapeHtml(record.note)}` : ""}</small>
        </span>
        <em>${sign}${record.amount.toFixed(2)} · ${status}</em>
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

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
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
    const store = tx.objectStore(RECORD_STORE);
    const request = store.getAll();
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

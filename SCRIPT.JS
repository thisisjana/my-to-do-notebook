/* ============================================================
   MY TO-DO NOTEBOOK — script.js
   A small, readable Vanilla JS to-do manager.

   Data flow for every action:
     user action -> update data -> save to localStorage
                 -> render list -> show feedback
   ============================================================ */

/* ---------- State ---------- */
// Each task looks like: { id: 1, description: "...", completed: false }
let tasks = [];
let nextId = 1; // increasing counter so IDs are never reused
let currentFilter = "all"; // "all" | "active" | "completed"
let searchTerm = "";
let editingId = null; // task being edited, or null when adding
let deletingId = null; // task queued for deletion

const STORAGE_KEY = "todo-notebook";

/* ---------- Element references ---------- */
const els = {
  list: document.getElementById("taskList"),
  count: document.getElementById("taskCount"),
  search: document.getElementById("searchInput"),
  filters: document.querySelectorAll(".filter"),
  clearCompleted: document.getElementById("clearCompletedBtn"),

  // Empty state
  empty: document.getElementById("emptyState"),
  emptyTitle: document.getElementById("emptyTitle"),
  emptyText: document.getElementById("emptyText"),
  emptyAddBtn: document.getElementById("emptyAddBtn"),

  // Add / edit modal
  openAddBtn: document.getElementById("openAddBtn"),
  taskModal: document.getElementById("taskModal"),
  taskForm: document.getElementById("taskForm"),
  taskInput: document.getElementById("taskInput"),
  taskError: document.getElementById("taskError"),
  modalTitle: document.getElementById("modalTitle"),
  modalMeta: document.getElementById("modalMeta"),
  modalSubmit: document.getElementById("modalSubmit"),

  // Delete modal
  deleteModal: document.getElementById("deleteModal"),
  deletePreview: document.getElementById("deletePreview"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),

  toasts: document.getElementById("toasts"),
};

/* ============================================================
   STORAGE
   ============================================================ */
function saveTasks() {
  const data = { tasks, nextId };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadTasks() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    tasks = Array.isArray(data.tasks) ? data.tasks : [];
    // Keep nextId ahead of any existing id so we never create duplicates.
    const maxId = tasks.reduce((m, t) => Math.max(m, t.id), 0);
    nextId = Math.max(data.nextId || 1, maxId + 1);
  } catch {
    tasks = [];
    nextId = 1;
  }
}

/* ============================================================
   HELPERS
   ============================================================ */
function findTaskById(id) {
  return tasks.find((t) => t.id === id);
}

// Format ids as 01, 02, ... for the notebook look.
function formatId(id) {
  return String(id).padStart(2, "0");
}

/* ============================================================
   CRUD OPERATIONS
   ============================================================ */
function addTask(description) {
  tasks.push({ id: nextId, description, completed: false });
  nextId++; // ensure the next task gets a brand-new id
  saveTasks();
  render();
  showToast("Task added successfully.");
}

function updateTask(id, description) {
  const task = findTaskById(id);
  if (!task) return;
  task.description = description; // id and completion status are kept
  saveTasks();
  render();
  showToast("Task updated successfully.");
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  render();
  showToast("Task deleted successfully.");
}

function toggleTask(id) {
  const task = findTaskById(id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  render();
  showToast(
    task.completed ? "Task marked as completed." : "Task marked as active."
  );
}

function clearCompleted() {
  tasks = tasks.filter((t) => !t.completed);
  saveTasks();
  render();
  showToast("Completed tasks cleared.");
}

/* ============================================================
   FILTER + SEARCH
   ============================================================ */
function getVisibleTasks() {
  const term = searchTerm.trim().toLowerCase();
  return tasks.filter((task) => {
    // Filter by status
    if (currentFilter === "active" && task.completed) return false;
    if (currentFilter === "completed" && !task.completed) return false;
    // Filter by search text
    if (term && !task.description.toLowerCase().includes(term)) return false;
    return true;
  });
}

/* ============================================================
   RENDERING
   ============================================================ */
function render() {
  const visible = getVisibleTasks();

  // Build the task rows
  els.list.innerHTML = "";
  visible.forEach((task) => els.list.appendChild(buildTaskElement(task)));

  renderEmptyState(visible.length);
  renderCount();
  renderClearButton();
}

function buildTaskElement(task) {
  const li = document.createElement("li");
  li.className = "task" + (task.completed ? " is-completed" : "");

  // Checkbox
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task__check";
  checkbox.checked = task.completed;
  checkbox.setAttribute(
    "aria-label",
    (task.completed ? "Mark active: " : "Mark completed: ") + task.description
  );
  checkbox.addEventListener("change", () => toggleTask(task.id));

  // Body: id badge + description
  const body = document.createElement("div");
  body.className = "task__body";

  const idBadge = document.createElement("span");
  idBadge.className = "task__id";
  idBadge.textContent = formatId(task.id);

  const text = document.createElement("span");
  text.className = "task__text";
  text.textContent = task.description;

  body.append(idBadge, text);

  // Actions: edit + delete
  const actions = document.createElement("div");
  actions.className = "task__actions";

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.className = "task__action task__action--edit";
  editBtn.textContent = "Edit";
  editBtn.setAttribute("aria-label", "Edit task: " + task.description);
  editBtn.addEventListener("click", () => openEditModal(task.id));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "task__action task__action--delete";
  deleteBtn.textContent = "Delete";
  deleteBtn.setAttribute("aria-label", "Delete task: " + task.description);
  deleteBtn.addEventListener("click", () => openDeleteModal(task.id));

  actions.append(editBtn, deleteBtn);

  li.append(checkbox, body, actions);
  return li;
}

function renderEmptyState(visibleCount) {
  if (visibleCount > 0) {
    els.empty.hidden = true;
    return;
  }
  els.empty.hidden = false;

  // The empty message depends on WHY the list is empty.
  const hasAnyTasks = tasks.length > 0;
  const searching = searchTerm.trim() !== "";

  if (searching) {
    els.emptyTitle.textContent = "No matching tasks";
    els.emptyText.textContent = "Try a different search.";
    els.emptyAddBtn.hidden = true;
  } else if (currentFilter === "completed" && hasAnyTasks) {
    els.emptyTitle.textContent = "Nothing completed yet";
    els.emptyText.textContent = "Your completed tasks will appear here.";
    els.emptyAddBtn.hidden = true;
  } else if (currentFilter === "active" && hasAnyTasks) {
    els.emptyTitle.textContent = "No active tasks";
    els.emptyText.textContent = "Everything is done. Nice work!";
    els.emptyAddBtn.hidden = true;
  } else {
    els.emptyTitle.textContent = "Your notebook is empty";
    els.emptyText.textContent = "Add your first task to get started.";
    els.emptyAddBtn.hidden = false;
  }
}

function renderCount() {
  const total = tasks.length;
  if (total === 0) {
    els.count.textContent = "No tasks yet";
    return;
  }
  const completed = tasks.filter((t) => t.completed).length;
  const active = total - completed;
  els.count.textContent = `${active} active · ${completed} completed`;
}

function renderClearButton() {
  const hasCompleted = tasks.some((t) => t.completed);
  els.clearCompleted.hidden = !hasCompleted;
}

/* ============================================================
   ADD / EDIT MODAL
   ============================================================ */
function openAddModal() {
  editingId = null;
  els.modalTitle.textContent = "Add a new task";
  els.modalMeta.hidden = true;
  els.modalSubmit.textContent = "Add Task";
  els.taskInput.value = "";
  showModal(els.taskModal, els.taskInput);
}

function openEditModal(id) {
  const task = findTaskById(id);
  if (!task) return;
  editingId = id;
  els.modalTitle.textContent = "Edit Task";
  els.modalMeta.textContent = "Task ID: " + formatId(id);
  els.modalMeta.hidden = false;
  els.modalSubmit.textContent = "Save Changes";
  els.taskInput.value = task.description;
  showModal(els.taskModal, els.taskInput);
}

function submitTaskForm(event) {
  event.preventDefault();
  const value = els.taskInput.value.trim();

  // Validation: description cannot be empty / whitespace only.
  if (value === "") {
    els.taskError.hidden = false;
    els.taskInput.classList.add("has-error");
    els.taskInput.focus();
    return;
  }

  if (editingId === null) {
    addTask(value);
  } else {
    updateTask(editingId, value);
  }
  closeModal(els.taskModal);
}

/* ============================================================
   DELETE MODAL
   ============================================================ */
function openDeleteModal(id) {
  const task = findTaskById(id);
  if (!task) return;
  deletingId = id;
  els.deletePreview.textContent = task.description;
  showModal(els.deleteModal, els.confirmDeleteBtn);
}

function confirmDelete() {
  if (deletingId !== null) {
    deleteTask(deletingId);
    deletingId = null;
  }
  closeModal(els.deleteModal);
}

/* ============================================================
   MODAL PLUMBING (open/close + accessibility)
   ============================================================ */
let lastFocused = null;

function showModal(modal, focusTarget) {
  lastFocused = document.activeElement;
  modal.hidden = false;
  // Reset any previous validation UI on the add/edit modal.
  els.taskError.hidden = true;
  els.taskInput.classList.remove("has-error");
  if (focusTarget) focusTarget.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  if (lastFocused && typeof lastFocused.focus === "function") {
    lastFocused.focus();
  }
}

function closeAllModals() {
  closeModal(els.taskModal);
  closeModal(els.deleteModal);
}

/* ============================================================
   TOASTS
   ============================================================ */
function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  els.toasts.appendChild(toast);

  // Auto-dismiss after a short, calm delay.
  setTimeout(() => {
    toast.classList.add("is-leaving");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, 2400);
}

/* ============================================================
   EVENT WIRING
   ============================================================ */
function setFilter(filter, button) {
  currentFilter = filter;
  els.filters.forEach((f) => {
    const isActive = f === button;
    f.classList.toggle("is-active", isActive);
    f.setAttribute("aria-selected", String(isActive));
  });
  render();
}

function init() {
  loadTasks();
  render();

  // Open add modal (header + empty state buttons)
  els.openAddBtn.addEventListener("click", openAddModal);
  els.emptyAddBtn.addEventListener("click", openAddModal);

  // Add / edit form
  els.taskForm.addEventListener("submit", submitTaskForm);
  // Clear the error the moment the user starts fixing the input.
  els.taskInput.addEventListener("input", () => {
    els.taskError.hidden = true;
    els.taskInput.classList.remove("has-error");
  });

  // Delete confirmation
  els.confirmDeleteBtn.addEventListener("click", confirmDelete);

  // Any element with data-close closes its modal (overlay + cancel buttons)
  document.querySelectorAll("[data-close]").forEach((el) => {
    el.addEventListener("click", () => {
      const which = el.getAttribute("data-close");
      closeModal(which === "delete" ? els.deleteModal : els.taskModal);
    });
  });

  // Close modals with Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllModals();
  });

  // Search (updates instantly as the user types)
  els.search.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    render();
  });

  // Filters
  els.filters.forEach((btn) => {
    btn.addEventListener("click", () => setFilter(btn.dataset.filter, btn));
  });

  // Clear completed
  els.clearCompleted.addEventListener("click", clearCompleted);
}

document.addEventListener("DOMContentLoaded", init);

/**
 * Diccionario de grupos → ID de carpeta de Google Drive
 * Agrega más grupos aquí cuando los tengas.
 *
 * Ejemplo:
 * "5 grado": "OTRO_ID_DE_CARPETA",
 * "6 grado": "OTRO_ID",
 */
const GROUPS = {
  "4 grado": "1bzGqNBcVxNw-biWlALLJS0a_OM8rKIyo"
  // Agrega más aquí ↓
  // "5 grado": "ID_DE_LA_CARPETA_5",
};

/**
 * URL de tu Google Apps Script desplegado como Web App.
 * Después de desplegar el script, pega aquí la URL completa
 * (termina en /exec).
 *
 * Ejemplo: "https://script.google.com/macros/s/AKfycb.../exec"
 */
const SCRIPT_URL = "PEGAR_AQUI_LA_URL_DE_TU_APPS_SCRIPT";

// ---------- Lógica de la interfaz ----------

const groupSelect = document.getElementById("group");
const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const fileInfo = document.getElementById("fileInfo");
const submitBtn = document.getElementById("submitBtn");
const form = document.getElementById("uploadForm");
const statusEl = document.getElementById("status");
const studentNameInput = document.getElementById("studentName");

// Llenar el select de grupos
Object.keys(GROUPS).forEach((name) => {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  groupSelect.appendChild(opt);
});

// Mostrar info del archivo seleccionado
function showFileInfo(file) {
  if (!file) {
    fileInfo.classList.add("hidden");
    submitBtn.disabled = true;
    return;
  }
  const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
  fileInfo.innerHTML = `
    <span class="name" title="${file.name}">${file.name}</span>
    <span class="size">${sizeMB} MB</span>
    <button type="button" class="remove" title="Quitar archivo" aria-label="Quitar">×</button>
  `;
  fileInfo.classList.remove("hidden");
  submitBtn.disabled = !groupSelect.value;

  fileInfo.querySelector(".remove").addEventListener("click", () => {
    fileInput.value = "";
    showFileInfo(null);
  });
}

fileInput.addEventListener("change", () => {
  showFileInfo(fileInput.files[0] || null);
});

groupSelect.addEventListener("change", () => {
  submitBtn.disabled = !(groupSelect.value && fileInput.files[0]);
});

// Drag & drop
["dragenter", "dragover"].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach((ev) => {
  dropzone.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
  });
});
dropzone.addEventListener("drop", (e) => {
  const files = e.dataTransfer.files;
  if (files.length) {
    fileInput.files = files;
    showFileInfo(files[0]);
  }
});

// ---------- Subida ----------

function setStatus(type, message) {
  statusEl.className = `status ${type}`;
  statusEl.innerHTML = message;
  statusEl.classList.remove("hidden");
}

function setLoading(loading) {
  const btnText = submitBtn.querySelector(".btn-text");
  const btnLoading = submitBtn.querySelector(".btn-loading");
  if (loading) {
    btnText.classList.add("hidden");
    btnLoading.classList.remove("hidden");
    submitBtn.disabled = true;
  } else {
    btnText.classList.remove("hidden");
    btnLoading.classList.add("hidden");
    submitBtn.disabled = !(groupSelect.value && fileInput.files[0]);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (SCRIPT_URL.includes("PEGAR_AQUI")) {
    setStatus(
      "error",
      "Falta configurar la URL del Apps Script.<br>Abre <code>script.js</code> y pega la URL de tu Web App."
    );
    return;
  }

  const group = groupSelect.value;
  const folderId = GROUPS[group];
  const file = fileInput.files[0];
  const studentName = studentNameInput.value.trim();

  if (!folderId || !file) {
    setStatus("error", "Selecciona un grupo y un archivo.");
    return;
  }

  // Límite práctico de Apps Script (~50 MB, usamos 45 por seguridad)
  if (file.size > 45 * 1024 * 1024) {
    setStatus("error", "El archivo es demasiado grande (máximo aprox. 45 MB).");
    return;
  }

  setLoading(true);
  setStatus("inf
... 

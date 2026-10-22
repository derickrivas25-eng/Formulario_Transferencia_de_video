
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx5wwASuQDPJi5PcMEj7Ud1pryVcivNBIBnDxH5vRZ0qSzeGfGBdM2z7tGuL9SE9Ha3/exec";

const DATABASE_URL =
  "https://raw.githubusercontent.com/TU_USUARIO/TU_REPOSITORIO/main/escuelas.json";

// Cada parte pesa 20 MB antes de convertirla a Base64.
const CHUNK_SIZE = 20 * 1024 * 1024;

let escuelas = {};
let uploading = false;

const $ = (id) => document.getElementById(id);

function setStatus(message, type = "info") {
  const status = $("status");
  if (!status) return;

  status.textContent = message;
  status.dataset.type = type;
}

function crearCampoSiNoExiste(id, labelText, type = "text") {
  let campo = $(id);
  if (campo) return campo;

  const form = $("uploadForm");
  if (!form) {
    throw new Error("No se encontró el formulario uploadForm.");
  }

  const wrapper = document.createElement("div");
  wrapper.style.marginBottom = "12px";

  const label = document.createElement("label");
  label.htmlFor = id;
  label.textContent = labelText;
  label.style.display = "block";
  label.style.marginBottom = "5px";

  campo = document.createElement(type === "select" ? "select" : "input");
  campo.id = id;
  campo.name = id;

  if (type !== "select") {
    campo.type = type;
  }

  campo.style.width = "100%";
  campo.style.boxSizing = "border-box";
  campo.style.padding = "10px";

  wrapper.append(label, campo);

  const group = $("group");
  if (group && group.parentElement) {
    group.parentElement.before(wrapper);
  } else {
    form.prepend(wrapper);
  }

  return campo;
}

function prepararInterfaz() {
  crearCampoSiNoExiste("school", "Escuela", "select");
  crearCampoSiNoExiste("schoolKey", "Clave de la escuela (si corresponde)", "password");

  let progress = $("uploadProgress");
  if (!progress) {
    progress = document.createElement("progress");
    progress.id = "uploadProgress";
    progress.max = 100;
    progress.value = 0;
    progress.style.display = "block";
    progress.style.width = "100%";
    progress.style.marginTop = "10px";

    const status = $("status");
    if (status) {
      status.after(progress);
    } else {
      $("uploadForm")?.append(progress);
    }
  }

  let progressText = $("progressText");
  if (!progressText) {
    progressText = document.createElement("p");
    progressText.id = "progressText";
    progressText.textContent = "0 %";

    progress.insertAdjacentElement("afterend", progressText);
  }

  $("school").addEventListener("change", actualizarGrupos);
}

async function cargarEscuelas() {
  const respuesta = await fetch(DATABASE_URL, {
    cache: "no-store"
  });

  if (!respuesta.ok) {
    throw new Error("No se pudo cargar escuelas.json desde GitHub.");
  }

  const baseDatos = await respuesta.json();

  if (!baseDatos.escuelas || typeof baseDatos.escuelas !== "object") {
    throw new Error("El archivo JSON no contiene el objeto escuelas.");
  }

  escuelas = baseDatos.escuelas;

  const schoolSelect = $("school");
  schoolSelect.replaceChildren();

  const opcionInicial = document.createElement("option");
  opcionInicial.value = "";
  opcionInicial.textContent = "Selecciona tu escuela";
  schoolSelect.append(opcionInicial);

  for (const [codigo, escuela] of Object.entries(escuelas)) {
    const opcion = document.createElement("option");
    opcion.value = codigo;
    opcion.textContent = escuela.nombre || codigo;
    schoolSelect.append(opcion);
  }

  actualizarGrupos();
}

function actualizarGrupos() {
  const schoolCode = $("school").value;
  const groupSelect = $("group");

  if (!groupSelect) {
    setStatus("No se encontró el selector de grupo.", "error");
    return;
  }

  groupSelect.replaceChildren();

  const opcionInicial = document.createElement("option");
  opcionInicial.value = "";
  opcionInicial.textContent = "Selecciona tu grupo";
  groupSelect.append(opcionInicial);

  const escuela = escuelas[schoolCode];
  const grupos = escuela?.grupos || {};

  for (const grupo of Object.keys(grupos)) {
    const opcion = document.createElement("option");
    opcion.value = grupo;
    opcion.textContent = grupo;
    groupSelect.append(opcion);
  }

  groupSelect.disabled = Object.keys(grupos).length === 0;

  const keyField = $("schoolKey");
  keyField.value = "";
  keyField.required = Boolean(escuela?.clave);

  if (!schoolCode) {
    setStatus("Selecciona tu escuela para ver los grupos.");
  } else if (Object.keys(grupos).length === 0) {
    setStatus("Esta escuela todavía no tiene grupos configurados.", "error");
  } else {
    setStatus("Selecciona tu grupo y adjunta tu archivo.");
  }
}

function validarArchivo(file) {
  if (!file) {
    throw new Error("Selecciona un archivo.");
  }

  if (file.size <= 0) {
    throw new Error("El archivo está vacío.");
  }

  const extensionesPermitidas = [
    "mp4", "mov", "avi", "mkv", "webm",
    "pdf",
    "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "odt", "ods", "odp",
    "jpg", "jpeg", "png", "gif", "webp", "bmp"
  ];

  const nombre = file.name.toLowerCase();
  const extension = nombre.includes(".")
    ? nombre.split(".").pop()
    : "";

  if (!extensionesPermitidas.includes(extension)) {
    throw new Error(
      "Formato no permitido. Usa videos, documentos Office, imágenes o PDF."
    );
  }

  // Límite de tamaño original: 500 MB.
  const MAX_SIZE = 500 * 1024 * 1024;

  if (file.size > MAX_SIZE) {
    throw new Error("El archivo supera el límite de 500 MB.");
  }
}

function convertirABase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const blockSize = 0x8000;

  for (let i = 0; i < bytes.length; i += blockSize) {
    const bloque = bytes.subarray(i, i + blockSize);
    binary += String.fromCharCode(...bloque);
  }

  return btoa(binary);
}

async function enviarParte({
  folderId,
  file,
  studentName,
  group,
  school,
  partNumber,
  totalParts,
  base64
}) {
  const extension = file.name.includes(".")
    ? "." + file.name.split(".").pop()
    : "";

  const nombreBase = extension
    ? file.name.slice(0, -extension.length)
    : file.name;

  const numero = String(partNumber).padStart(
    String(totalParts).length,
    "0"
  );

  const nombreParte =
    `${nombreBase}.parte-${numero}-de-${totalParts}${extension}`;

  const payload = {
    folderId,
    fileName: nombreParte,
    originalFileName: file.name,
    mimeType: file.type || "application/octet-stream",
    data: base64,
    studentName,
    group,
    school,
    partNumber,
    totalParts
  };

  const respuesta = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  if (!respuesta.ok) {
    throw new Error(`Error del servidor HTTP ${respuesta.status}.`);
  }

  const texto = await respuesta.text();

  let resultado;
  try {
    resultado = JSON.parse(texto);
  } catch {
    throw new Error(
      "El servidor no devolvió una respuesta JSON válida. Verifica la implementación de Apps Script."
    );
  }

  if (resultado.success === false || resultado.error) {
    throw new Error(resultado.error || "No se pudo guardar una parte.");
  }

  return resultado;
}

async function subirArchivo() {
  if (uploading) return;

  const form = $("uploadForm");
  const submitBtn = $("submitBtn");
  const fileInput = $("fileInput");
  const studentName = $("studentName")?.value.trim();
  const schoolCode = $("school")?.value;
  const group = $("group")?.value;
  const file = fileInput?.files?.[0];

  try {
    const escuela = escuelas[schoolCode];

    if (!escuela) {
      throw new Error("Selecciona una escuela válida.");
    }

    if (escuela.clave) {
      const claveIngresada = $("schoolKey").value;

      if (claveIngresada !== escuela.clave) {
        throw new Error("La clave de la escuela es incorrecta.");
      }
    }

    if (!group || !escuela.grupos[group]) {
      throw new Error("Selecciona un grupo válido.");
    }

    if (!studentName) {
      throw new Error("Escribe el nombre del estudiante.");
    }

    validarArchivo(file);

    const confirmar = window.confirm(
      `Eres integrante de ${group} y quieres enviar este documento a Robótica.\n\n` +
      `Escuela: ${escuela.nombre || schoolCode}\n` +
      `Estudiante: ${studentName}\n` +
      `Archivo: ${file.name}\n` +
      `Tamaño: ${(file.size / (1024 * 1024)).toFixed(2)} MB\n\n` +
      "¿Deseas continuar?"
    );

    if (!confirmar) return;

    const folderId = escuela.grupos[group];

    if (!folderId) {
      throw new Error("El grupo no tiene una carpeta configurada.");
    }

    uploading = true;
    if (submitBtn) submitBtn.disabled = true;
    if (form) form.setAttribute("aria-busy", "true");

    const progress = $("uploadProgress");
    const progressText = $("progressText");

    progress.value = 0;
    progressText.textContent = "Preparando archivo: 0 %";

    const totalParts = Math.ceil(file.size / CHUNK_SIZE);

    setStatus(
      `Iniciando envío de ${totalParts} parte(s). No cierres esta página.`
    );

    for (let i = 0; i < totalParts; i++) {
      const inicio = i * CHUNK_SIZE;
      const fin = Math.min(inicio + CHUNK_SIZE, file.size);
      const fragmento = file.slice(inicio, fin);

      setStatus(`Procesando parte ${i + 1} de ${totalParts}...`);

      const arrayBuffer = await fragmento.arrayBuffer();
      const base64 = convertirABase64(arrayBuffer);

      await enviarParte({
        folderId,
        file,
        studentName,
        group,
        school: schoolCode,
        partNumber: i + 1,
        totalParts,
        base64
      });

      const porcentaje = Math.round(((i + 1) / totalParts) * 100);
      progress.value = porcentaje;
      progressText.textContent =
        `Subido: ${porcentaje} % — parte ${i + 1} de ${totalParts}`;

      setStatus(`Parte ${i + 1} de ${totalParts} guardada.`);
    }

    setStatus(
      `Archivo enviado correctamente. Se guardaron ${totalParts} parte(s) en Google Drive.`,
      "success"
    );

    progress.value = 100;
    progressText.textContent = "Carga completada: 100 %";

    if (form) form.reset();

    actualizarGrupos();
    if (fileInput) fileInput.value = "";

  } catch (error) {
    console.error(error);

    setStatus(
      `No se pudo completar el envío: ${error.message}. Si lo intentas nuevamente, podrían volver a subirse las partes anteriores.`,
      "error"
    );

  } finally {
    uploading = false;
    if (submitBtn) submitBtn.disabled = false;
    if (form) form.removeAttribute("aria-busy");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    prepararInterfaz();

    const form = $("uploadForm");

    if (!form) {
      throw new Error("No se encontró el formulario uploadForm.");
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      await subirArchivo();
    });

    await cargarEscuelas();

  } catch (error) {
    console.error(error);
    setStatus(`Error al iniciar el sistema: ${error.message}`, "error");
  }
});

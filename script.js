
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx5wwASuQDPJi5PcMEj7Ud1pryVcivNBIBnDxH5vRZ0qSzeGfGBdM2z7tGuL9SE9Ha3/exec";

// =========================================================
// DATOS FIJOS DE ESCUELAS
// NO SE CONSULTA NINGÚN ARCHIVO JSON
// =========================================================

const ESCUELAS = {
  EBP: {
    nombre: "EBP",
    clave: "",
    grupos: {
      "4 grado": "1bzGqNBcVxNw-biWlALLJS0a_OM8rKIyo",
      "5 grado": "1VsHanCmNJlVJ7GHUjFZa7aQwd9EJKl1s",
      "6A": "16J1heTDXLJ8DKS_cYwq3GsJv-bi8RzE_",
      "6B": "1mi5zb7wYK0BsPSppKU-OhdqbLZjc1fhN",
      "7A": "1fD88gVed10ZJ6RcopQnRIIrFuYZUL34b",
      "7B": "1J0-e6Y1LQ4QTrSZnQriOAE1O2YAhzYNb",
      "8A": "1WntiALNe3Y2BzyDRLS7ZLiRqztjl10Ol",
      "8B": "1e53gZhJ9TWUewx6_vaTV-PCno7pNGZAQ",
      "9A": "1fZuwly-vGX5lzqNyOYjqQxJemKdIKzbg",
      "9B": "1cN1YunYuwwr8J_IgqPEmiR5yq3-pdvjr"
    }
  }
};

// =========================================================
// CONFIGURACIÓN DE ARCHIVOS
// =========================================================

const CHUNK_SIZE = 20 * 1024 * 1024;
const MAX_SIZE = 500 * 1024 * 1024;

let escuelas = ESCUELAS;
let uploading = false;

const $ = (id) => document.getElementById(id);

// =========================================================
// MENSAJES
// =========================================================

function setStatus(message, type = "info") {
  const status = $("status");

  status.textContent = message;
  status.classList.remove("hidden");
  status.dataset.type = type;
}

function setProgress(value, message) {
  const progress = $("uploadProgress");
  const progressText = $("progressText");

  progress.classList.remove("hidden");
  progressText.classList.remove("hidden");

  progress.value = value;
  progressText.textContent = message;
}

// =========================================================
// ACTUALIZAR BOTÓN DE ENVÍO
// =========================================================

function actualizarBoton() {
  if (uploading) return;

  const escuela = escuelas[$("school").value];
  const grupo = $("group").value;
  const archivo = $("fileInput").files[0];
  const nombre = $("studentName").value.trim();
  const clave = $("schoolKey").value;

  const requiereClave = Boolean(escuela?.clave);

  const claveCorrecta =
    !requiereClave || clave === escuela.clave;

  const grupoValido =
    Boolean(escuela && grupo && escuela.grupos?.[grupo]);

  $("submitBtn").disabled = !(
    escuela &&
    grupoValido &&
    archivo &&
    claveCorrecta
  );

  // El nombre del estudiante es opcional.
  void nombre;
}

// =========================================================
// CARGAR ESCUELAS DESDE LOS DATOS FIJOS
// =========================================================

function cargarEscuelas() {
  escuelas = ESCUELAS;

  const selector = $("school");
  selector.replaceChildren();

  const inicial = document.createElement("option");
  inicial.value = "";
  inicial.textContent = "Selecciona tu escuela…";
  inicial.disabled = true;
  inicial.selected = true;

  selector.appendChild(inicial);

  for (const [codigo, escuela] of Object.entries(escuelas)) {
    const opcion = document.createElement("option");

    opcion.value = codigo;
    opcion.textContent = escuela.nombre || codigo;

    selector.appendChild(opcion);
  }

  actualizarGrupos();

  setStatus(
    "Aplicación iniciada usando datos fijos.",
    "info"
  );
}

// =========================================================
// ACTUALIZAR GRUPOS
// =========================================================

function actualizarGrupos() {
  const codigo = $("school").value;
  const escuela = escuelas[codigo];

  const selectorGrupo = $("group");
  const selectorClave = $("schoolKey");
  const grupoClave = $("schoolKeyGroup");

  // Mostrar la clave solo si la escuela tiene una configurada.
  const requiereClave = Boolean(escuela?.clave);

  grupoClave.classList.toggle("hidden", !requiereClave);
  selectorClave.required = requiereClave;
  selectorClave.value = "";

  // Reiniciar los grupos.
  selectorGrupo.replaceChildren();

  const inicial = document.createElement("option");
  inicial.value = "";
  inicial.textContent = "Selecciona tu grupo…";
  inicial.disabled = true;
  inicial.selected = true;

  selectorGrupo.appendChild(inicial);

  const grupos = escuela?.grupos || {};

  for (const grupo of Object.keys(grupos)) {
    const opcion = document.createElement("option");

    opcion.value = grupo;
    opcion.textContent = grupo;

    selectorGrupo.appendChild(opcion);
  }

  selectorGrupo.disabled = Object.keys(grupos).length === 0;

  if (!codigo) {
    setStatus("Selecciona tu escuela.", "info");

  } else if (Object.keys(grupos).length === 0) {
    setStatus(
      "Esta escuela todavía no tiene grupos configurados.",
      "error"
    );

  } else {
    setStatus(
      requiereClave
        ? "Ingresa la clave de la escuela y selecciona tu grupo."
        : "Selecciona tu grupo y adjunta el archivo.",
      "info"
    );
  }

  actualizarBoton();
}

// =========================================================
// VALIDAR ARCHIVO
// =========================================================

function validarArchivo(archivo) {
  if (!archivo) {
    throw new Error("Selecciona un archivo.");
  }

  if (archivo.size <= 0) {
    throw new Error("El archivo está vacío.");
  }

  if (archivo.size > MAX_SIZE) {
    throw new Error("El archivo supera el límite de 500 MB.");
  }

  const extensiones = [
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "odt", "ods", "odp",
    "jpg", "jpeg", "png", "gif", "webp", "bmp",
    "mp4", "mov", "avi", "mkv", "webm"
  ];

  const nombre = archivo.name.toLowerCase();

  const extension = nombre.includes(".")
    ? nombre.split(".").pop()
    : "";

  if (!extensiones.includes(extension)) {
    throw new Error(
      "El formato del archivo no está permitido."
    );
  }
}

// =========================================================
// CONVERTIR A BASE64
// =========================================================

function convertirABase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binario = "";
  const tamanoBloque = 0x8000;

  for (let i = 0; i < bytes.length; i += tamanoBloque) {
    const bloque = bytes.subarray(i, i + tamanoBloque);
    binario += String.fromCharCode(...bloque);
  }

  return btoa(binario);
}

// =========================================================
// ENVIAR UNA PARTE AL SERVIDOR
// =========================================================

async function enviarParte(datos) {
  const {
    folderId,
    archivo,
    nombreEstudiante,
    grupo,
    escuela,
    numeroParte,
    totalPartes,
    base64
  } = datos;

  const punto = archivo.name.lastIndexOf(".");

  const nombreBase =
    punto > 0
      ? archivo.name.slice(0, punto)
      : archivo.name;

  const extension =
    punto > 0
      ? archivo.name.slice(punto)
      : "";

  const numero = String(numeroParte).padStart(
    String(totalPartes).length,
    "0"
  );

  const nombreParte =
    `${nombreBase}.parte-${numero}-de-${totalPartes}${extension}`;

  const payload = {
    folderId,
    fileName: nombreParte,
    originalFileName: archivo.name,
    mimeType: archivo.type || "application/octet-stream",
    data: base64,
    studentName: nombreEstudiante,
    group: grupo,
    school: escuela,
    partNumber: numeroParte,
    totalParts: totalPartes
  };

  const respuesta = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });

  if (!respuesta.ok) {
    throw new Error(`Error HTTP ${respuesta.status}.`);
  }

  const texto = await respuesta.text();

  let resultado;

  try {
    resultado = JSON.parse(texto);
  } catch {
    throw new Error(
      "El servidor no devolvió JSON. Revisa Code.gs y la implementación."
    );
  }

  if (resultado.success === false || resultado.error) {
    throw new Error(
      resultado.error || "No se pudo guardar la parte."
    );
  }

  return resultado;
}

// =========================================================
// SUBIR ARCHIVO
// =========================================================

async function subirArchivo(event) {
  event.preventDefault();

  if (uploading) return;

  const codigoEscuela = $("school").value;
  const escuela = escuelas[codigoEscuela];
  const grupo = $("group").value;
  const nombreEstudiante = $("studentName").value.trim();
  const archivo = $("fileInput").files[0];
  const clave = $("schoolKey").value;

  try {
    if (!escuela) {
      throw new Error("Selecciona una escuela.");
    }

    if (!grupo || !escuela.grupos?.[grupo]) {
      throw new Error("Selecciona un grupo válido.");
    }

    if (escuela.clave && clave !== escuela.clave) {
      throw new Error("La clave de la escuela es incorrecta.");
    }

    validarArchivo(archivo);

    const folderId = escuela.grupos[grupo];

    const confirmar = window.confirm(
      `Escuela: ${escuela.nombre || codigoEscuela}\n` +
      `Grupo: ${grupo}\n` +
      `Estudiante: ${nombreEstudiante || "No especificado"}\n` +
      `Archivo: ${archivo.name}\n` +
      `Tamaño: ${(archivo.size / (1024 * 1024)).toFixed(2)} MB\n\n` +
      "¿Deseas subirlo?"
    );

    if (!confirmar) return;

    uploading = true;

    $("submitBtn").disabled = true;

    $("submitBtn")
      .querySelector(".btn-text")
      .classList.add("hidden");

    $("submitBtn")
      .querySelector(".btn-loading")
      .classList.remove("hidden");

    const totalPartes = Math.ceil(
      archivo.size / CHUNK_SIZE
    );

    setProgress(0, "Preparando archivo: 0 %");

    setStatus(
      `Iniciando envío de ${totalPartes} parte(s).`
    );

    for (let i = 0; i < totalPartes; i++) {
      const inicio = i * CHUNK_SIZE;

      const fin = Math.min(
        inicio + CHUNK_SIZE,
        archivo.size
      );

      const fragmento = archivo.slice(inicio, fin);

      setStatus(
        `Procesando parte ${i + 1} de ${totalPartes}…`
      );

      const buffer = await fragmento.arrayBuffer();
      const base64 = convertirABase64(buffer);

      await enviarParte({
        folderId,
        archivo,
        nombreEstudiante,
        grupo,
        escuela: codigoEscuela,
        numeroParte: i + 1,
        totalPartes,
        base64
      });

      const porcentaje = Math.round(
        ((i + 1) / totalPartes) * 100
      );

      setProgress(
        porcentaje,
        `Subido: ${porcentaje} % — parte ${i + 1} de ${totalPartes}`
      );
    }

    setStatus(
      `Carga completada. Se guardaron ${totalPartes} parte(s) en Google Drive.`,
      "success"
    );

    $("uploadForm").reset();

    $("fileInfo").textContent = "";
    $("fileInfo").classList.add("hidden");

    actualizarGrupos();

    setProgress(100, "Carga completada: 100 %");

  } catch (error) {
    console.error(error);

    setStatus(
      `No se pudo completar el envío: ${error.message}. Si lo intentas de nuevo, podrían duplicarse las partes que ya se enviaron.`,
      "error"
    );

  } finally {
    uploading = false;

    $("submitBtn")
      .querySelector(".btn-text")
      .classList.remove("hidden");

    $("submitBtn")
      .querySelector(".btn-loading")
      .classList.add("hidden");

    actualizarBoton();
  }
}

// =========================================================
// CONFIGURAR EVENTOS
// =========================================================

function configurarEventos() {
  $("school").addEventListener(
    "change",
    actualizarGrupos
  );

  $("group").addEventListener(
    "change",
    actualizarBoton
  );

  $("schoolKey").addEventListener(
    "input",
    actualizarBoton
  );

  $("studentName").addEventListener(
    "input",
    actualizarBoton
  );

  $("fileInput").addEventListener("change", () => {
    const archivo = $("fileInput").files[0];
    const info = $("fileInfo");

    if (archivo) {
      info.textContent =
        `${archivo.name} (${(archivo.size / (1024 * 1024)).toFixed(2)} MB)`;

      info.classList.remove("hidden");

    } else {
      info.textContent = "";
      info.classList.add("hidden");
    }

    actualizarBoton();
  });

  $("uploadForm").addEventListener(
    "submit",
    subirArchivo
  );
}

// =========================================================
// INICIAR APLICACIÓN
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  configurarEventos();
  cargarEscuelas();
});

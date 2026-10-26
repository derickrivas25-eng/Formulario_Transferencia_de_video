
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx5wwASuQDPJi5PcMEj7Ud1pryVcivNBIBnDxH5vRZ0qSzeGfGBdM2z7tGuL9SE9Ha3/exec";

// 5 MiB por parte. Es múltiplo de 256 KiB, requisito de Drive
// para las partes intermedias de una carga reanudable.
const CHUNK_SIZE = 5 * 1024 * 1024;
const MAX_SIZE = 500 * 1024 * 1024;

const ESCUELAS = {
  EBP: {
    nombre: "EBP",
    requiereClave: false,
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

const formulario = document.getElementById("uploadForm");
const campoEscuela = document.getElementById("school");
const campoGrupo = document.getElementById("group");
const campoClave = document.getElementById("schoolKey");
const grupoClave = document.getElementById("schoolKeyGroup");
const campoEstudiante = document.getElementById("studentName");
const campoArchivo = document.getElementById("fileInput");
const botonEnviar = document.getElementById("submitBtn");
const estado = document.getElementById("status");
const progreso = document.getElementById("uploadProgress");
const textoProgreso = document.getElementById("progressText");
const informacionArchivo = document.getElementById("fileInfo");

let subiendo = false;

function mostrarEstado(mensaje, tipo = "") {
  if (!estado) return;

  estado.textContent = mensaje;
  estado.className = tipo;
}

function actualizarProgreso(porcentaje, mensaje) {
  if (progreso) {
    progreso.value = porcentaje;
    progreso.max = 100;
  }

  if (textoProgreso) {
    textoProgreso.textContent = mensaje;
  }
}

function cambiarEstadoBoton(cargando) {
  if (!botonEnviar) return;

  botonEnviar.disabled = cargando;

  const texto = botonEnviar.querySelector(".btn-text");
  const indicador = botonEnviar.querySelector(".btn-loading");

  if (texto) texto.classList.toggle("hidden", cargando);
  if (indicador) indicador.classList.toggle("hidden", !cargando);
}

function obtenerConfiguracionEscuela() {
  const valor = campoEscuela?.value || "";
  return ESCUELAS[valor] || null;
}

function actualizarGrupos() {
  if (!campoEscuela || !campoGrupo) return;

  const configuracion = obtenerConfiguracionEscuela();
  const grupoAnterior = campoGrupo.value;

  campoGrupo.innerHTML = "";

  if (!configuracion) {
    campoGrupo.add(new Option("Selecciona primero una escuela", ""));
    campoGrupo.disabled = true;
    return;
  }

  campoGrupo.disabled = false;
  campoGrupo.add(new Option("Selecciona tu grado", ""));

  for (const nombreGrupo of Object.keys(configuracion.grupos)) {
    campoGrupo.add(new Option(nombreGrupo, nombreGrupo));
  }

  if (
    grupoAnterior &&
    Object.prototype.hasOwnProperty.call(
      configuracion.grupos,
      grupoAnterior
    )
  ) {
    campoGrupo.value = grupoAnterior;
  }
}

function actualizarCampoClave() {
  if (!grupoClave || !campoClave) return;

  const configuracion = obtenerConfiguracionEscuela();
  const requiereClave = configuracion?.requiereClave === true;

  grupoClave.classList.toggle("hidden", !requiereClave);
  campoClave.required = requiereClave;

  if (!requiereClave) {
    campoClave.value = "";
  }
}

function mostrarInformacionArchivo() {
  if (!campoArchivo || !informacionArchivo) return;

  const archivo = campoArchivo.files?.[0];

  if (!archivo) {
    informacionArchivo.textContent = "";
    return;
  }

  informacionArchivo.textContent =
    `${archivo.name} (${formatearBytes(archivo.size)})`;
}

function formatearBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function leerParteComoBase64(archivo, inicio, fin) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();

    lector.onload = () => {
      const resultado = String(lector.result || "");
      const separador = resultado.indexOf(",");

      if (separador === -1) {
        reject(new Error("No se pudo leer la parte del archivo."));
        return;
      }

      resolve(resultado.slice(separador + 1));
    };

    lector.onerror = () => {
      reject(new Error("Error al leer el archivo seleccionado."));
    };

    lector.readAsDataURL(archivo.slice(inicio, fin));
  });
}

async function enviarParte(datos) {
  const respuesta = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(datos),
    redirect: "follow"
  });

  if (!respuesta.ok) {
    throw new Error(`Error HTTP ${respuesta.status}.`);
  }

  let resultado;

  try {
    resultado = await respuesta.json();
  } catch {
    throw new Error(
      "El servidor no devolvió JSON. Revisa la implementación de Apps Script."
    );
  }

  if (!resultado.success) {
    throw new Error(resultado.message || "Falló la carga del archivo.");
  }

  return resultado;
}

async function subirArchivo() {
  if (subiendo) return;

  const archivo = campoArchivo?.files?.[0];
  const configuracion = obtenerConfiguracionEscuela();
  const escuela = campoEscuela?.value || "";
  const grupo = campoGrupo?.value || "";
  const estudiante = campoEstudiante?.value?.trim() || "";
  const clave = campoClave?.value?.trim() || "";

  if (!formulario?.reportValidity()) return;

  if (!archivo) {
    mostrarEstado("Selecciona un archivo antes de continuar.", "error");
    return;
  }

  if (!configuracion) {
    mostrarEstado("Selecciona una escuela válida.", "error");
    return;
  }

  if (!grupo || !configuracion.grupos[grupo]) {
    mostrarEstado("Selecciona un grado válido.", "error");
    return;
  }

  if (!estudiante) {
    mostrarEstado("Escribe el nombre del estudiante.", "error");
    return;
  }

  if (configuracion.requiereClave && !clave) {
    mostrarEstado("Escribe la clave de la escuela.", "error");
    return;
  }

  if (archivo.size <= 0) {
    mostrarEstado("El archivo está vacío.", "error");
    return;
  }

  if (archivo.size > MAX_SIZE) {
    mostrarEstado("El archivo supera el límite de 500 MB.", "error");
    return;
  }

  const folderId = configuracion.grupos[grupo];
  const totalParts = Math.ceil(archivo.size / CHUNK_SIZE);

  // Identificador único para esta transferencia.
  const uploadId =
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  subiendo = true;
  cambiarEstadoBoton(true);
  mostrarEstado("Preparando la carga...", "info");
  actualizarProgreso(0, "0 %");

  try {
    for (let indice = 0; indice < totalParts; indice++) {
      const inicio = indice * CHUNK_SIZE;
      const fin = Math.min(inicio + CHUNK_SIZE, archivo.size);

      mostrarEstado(
        `Subiendo parte ${indice + 1} de ${totalParts}...`,
        "info"
      );

      const base64 = await leerParteComoBase64(archivo, inicio, fin);

      const datos = {
        uploadId,
        fileSize: archivo.size,
        partNumber: indice + 1,
        totalParts,
        folderId,
        originalFileName: archivo.name,
        mimeType: archivo.type || "application/octet-stream",
        data: base64,
        studentName: estudiante,
        group: grupo,
        school: escuela
      };

      const resultado = await enviarParte(datos);

      const porcentaje = Math.round((fin / archivo.size) * 100);

      actualizarProgreso(
        porcentaje,
        `${porcentaje} % — parte ${indice + 1} de ${totalParts}`
      );

      if (indice < totalParts - 1 && resultado.complete) {
        throw new Error(
          "Drive indicó que el archivo terminó antes de enviar todas las partes."
        );
      }

      if (indice === totalParts - 1 && !resultado.complete) {
        throw new Error(
          "Se enviaron todas las partes, pero Drive no confirmó el archivo final."
        );
      }

      if (resultado.complete) {
        mostrarEstado(
          "Archivo enviado correctamente. Ya está completo en Google Drive.",
          "success"
        );

        if (resultado.webViewLink) {
          const enlace = document.createElement("a");
          enlace.href = resultado.webViewLink;
          enlace.target = "_blank";
          enlace.rel = "noopener noreferrer";
          enlace.textContent = "Abrir archivo en Google Drive";

          estado?.appendChild(document.createTextNode(" "));
          estado?.appendChild(enlace);
        }
      }
    }

    actualizarProgreso(100, "100 % — carga completada");
    formulario.reset();
    actualizarGrupos();
    actualizarCampoClave();
    mostrarInformacionArchivo();

  } catch (error) {
    mostrarEstado(
      `No se pudo completar la carga: ${error.message}`,
      "error"
    );
  } finally {
    subiendo = false;
    cambiarEstadoBoton(false);
  }
}

// Eventos
campoEscuela?.addEventListener("change", () => {
  actualizarGrupos();
  actualizarCampoClave();
});

campoArchivo?.addEventListener("change", mostrarInformacionArchivo);

formulario?.addEventListener("submit", (evento) => {
  evento.preventDefault();
  subirArchivo();
});

// Estado inicial
actualizarGrupos();
actualizarCampoClave();
mostrarInformacionArchivo();
actualizarProgreso(0, "0 %");

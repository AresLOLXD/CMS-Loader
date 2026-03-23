function setStatus(containerId, message, level = "info") {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.textContent = message;
    container.className = "";
    container.classList.add("status", level);
    container.setAttribute("role", "status");
    notify(message, level);
}

function notify(message, level = "info") {
    if (!("Notification" in window)) {
        return;
    }

    const options = {
        body: message,
        icon: level === "error" ? "https://via.placeholder.com/16/ff0000/ffffff?text=!" : "https://via.placeholder.com/16/00aa00/ffffff?text=i"
    };

    if (Notification.permission === "granted") {
        new Notification(`CMS Loader: ${level.toUpperCase()}`, options);
        return;
    }

    if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
            if (permission === "granted") {
                new Notification(`CMS Loader: ${level.toUpperCase()}`, options);
            }
        });
    }
}

function disableButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.setAttribute("disabled", "disabled");
    }
}

function enableButton(buttonId) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.removeAttribute("disabled");
    }
}

function downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

async function uploadCsv({
    formId,
    fileInputId,
    submitId,
    statusId,
    endpoint,
    successRedirect
}) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        setStatus(statusId, "Enviando archivo...", "info");
        disableButton(submitId);

        const fileInput = document.getElementById(fileInputId);
        if (!(fileInput instanceof HTMLInputElement) || !fileInput.files || fileInput.files.length === 0) {
            setStatus(statusId, "Seleccione un archivo CSV antes de enviar.", "error");
            enableButton(submitId);
            return;
        }

        const file = fileInput.files[0];
        if (!file.name.toLowerCase().endsWith(".csv")) {
            setStatus(statusId, "Extensión inválida: seleccione un archivo .csv.", "error");
            enableButton(submitId);
            return;
        }

        const MAX_BYTES = 1024 * 1024 * 20; // 20 MB
        if (file.size > MAX_BYTES) {
            setStatus(statusId, "El archivo excede el límite de 20 MB.", "error");
            enableButton(submitId);
            return;
        }

        const formData = new FormData();
        formData.append("archivo", file);

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                let text = "Error al subir el archivo.";
                try {
                    const body = await response.json();
                    if (body?.message) text = body.message;
                } catch (e) {
                    text = `${response.status} ${response.statusText}`;
                }
                throw new Error(text);
            }

            setStatus(statusId, "Archivo subido correctamente.", "success");
            window.location.replace(successRedirect);
        } catch (error) {
            const message = (error instanceof Error ? error.message : "Error de red") || "Error de subida";
            setStatus(statusId, `Error: ${message}`, "error");
            console.error("uploadCsv error:", error);
            enableButton(submitId);
        }
    });
}

async function submitSelectionForm({
    formId,
    submitId,
    statusId,
    endpoint,
    downloadFilename,
    successRedirect,
    timeoutMs = 20 * 60 * 1000
}) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        setStatus(statusId, "Procesando...", "info");
        disableButton(submitId);

        const data = {};
        const elements = Array.from(form.elements).filter((el) => el instanceof HTMLInputElement || el instanceof HTMLSelectElement);

        for (const element of elements) {
            if (element.name) {
                data[element.name.toLowerCase()] = element.value;
            }
        }

        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            clearTimeout(id);

            if (!response.ok) {
                let text = "Error en la petición.";
                try {
                    const body = await response.json();
                    if (body?.message) text = body.message;
                } catch (e) {
                    text = `${response.status} ${response.statusText}`;
                }
                throw new Error(text);
            }

            const blob = await response.blob();
            if (blob.size > 0) {
                downloadBlob(blob, downloadFilename);
            }

            setStatus(statusId, "Operación completada.", "success");
            if (successRedirect) {
                window.location.replace(successRedirect);
            }
        } catch (error) {
            const message = (error instanceof Error ? error.message : "Error de red") || "Error al procesar";
            setStatus(statusId, `Error: ${message}`, "error");
            console.error("submitSelectionForm error:", error);
            enableButton(submitId);
        }
    });
}

window.initCsvUpload = uploadCsv;
window.initSelectionForm = submitSelectionForm;

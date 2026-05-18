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
            const csrfRes = await fetch('/api/csrf-token')
            if (!csrfRes.ok) throw new Error('No se pudo obtener el token CSRF')
            const { token } = await csrfRes.json()

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "x-csrf-token": token },
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
    progressId,
    endpoint,
    downloadFilename,
    successRedirect,
}) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        setStatus(statusId, "Enviando...", "info");
        disableButton(submitId);

        const data = {};
        const elements = Array.from(form.elements).filter(
            (el) => el instanceof HTMLInputElement || el instanceof HTMLSelectElement
        );
        for (const element of elements) {
            if (element.name) data[element.name.toLowerCase()] = element.value;
        }

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? '';
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-csrf-token": csrfToken,
                },
                body: JSON.stringify(data),
            });

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

            const { jobId } = await response.json();
            setStatus(statusId, "Procesando...", "info");

            const progressEl = progressId ? document.getElementById(progressId) : null;
            const progressCount = document.getElementById("progress-count");
            const progressTotal = document.getElementById("progress-total");
            const progressBar = document.getElementById("progress-bar");
            if (progressEl) progressEl.style.display = "";

            const source = new EventSource(`/jobs/${jobId}/events`);
            let completed = false;

            source.addEventListener("progress", (e) => {
                let parsed;
                try { parsed = JSON.parse(e.data); } catch (ignored) { return; }
                const { processed, total, percent } = parsed;
                setStatus(statusId, `Procesando ${processed} de ${total} registros...`, "info");
                if (progressCount) progressCount.textContent = processed;
                if (progressTotal) progressTotal.textContent = total;
                if (progressBar) { progressBar.value = percent; progressBar.max = 100; }
            });

            source.addEventListener("done", async () => {
                completed = true;
                source.close();
                setStatus(statusId, "Descargando resultados...", "info");
                try {
                    const csvRes = await fetch(`/jobs/${jobId}/result`);
                    if (csvRes.ok) {
                        const blob = await csvRes.blob();
                        if (blob.size > 0) downloadBlob(blob, downloadFilename);
                    }
                } catch (e) {
                    console.error("Error descargando resultado:", e);
                }
                setStatus(statusId, "Operación completada.", "success");
                if (progressEl) progressEl.style.display = "none";
                if (successRedirect) setTimeout(() => window.location.replace(successRedirect), 1000);
            });

            source.addEventListener("job-error", (e) => {
                source.close();
                let message = "Error interno";
                try { message = JSON.parse(e.data).message; } catch (ignored) { /* ignore */ }
                setStatus(statusId, `Error: ${message}`, "error");
                if (progressEl) progressEl.style.display = "none";
                enableButton(submitId);
            });

            source.onerror = () => {
                if (completed) return;
                source.close();
                setStatus(statusId, "Error de conexión con el servidor.", "error");
                if (progressEl) progressEl.style.display = "none";
                enableButton(submitId);
            };

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

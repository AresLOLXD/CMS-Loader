const e = React.createElement;

const fieldsConfig = {
    users: [
        { name: "usuario", label: "Usuario", required: true },
        { name: "nombre", label: "Nombre" },
        { name: "apellidos", label: "Apellidos" },
        { name: "email", label: "Email" },
        { name: "timezone", label: "Zona horaria" },
        { name: "languages", label: "Idiomas" },
        { name: "password", label: "Contraseña" },
    ],
    contest: [
        { name: "usuario", label: "Usuario", required: true },
        { name: "contest", label: "Concurso", required: true },
        { name: "ip", label: "IP" },
        { name: "tiempo_retraso", label: "Tiempo retraso" },
        { name: "tiempo_extra", label: "Tiempo extra" },
        { name: "team", label: "Equipo" },
        { name: "oculto", label: "Oculto" },
        { name: "sin_restricciones", label: "Sin restricciones" },
        { name: "password", label: "Contraseña" },
    ]
};

function notify(message, level = "info") {
    if (!("Notification" in window)) return;
    const options = {
        body: message,
        icon: level === "error" ? "https://via.placeholder.com/12/ff0000/ffffff?text=!" : "https://via.placeholder.com/12/00aa00/ffffff?text=i"
    };
    if (Notification.permission === "granted") {
        new Notification(`CMS Loader (${level})`, options);
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then((permission) => {
            if (permission === "granted") new Notification(`CMS Loader (${level})`, options);
        });
    }
}

function App() {
    const [mode, setMode] = React.useState("users");
    const [file, setFile] = React.useState(null);
    const [columns, setColumns] = React.useState([]);
    const [mapping, setMapping] = React.useState({});
    const [status, setStatus] = React.useState({ text: "Listo", level: "info" });
    const [step, setStep] = React.useState("upload");
    const [loading, setLoading] = React.useState(false);

    const updateStatus = (text, level = "info") => {
        setStatus({ text, level });
        notify(text, level);
    };

    const handleMode = (event) => {
        const newMode = event.target.value;
        setMode(newMode);
        setStep("upload");
        setColumns([]);
        setMapping({});
        setFile(null);
        updateStatus(`Modo: ${newMode === "users" ? "Usuarios" : "Concurso"}`, "info");
    };

    const handleFile = (event) => {
        const selected = event.target.files[0];
        setFile(selected);
    };

    const initMapping = (columnas) => {
        const defaultMap = {};
        fieldsConfig[mode].forEach((field) => {
            defaultMap[field.name] = "";
        });
        setMapping(defaultMap);
    };

    const handleUpload = async () => {
        if (!file) {
            updateStatus("Selecciona un archivo CSV", "error");
            return;
        }
        if (!file.name.toLowerCase().endsWith(".csv")) {
            updateStatus("El archivo debe tener extensión .csv", "error");
            return;
        }
        setLoading(true);
        const formData = new FormData();
        formData.append("archivo", file);

        try {
            const response = await fetch("analyzeCSV", { method: "POST", body: formData });
            if (!response.ok) {
                const body = await response.json().catch(() => null);
                throw new Error(body?.message || `${response.status} ${response.statusText}`);
            }
            const body = await response.json();
            if (!body?.success) {
                throw new Error(body?.message || "Error de servidor");
            }
            const columnas = body.data?.columnas || [];
            if (columnas.length === 0) throw new Error("No hay columnas en el CSV");
            setColumns(columnas);
            initMapping(columnas);
            setStep("mapping");
            updateStatus("Archivo cargado. Selecciona mapeo de columnas.", "success");
        } catch (error) {
            updateStatus(`Falló el upload: ${(error instanceof Error ? error.message : error)}`, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectChange = (fieldName) => (event) => {
        setMapping(prev => ({ ...prev, [fieldName]: event.target.value }));
    };

    const handleSend = async () => {
        const required = fieldsConfig[mode].filter(f => f.required);
        for (const reqField of required) {
            if (!mapping[reqField.name]) {
                updateStatus(`El campo ${reqField.label} es requerido`, "error");
                return;
            }
        }

        const body = { ...mapping };
        setLoading(true);

        try {
            const endpoint = mode === "users" ? "registerUsers" : "addParticipation";
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => null);
                throw new Error(json?.message || `${res.status} ${res.statusText}`);
            }
            const blob = await res.blob();
            if (blob.size > 0) {
                const fileName = mode === "users" ? "Resultados usuarios.csv" : "Errores concurso.csv";
                const blobUrl = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = blobUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(blobUrl);
            }
            updateStatus("Proceso terminado correctamente", "success");
            setStep("done");
        } catch (error) {
            updateStatus(`Error en procesado: ${(error instanceof Error ? error.message : error)}`, "error");
        } finally {
            setLoading(false);
        }
    };

    const uploadSection = e("div", null,
        e("h2", null, "1 - Subir CSV"),
        e("label", null, "Tipo de operación:"),
        e("select", { value: mode, onChange: handleMode, disabled: loading },
            e("option", { value: "users" }, "Usuarios"),
            e("option", { value: "contest" }, "Concurso")
        ),
        e("label", null, "Archivo CSV:"),
        e("input", { type: "file", accept: ".csv", onChange: handleFile, disabled: loading }),
        e("button", { onClick: handleUpload, disabled: loading }, loading ? "Procesando..." : "Subir CSV")
    );

    const options = columns.map(col => e("option", { key: col, value: col }, col));

    const mappingSection = e("div", null,
        e("h2", null, "2 - Mapeo de columnas"),
        e("p", null, "Seleccione qué columna de CSV corresponde a cada campo (requerido para algunos)."),
        ...fieldsConfig[mode].map(field => e("div", { key: field.name },
            e("label", null, `${field.label}${field.required ? "*" : ""}`),
            e("select", {
                value: mapping[field.name] || "",
                onChange: handleSelectChange(field.name),
                disabled: loading
            },
                e("option", { value: "" }, "(No asignado)"),
                options
            )
        )),
        e("button", { onClick: handleSend, disabled: loading }, loading ? "Enviando..." : "Enviar y descargar")
    );

    const doneSection = e("div", null,
        e("h2", null, "Finalizado"),
        e("p", null, "La operación terminó. Puedes iniciar otra carga."),
        e("button", { onClick: () => { setStep("upload"); setColumns([]); setMapping({}); setFile(null); updateStatus("Listo", "info"); } }, "Nueva carga")
    );

    return e("div", null,
        uploadSection,
        step === "mapping" && mappingSection,
        step === "done" && doneSection,
        e("div", { className: `status ${status.level}` }, status.text)
    );
}

const rootEl = document.getElementById("root");
if (rootEl) {
    ReactDOM.createRoot(rootEl).render(e(App));
}

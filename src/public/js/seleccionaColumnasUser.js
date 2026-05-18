document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.initSelectionForm !== "function") {
        console.error("csvUploader module no está cargado");
        return;
    }
    window.initSelectionForm({
        formId: "form",
        submitId: "submit",
        statusId: "status",
        progressId: "progress",
        endpoint: "registerUsers",
        downloadFilename: "Resultados.csv",
        successRedirect: "index.html"
    });
});
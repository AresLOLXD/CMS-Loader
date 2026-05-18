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
        endpoint: "addParticipation",
        downloadFilename: "Errores.csv",
        successRedirect: "index.html"
    });
});
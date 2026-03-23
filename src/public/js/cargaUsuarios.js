document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.initCsvUpload !== "function") {
        console.error("csvUploader module no está cargado");
        return;
    }
    window.initCsvUpload({
        formId: "form",
        fileInputId: "archivo",
        submitId: "submit",
        statusId: "status",
        endpoint: "analyzeCSV",
        successRedirect: "seleccionaColumnasUser"
    });
});
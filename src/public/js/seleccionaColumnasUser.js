// eslint-disable-next-line @typescript-eslint/no-unused-vars
function seleccionaColumnasUser(event) {
    event.preventDefault()
    document.getElementById("submit").disabled = "disabled"
    realizaPeticiones()
    return false;
}

function descargaArchivo(blob) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    // the filename you want
    a.download = 'Resultados.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
}


async function realizaPeticiones() {
    try {
        const formData = new FormData(document.getElementById("form"))


        const blob = await fetch("/CSV/registerUsers", {
            body: formData,
            method: "POST",
        }).then(res => res.blob())

        descargaArchivo(blob)
        window.location.replace("index.html")

    }
    catch (err) {
        alert("Hubo un error subiendo los archivos")
        console.error("Errro: ", err)

        document.getElementById("submit").disabled = ""
    }
}
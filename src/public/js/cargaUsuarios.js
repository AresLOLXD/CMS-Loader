// eslint-disable-next-line @typescript-eslint/no-unused-vars
function cargaUsuarios(event) {
    event.preventDefault()
    document.getElementById("submit").disabled = "disabled"
    realizaPeticiones()
    return false;
}


async function realizaPeticiones() {
    try {
        const formData = new FormData()
        formData.append("archivo", document.getElementById("archivo").files[0])

        const { columnas, registros } = await fetch("/CSV/analizeCSV", {
            body: formData,
            method: "POST",
        }).then(res => res.json())
        fetch("/CSV/saveUserCSV", {
            body: JSON.stringify({
                columnas,
                registros
            }),
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            }
        })
        window.location.replace("seleccionaColumnasUser")

    }
    catch (err) {
        alert("Hubo un error subiendo los archivos")
        console.error("Errro: ", err)
        document.getElementById("submit").disabled = ""
    }
}
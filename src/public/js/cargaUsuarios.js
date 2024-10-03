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
        }).then(res => {
            if (!res.ok) {
                const responseError = {
                    type: 'Error',
                    message: res.message || 'Something went wrong',
                    data: res.data || '',
                    code: res.code || '',
                };

                const error = new Error();
                error.info = responseError;
                throw error
            }
            return res.json()
        })
        await fetch("/CSV/saveUserCSV", {
            body: JSON.stringify({
                columnas,
                registros
            }),
            method: "POST",
            headers: {
                'Content-Type': 'application/json'
            }
        }).then(res => {
            if (!res.ok) {
                const responseError = {
                    type: 'Error',
                    message: res.message || 'Something went wrong',
                    data: res.data || '',
                    code: res.code || '',
                };

                const error = new Error();
                error.info = responseError;
                throw error
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
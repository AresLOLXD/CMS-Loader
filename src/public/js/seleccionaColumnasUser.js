// eslint-disable-next-line @typescript-eslint/no-unused-vars
function seleccionaColumnasUser(event) {
    event.preventDefault()
    document.getElementById('submit').setAttribute("disabled", "disabled");
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
        const body = {
            email: document.getElementById("Email").value,
            timezone: document.getElementById("Timezone").value,
            languages: document.getElementById("Languages").value,
            password: document.getElementById("Password").value,
            nombre: document.getElementById("Nombre").value,
            apellidos: document.getElementById("Apellidos").value,
            usuario: document.getElementById("Usuario").value,
        }
        const blob = await fetch("/registerUsers", {
            body: JSON.stringify(body),
            method: "POST",
            redirect: "error",
            headers: {
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(100000)
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
            return res.blob()

        })
        if (blob.size > 0)
            descargaArchivo(blob)
        window.location.replace("index.html")

    }
    catch (err) {
        alert("Hubo un error subiendo los archivos")
        console.error("Errro: ", err)

        document.getElementById('submit').removeAttribute("disabled");
    }
}
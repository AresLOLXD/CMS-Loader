// eslint-disable-next-line @typescript-eslint/no-unused-vars
function seleccionaColumnasConcurso(event) {
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
        const body = {
            usuario: document.getElementById("Usuario").value,
            contest: document.getElementById("Concurso").value,
            ip: document.getElementById("IP").value,
            tiempo_retraso: document.getElementById("Tiempo_Retraso").value,
            tiempo_extra: document.getElementById("Tiempo_Extra").value,
            team: document.getElementById("Team").value,
            oculto: document.getElementById("Oculto").value,
            sin_restricciones: document.getElementById("Sin_Restricciones").value,
            password: document.getElementById("Password").value,

        }
        const blob = await fetch("/addParticipation", {
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

        descargaArchivo(blob)
        window.location.replace("index.html")

    }
    catch (err) {
        alert("Hubo un error subiendo los archivos")
        console.error("Errro: ", err)

        document.getElementById("submit").disabled = ""
    }
}
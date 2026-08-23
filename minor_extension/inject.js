console.log("Inject script loaded ✅");

window.addEventListener("message", (event) => {
    if (event.data.type === "GET_CODE") {
        let code = null;

        try {
            if (window.monaco) {
                const models = window.monaco.editor.getModels();
                if (models.length) {
                    code = models[0].getValue();
                }
            }
        } catch (e) {
            console.error("Monaco access error:", e);
        }

        window.postMessage({ type: "CODE_RESULT", code }, "*");
    }
});
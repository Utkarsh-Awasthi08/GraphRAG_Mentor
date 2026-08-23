console.log("Extension Loaded ✅");

// 🔥 inject script into page (important)
const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
script.onload = function () {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// 🧠 get code from injected script
function getCode() {
    return new Promise((resolve) => {
        window.postMessage({ type: "GET_CODE" }, "*");

        function handler(event) {
            if (event.data.type === "CODE_RESULT") {
                window.removeEventListener("message", handler);
                resolve(event.data.code);
            }
        }

        window.addEventListener("message", handler);
    });
}

// console.log("Extension Loaded ✅");
// function getCode() {

//     try {
//         console.log("Attempting to access Monaco Editor...");
//         if (!window.monaco)
//         {
//             console.log("Monaco Editor not found on the page.");
//          return null;
//         }
//         console.log("Monaco Editor found:", window.monaco);
//         const models = window.monaco.editor.getModels();
//         if (!models.length) return null;
//         console.log(models[0].getValue());
//         return models[0].getValue();
//     } catch (e) {
//         console.error("Error accessing Monaco Editor:", e);
//     }
// }

// getUserId removed - using JWT auth from extension storage instead

let problemName = "";

function getProblemNameFromURL() {
    const url = window.location.pathname;

    // Extract the slug between /problems/ and next /
    const match = url.match(/\/problems\/([^\/]+)\//);

    if (match) {
        let slug = match[1]; // e.g. "recover-binary-search-tree"

        // Convert to formatted name
        problemName = slug
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

    } else {
        problemName = "Unknown";
    }

    console.log("Problem Name:", problemName);
}

getProblemNameFromURL();

// 1. Initialize the empty array
let linkTexts = [];

function extractLinkTexts() {
    // 2. Get the HTMLCollection using your specific classes
    const elements = document.getElementsByClassName("no-underline hover:text-current relative inline-flex items-center justify-center text-caption px-2 py-1 gap-1 rounded-full bg-fill-secondary text-text-secondary");

    // 3. Convert the HTMLCollection to an Array and loop through it
    // We use Array.from() to allow us to use .forEach()
    Array.from(elements).forEach(element => {
        // 4. Push the text content into our array
        // .innerText or .textContent works; .innerText ignores hidden text
        linkTexts.push(element.innerText);
    });

    console.log("Extracted Texts:", linkTexts);
}
extractLinkTexts();

function getResultContainer() {
    return document.querySelector('[data-layout-path="/ts0/t1"]');
}

function getError() {
    const container = getResultContainer();
    if (!container) return null;

    const status = getResultStatus();
    if (status && status.toLowerCase().includes("accepted")) {
        return "No error";
    }
    if (status && status.toLowerCase().includes("time limit exceeded")) {
        return "Not optimized approach";
    }

    const alignMiddle = container.querySelector('.align-middle');
    let errorText = null;
    if (alignMiddle) {
        const div = alignMiddle.querySelector('div');
        errorText = div ? div.textContent.trim() : null;
    }

    if (status && status.toLowerCase().includes("wrong answer")) {
        return errorText ? `Wrong answer for this input: ${errorText}` : "Wrong answer for unknown input";
    }

    console.log("Error Element:", errorText);
    return errorText;
}

function getResultStatus() {
    const container = getResultContainer();
    if (!container) return null;
    const errorEl = container.querySelector('span[class*="text-red"]');
    const success = container.querySelector('[data-e2e-locator="submission-result"]');
    const wrong_ans = document.querySelector("h3.flex.items-center.text-xl");

    if (errorEl)
        return errorEl.innerText.trim();
    else if (success)
        return success.innerText.trim();
    else if (wrong_ans)
        return wrong_ans.innerText.trim();
    
    return null;
}
function sendToBackend(data) {
    chrome.runtime.sendMessage(
        {
            type: "SAVE_SUBMISSION",
            payload: data
        },
        (response) => {
            console.log("Response:", response);
        }
    );
}
async function captureData() {
    const code = await getCode();
    const error = getError();
    const status = getResultStatus();
    const url = window.location.href;
    console.log("Attempting to capture data...");
    console.log("URL:", url);
    console.log("Error:", error);
    console.log("Status:", status);
    console.log("Code:", code);
    if (!code) return;

    const data = {
        problem: problemName,
        url,
        code,
        error,
        status,
        mistake: "",
        topics: linkTexts,
        timestamp: new Date().toISOString()
    };
    console.log("Captured Data:", data);
    submissionTriggered = false;
    sendToBackend(data);

    // Save locally (temporary)
    chrome.storage.local.set({ lastSubmission: data });
}

let submissionTriggered = false;

document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-e2e-locator="console-submit-button"]');

    if (btn) {
        submissionTriggered = true;
        console.log("Submission triggered");
    }
});

const observer = new MutationObserver(() => {
    if (!submissionTriggered) return;

    const resultPanel = document.querySelector('[data-layout-path="/ts0/tb1"]');

    if (resultPanel) {
        console.log("Result panel detected...");

        submissionTriggered = false; // stop further triggers immediately

        setTimeout(() => {
            captureData();
            console.log("Data captured ✅");
        }, 9000); // shorter + safer
    }
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SAVE_SUBMISSION") {
      fetch("http://localhost:3000/submission", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(message.payload)
      })
        .then(res => res.json())
        .then(data => sendResponse({ success: true, data }))
        .catch(err =>
          sendResponse({ success: false, error: err.message })
        );
  
      return true; // keeps sendResponse async
    }
  });
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "SAVE_SUBMISSION") {
      chrome.storage.local.get(["authToken"], (res) => {
        if (!res.authToken) {
          console.error("No auth token found! User must log in to the extension.");
          sendResponse({ success: false, error: "Unauthorized: Please log in to extension." });
          return;
        }

        fetch("http://localhost:3000/submission", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${res.authToken}`
          },
          body: JSON.stringify(message.payload)
        })
          .then(res => res.json())
          .then(data => {
            if (data.error) throw new Error(data.error);
            sendResponse({ success: true, data });
          })
          .catch(err =>
            sendResponse({ success: false, error: err.message })
          );
      });
  
      return true; // keeps sendResponse async
    }
  });
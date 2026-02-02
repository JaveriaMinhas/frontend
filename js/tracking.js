// const BASE_URL = "http://127.0.0.1:8000";

// ------------------------------
//  LEAD_ID
// ------------------------------
let LEAD_ID = localStorage.getItem("lead_id");
if (!LEAD_ID) {
    LEAD_ID = crypto.randomUUID();
    localStorage.setItem("lead_id", LEAD_ID);
}
function getPKTTimestamp() {
    const now = new Date();
    const pktOffset = 5 * 60;
    const localOffset = now.getTimezoneOffset();
    return new Date(now.getTime() + (pktOffset + localOffset) * 60000).toISOString();
}
let startTime = Date.now();
function getTimeSpent() {
    return Number(((Date.now() - startTime) / 1000 / 60).toFixed(3));
}

// ------------------------------
//  Track event function
// ------------------------------
async function trackEvent({
    event_type = "generic_event",
    page_name = document.body.dataset.page || window.location.pathname,
    label = "",
    property_id = null,
    message = null
}, isUnload = false) {
    try {
        const eventData = {
            lead_id: LEAD_ID,
            event_type,
            page_name,
            label,
            property_id: property_id || null,
            timestamp: getPKTTimestamp(),
            time_spent: getTimeSpent(),
            message
        };

        if (isUnload && navigator.sendBeacon) {
            navigator.sendBeacon(
                `${BASE_URL}/events`,
                new Blob([JSON.stringify(eventData)], { type: "application/json" })
            );
        } else {
            await fetch(`${BASE_URL}/events`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(eventData),
                keepalive: isUnload
            });
        }

        console.log("Tracked event:", eventData);
    } catch (err) {
        console.error("Tracking failed:", err);
    }
}

// ------------------------------
//  PAGE VIEW
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const propertyId = urlParams.get("property_id") || null;

    let pageName = document.body.dataset.page || window.location.pathname;

    if (!propertyId) {
        if (pageName.includes("index.html") || pageName === "/") pageName = "homepage";
        else if (pageName.includes("listings.html")) pageName = "list_page";
        else if (pageName.includes("contact.html")) pageName = "contact_page";
        else if (pageName.includes("villa_list.html")) pageName = "villa_list_page";
        else if (pageName.includes("plot_list.html")) pageName = "plot_list_page";
        else pageName = pageName.replace(".html", "");
    }

    const message = propertyId ? `User opened property ${propertyId}` : `User loaded ${pageName}`;

    trackEvent({
        event_type: "page_view",
        page_name: pageName,
        label: "Page Loaded",
        property_id: propertyId,
        message
    });
});

// ------------------------------
//  PROPERTY CLICK
// ------------------------------
document.querySelectorAll("[data-property-id]").forEach(el => {
    el.addEventListener("click", (e) => {
        const property_id = el.dataset.propertyId;
        const property_type = el.dataset.propertyType;

        const eventData = {
            lead_id: LEAD_ID,
            event_type: "property_click",
            page_name: document.body.dataset.page || window.location.pathname,
            label: `Clicked ${property_type}`,
            property_id,
            timestamp: getPKTTimestamp(),
            time_spent: getTimeSpent(),
            message: `User clicked property ${property_id}`
        };

        if (navigator.sendBeacon) {
            navigator.sendBeacon(`${BASE_URL}/events`, new Blob([JSON.stringify(eventData)], { type: "application/json" }));
        } else {
            fetch(`${BASE_URL}/events`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(eventData),
                keepalive: true
            });
        }

        // Navigate after small delay
        setTimeout(() => window.location.href = el.href, 200);
        e.preventDefault();
    });
});

// ------------------------------
//  NAVIGATION & BUTTON CLICK
// ------------------------------
document.querySelectorAll("[data-track]").forEach(el => {
    el.addEventListener("click", () => {
        trackEvent({
            event_type: "nav_click",
            page_name: document.body.dataset.page || window.location.pathname,
            label: `Clicked ${el.dataset.track}`,
            message: `User clicked ${el.dataset.track}`
        });
    });
});

// ------------------------------
//  CHAT OPEN
// ------------------------------
document.querySelectorAll("[data-chat-property]").forEach(el => {
    el.addEventListener("click", () => {
        trackEvent({
            event_type: "chat_open",
            page_name: document.body.dataset.page || window.location.pathname,
            property_id: el.dataset.chatProperty,
            label: "Chat opened",
            message: `User opened chat for property ${el.dataset.chatProperty}`
        });
    });
});

// ------------------------------
//  CHAT MESSAGE SENT
// ------------------------------
document.querySelectorAll("[data-chat-input]").forEach(inputEl => {
    inputEl.addEventListener("keypress", async (e) => {
        if (e.key === "Enter" && inputEl.value.trim()) {
            const userId = await initUser();
            const propertyId = inputEl.dataset.chatProperty;

            // send chat to backend
            await fetch(`${BASE_URL}/chat/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    property_id: propertyId,
                    sender_id: Number(userId),
                    // receiver_id: 222,
                    message: inputEl.value.trim()
                })
            });

            // update user last_user_message_at
            await fetch(`${BASE_URL}/users/${userId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ last_user_message_at: new Date().toISOString() })
            });

            inputEl.value = "";
        }
    });
});

// ------------------------------
//  PAGE EXIT
// ------------------------------
window.addEventListener("beforeunload", () => {
    trackEvent({
        event_type: "page_exit",
        label: "Page Exit",
        message: "User left the page"
    }, true);
});

// ------------------------------
//  LAST SEEN AT
// ------------------------------
async function updateLastSeen(extraData = {}) {
    const userId = localStorage.getItem("user_id");
    if (!userId) return;

    const data = {
        last_seen_at: new Date().toISOString(),
        ...extraData
    };

    try {
        const res = await fetch(`${BASE_URL}/users/${userId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        console.log("User updated dynamically:", data);
    } catch (err) {
        console.error("Failed to update user:", err);
    }
}
// ------------------------------
//  USER ACTIVITY TRACKING
// ------------------------------
function trackUserActivity() {
    const events = ["mousemove", "click", "scroll", "keydown"];
    let timeout;

    const handler = () => {
        clearTimeout(timeout);
        updateLastSeen();
        timeout = setTimeout(updateLastSeen, 2 * 60 * 1000);
    };

    events.forEach(evt => document.addEventListener(evt, handler));
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) updateLastSeen();
    });
}

// initialize user activity tracking
trackUserActivity();

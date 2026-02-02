const BASE_URL = "https://api.appolyse.com";


class NotificationManager {
    constructor() {
        this.userId = null;
        this.notifications = [];
        this.dismissedNotifications = new Set(JSON.parse(localStorage.getItem("dismissed_notifications") || "[]"));
        this.checkInterval = null;
    }

    init() {
        // Wait for navbar to load
        setTimeout(() => {
            this.userId = localStorage.getItem("user_id");
            console.log("NotificationManager initialized with USER_ID:", this.userId);
            
            if (this.userId) {
                // Check current settings
                console.log("Current last_notification_check:", localStorage.getItem("last_notification_check"));
                console.log("Current property interactions:", localStorage.getItem("user_property_interactions"));
                
                // Initialize last check timestamp to 1 hour ago (so it picks up recent followups)
                if (!localStorage.getItem("last_notification_check")) {
                    const oneHourAgo = new Date(Date.now() - 60*60*1000).toISOString();
                    localStorage.setItem("last_notification_check", oneHourAgo);
                    console.log("Set initial last_notification_check to 1 hour ago:", oneHourAgo);
                }
                this.startChecking();
            } else {
                console.log("No user_id found, notification system not started");
            }
        }, 500);
    }

    startChecking() {
        // Check immediately
        this.checkForNewFollowups();
        
        // Then check every 3 seconds for instant notifications
        this.checkInterval = setInterval(() => {
            this.checkForNewFollowups();
        }, 3000);
    }

    async checkForNewFollowups() {
        if (!this.userId) return;

        try {
            // Get last checked timestamp
            const lastChecked = localStorage.getItem("last_notification_check") || new Date(Date.now() - 24*60*60*1000).toISOString();
            console.log("Checking for followups since:", lastChecked);
            
            // Get list of properties user has interacted with
            const propertyIds = JSON.parse(localStorage.getItem("user_property_interactions") || "[]");
            console.log("Properties to check:", propertyIds);
            
            const newFollowups = [];
            
            // Check each property for new AI followups
            for (const propInfo of propertyIds) {
                try {
                    const res = await fetch(`${BASE_URL}/chat/conversation/${this.userId}/222/${propInfo.propertyId}`);
                    if (!res.ok) continue;

                    const dailyChats = await res.json();
                    console.log(`Messages for ${propInfo.propertyId}:`, dailyChats);
                    
                    // Look through all messages for new AI followups
                    dailyChats.forEach(day => {
                        if (!day.messages) return;
                        
                        day.messages.forEach(msg => {
                            const msgTime = new Date(msg.time);
                            const lastCheckTime = new Date(lastChecked);
                            const isFromAgent = String(msg.sender_id) === "222";
                            const isNew = msgTime > lastCheckTime;
                            
                            console.log(`Message check:`, {
                                message: msg.message.substring(0, 50),
                                type: msg.type,
                                sender_id: msg.sender_id,
                                time: msg.time,
                                isFromAgent,
                                isNew,
                                msgTime: msgTime.toISOString(),
                                lastCheckTime: lastCheckTime.toISOString()
                            });
                            
                            // Detect AI followups: either has type="ai_followup" OR is from agent and is new
                            const isAIFollowup = msg.type === "ai_followup" || 
                                                (isFromAgent && isNew && msg.sender_id != this.userId);
                            
                            if (isAIFollowup) {
                                const notifId = `${propInfo.propertyId}_${msg.time}`;
                                
                                // Skip if already dismissed
                                if (this.dismissedNotifications.has(notifId)) {
                                    console.log("Skipping dismissed notification:", notifId);
                                    return;
                                }
                                
                                console.log("Found AI followup!", msg);
                                const notification = {
                                    id: notifId,
                                    message: msg.message,
                                    propertyId: propInfo.propertyId,
                                    propertyType: propInfo.propertyType || 'villa',
                                    time: msg.time,
                                    sender_id: msg.sender_id,
                                    receiver_id: msg.receiver_id
                                };
                                console.log("Created notification:", notification);
                                newFollowups.push(notification);
                            }
                        });
                    });
                } catch (err) {
                    console.error(`Error checking property ${propInfo.propertyId}:`, err);
                }
            }

            console.log("Total new followups found:", newFollowups.length);

            if (newFollowups.length > 0) {
                this.addNotifications(newFollowups);
                this.updateBadge();
            }

        } catch (error) {
            console.error("Error checking followups:", error);
        }
    }

    addNotifications(followups) {
        console.log("Adding notifications:", followups);
        
        if (followups.length === 0) {
            console.log("No new followups to add");
            return;
        }
        
        followups.forEach(followup => {
            console.log("Processing followup:", followup);
            
            // Double-check not dismissed (defensive)
            if (this.dismissedNotifications.has(followup.id)) {
                console.log("Skipping dismissed notification in addNotifications:", followup.id);
                return;
            }
            
            // Remove any existing notification for this property (keep only latest)
            this.notifications = this.notifications.filter(n => n.propertyId !== followup.propertyId);
            
            // Add the new notification
            console.log("Adding new notification with propertyId:", followup.propertyId);
            this.notifications.push({
                id: followup.id,
                message: followup.message,
                propertyId: followup.propertyId,
                propertyType: followup.propertyType || 'villa',
                time: followup.time,
                read: false
            });
        });
        
        console.log("Current notifications array:", this.notifications);
        this.renderNotifications();
    }

    updateBadge() {
        const badge = document.getElementById("notificationBadge");
        const unreadCount = this.notifications.length;
        
        if (badge) {
            if (unreadCount > 0) {
                badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
                badge.classList.remove("hidden");
            } else {
                badge.classList.add("hidden");
            }
        }
    }

    renderNotifications() {
        const notificationList = document.getElementById("notificationList");
        if (!notificationList) return;

        // Filter out any dismissed notifications before rendering
        this.notifications = this.notifications.filter(n => !this.dismissedNotifications.has(n.id));

        if (this.notifications.length === 0) {
            notificationList.innerHTML = `
                <div class="p-4 text-center text-gray-500">
                    <p class="mb-2">No new followups</p>
                </div>
            `;
            return;
        }

        // Add "Mark All as Read" button
        const headerActions = `
            <div class="p-3 border-b border-gray-100 flex justify-between items-center">
                <span class="text-xs text-gray-500">${this.notifications.length} unread</span>
                <button onclick="notificationManager.markAllRead()" class="text-xs text-green-600 hover:text-green-700 font-medium">
                    Clear all
                </button>
            </div>
        `;

        notificationList.innerHTML = headerActions + this.notifications
            .sort((a, b) => new Date(b.time) - new Date(a.time))
            .map(notif => {
                const timeStr = new Date(notif.time).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                // Escape quotes in strings to prevent breaking onclick
                const safeId = String(notif.id).replace(/'/g, "\\'");
                const safePropId = String(notif.propertyId).replace(/'/g, "\\'");
                const safePropType = String(notif.propertyType).replace(/'/g, "\\'");

                return `
                    <div class="p-4 hover:bg-gray-50 cursor-pointer transition-colors" 
                         onclick="notificationManager.openNotification('${safeId}', '${safePropId}', '${safePropType}')">
                        <div class="flex items-start">
                            <div class="flex-shrink-0">
                                <span class="inline-block w-2 h-2 rounded-full bg-green-500 mt-2"></span>
                            </div>
                            <div class="ml-3 flex-1">
                                <p class="text-sm font-medium text-gray-900">New Followup - ${notif.propertyId}</p>
                                <p class="text-sm text-gray-600 mt-1">${notif.message.substring(0, 80)}${notif.message.length > 80 ? '...' : ''}</p>
                                <p class="text-xs text-gray-400 mt-1">${timeStr}</p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
    }

    forceCheck() {
        this.checkForNewFollowups();
    }

    markAllRead() {
        // Add all current notifications to dismissed list
        this.notifications.forEach(n => {
            this.dismissedNotifications.add(n.id);
        });
        localStorage.setItem("dismissed_notifications", JSON.stringify([...this.dismissedNotifications]));
        
        // Clear all notifications
        this.notifications = [];
        this.updateBadge();
        this.renderNotifications();
    }

    openNotification(notificationId, propertyId, propertyType) {
        console.log("Opening notification:", { notificationId, propertyId, propertyType });
        
        // Add to dismissed list
        this.dismissedNotifications.add(notificationId);
        localStorage.setItem("dismissed_notifications", JSON.stringify([...this.dismissedNotifications]));
        
        // Remove the notification completely
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        this.updateBadge();
        this.renderNotifications();

        // Validate propertyId
        if (!propertyId || propertyId === 'undefined') {
            console.error("Invalid property ID:", propertyId);
            alert("Error: Invalid property ID. Please try again.");
            return;
        }

        // Navigate to property page with chat open
        let pageUrl = '';
        switch(propertyType) {
            case 'villa':
                pageUrl = `villa_detail.html?property_id=${propertyId}&openChat=true`;
                break;
            case 'apartment':
                pageUrl = `apartment_information.html?property_id=${propertyId}&openChat=true`;
                break;
            case 'plot':
                pageUrl = `plot_information.html?property_id=${propertyId}&openChat=true`;
                break;
            default:
                pageUrl = `villa_detail.html?property_id=${propertyId}&openChat=true`;
        }

        console.log("Navigating to:", pageUrl);
        window.location.href = pageUrl;
    }

    clearAll() {
        this.notifications = [];
        this.updateBadge();
        this.renderNotifications();
        localStorage.setItem("last_notification_check", new Date().toISOString());
    }
}

// Initialize notification manager
const notificationManager = new NotificationManager();

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => notificationManager.init());
} else {
    notificationManager.init();
}

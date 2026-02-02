# Backend Requirements for Notification System

## Overview
The frontend notification system is now implemented and requires the following backend API endpoints to function properly.

## Required API Endpoints

### 1. Get User Followups
**Endpoint:** `GET /chat/followups/{user_id}`

**Query Parameters:**
- `since` (optional): ISO timestamp string to get only followups after this time

**Response Format:**
```json
[
  {
    "id": "unique_message_id",
    "sender_id": 222,
    "receiver_id": 7,
    "message": "Hello! Are you still interested in the villa?",
    "time": "2026-01-21T12:30:45.123456",
    "type": "ai_followup",
    "property_id": "dha_villa_1",
    "property_type": "villa"
  }
]
```

**Required Fields:**
- `id`: Unique identifier for the message
- `message`: The followup message text
- `time`: ISO timestamp when the followup was sent
- `type`: Must be "ai_followup" for automated followups
- `property_id`: The property this followup is about
- `property_type`: One of "villa", "apartment", or "plot"

### 2. Update Conversation Endpoint
**Endpoint:** `GET /chat/conversation/{user_id}/{agent_id}/{property_id}`

**Current Issue:** The endpoint is returning messages WITHOUT the `type` field.

**Fix Required:** Include the `type` field in the response for each message:

```json
{
  "property_id": "dha_villa_1",
  "conversation_date": "2026-01-21",
  "messages": [
    {
      "sender_id": 7,
      "receiver_id": 222,
      "message": "hello",
      "time": "2026-01-21T11:39:26.426875",
      "type": "user"  // ADD THIS FIELD
    },
    {
      "sender_id": 222,
      "receiver_id": 7,
      "message": "How can I help you?",
      "time": "2026-01-21T11:40:00.123456",
      "type": "ai_followup"  // ADD THIS FIELD
    }
  ]
}
```

**Message Types:**
- `"user"` - Regular user messages
- `"agent"` - Manual agent responses
- `"ai_followup"` - Automated AI-generated followups

## Frontend Behavior

### Notification System
- Polls `/chat/followups/{user_id}` every 10 seconds
- Shows notification badge with count of unread followups
- Displays followups in dropdown menu
- Clicking a notification navigates to the property page with chat auto-opened

### Chat Display
- Purple background + italic styling for messages with `type: "ai_followup"`
- Green background for user messages
- Gray background for agent messages
- Timestamps displayed below each message

## Implementation Notes

1. The `type` field is CRITICAL for the frontend to distinguish between different message types
2. The notification system tracks last check time using localStorage
3. Backend should support filtering by timestamp to avoid sending duplicate notifications
4. All timestamps should be in ISO format with timezone info

## Testing

To test the notification system:
1. Generate an AI followup in the backend
2. Ensure it has `type: "ai_followup"` in the database
3. The frontend will detect it within 10 seconds
4. Notification badge should appear
5. Click the notification to navigate to the property page

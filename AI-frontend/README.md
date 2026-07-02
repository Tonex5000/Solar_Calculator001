# AI Frontend - Solar Assistant Chat

React frontend for the AI-powered Nigerian Solar Assistant.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run the development server:
```bash
npm run dev
```

The frontend will start at `http://localhost:5173`

## Configuration

The frontend connects to the backend at `http://localhost:8000`. Make sure the backend is running before using the chat.

To change the backend URL, update the `API_URL` constant in `src/components/Chat.jsx`.

## Features

- Simple chat interface
- Message history display
- User and assistant message styling
- Loading state while waiting for AI response
- Error handling

## Components

- `Chat.jsx` - Main chat component with message history and input

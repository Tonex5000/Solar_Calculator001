import { useState } from 'react'

// API URL - change this to match your backend URL
const API_URL = 'http://localhost:8000'

function Chat() {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toLocaleTimeString()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: userMessage.content })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to get response')
      }

      const data = await response.json()

      const assistantMessage = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      console.error('Chat error:', err)
      setError(err.message || 'Failed to connect to server. Make sure the backend is running.')
      
      const errorMessage = {
        role: 'assistant',
        content: `Error: ${err.message || 'Failed to connect to server'}`,
        isError: true,
        timestamp: new Date().toLocaleTimeString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>☀️ AI Solar Assistant</h1>
        <p>Ask me anything about solar energy in Nigeria</p>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="welcome-message">
            <div className="icon">☀️</div>
            <h2>Welcome to Solar Assistant</h2>
            <p>I'm here to help with all your solar energy questions in Nigeria.</p>
            <p style={{ marginTop: '16px', fontSize: '0.85rem' }}>
              Try asking about:
            </p>
            <div style={{ marginTop: '12px', fontSize: '0.9rem', textAlign: 'left', maxWidth: '300px', margin: '12px auto 0' }}>
              <p>• "What inverter do I need for a 3 bedroom flat?"</p>
              <p>• "How much does a solar system cost?"</p>
              <p>• "Why is my inverter making noise?"</p>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`message ${msg.role} ${msg.isError ? 'error' : ''}`}
          >
            <div>{msg.content}</div>
            <div className="message-time">{msg.timestamp}</div>
          </div>
        ))}

        {isLoading && (
          <div className="loading-indicator">
            <div className="loading-dots">
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
            </div>
            <span>Thinking...</span>
          </div>
        )}
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          placeholder="Ask about solar energy..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
        <button 
          className="send-button"
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
        >
          Send
        </button>
      </div>
    </div>
  )
}

export default Chat

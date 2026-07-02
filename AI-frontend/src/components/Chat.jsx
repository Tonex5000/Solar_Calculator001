import { useState } from 'react'

// API URL - Backend server
const API_URL = 'https://solar-calculator001-3-5qgs.onrender.com'

function Chat() {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showDebug, setShowDebug] = useState(false)

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

      // Log structured data to console for debugging
      console.log('Intent Detection:', {
        intent: data.intent,
        intent_label: data.intent_label,
        extracted_data: data.data
      })

      const assistantMessage = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString(),
        intent: data.intent,
        intent_label: data.intent_label,
        extractedData: data.data
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

  const formatExtractedData = (data) => {
    if (!data) return null
    
    const items = []
    
    if (data.budget) {
      items.push(`💰 Budget: ₦${data.budget.toLocaleString()}`)
    }
    
    if (data.appliances && data.appliances.length > 0) {
      items.push(`🔌 Appliances: ${data.appliances.join(', ')}`)
    }
    
    if (data.problem) {
      items.push(`⚠️ Problem: ${data.problem}`)
    }
    
    if (data.comparison) {
      items.push(`📊 Comparing: ${data.comparison}`)
    }
    
    return items.length > 0 ? items.join(' | ') : null
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>☀️ AI Solar Assistant</h1>
        <p>Ask me anything about solar energy in Nigeria</p>
        <button 
          className="debug-toggle"
          onClick={() => setShowDebug(!showDebug)}
          title="Toggle debug panel"
        >
          {showDebug ? '🐛 Hide Debug' : '🐛 Show Debug'}
        </button>
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
              <p>• "I have ₦500k, what can I power?"</p>
              <p>• "My battery is draining fast"</p>
            </div>
          </div>
        )}

        {messages.map((msg, index) => (
          <div key={index}>
            <div className={`message ${msg.role} ${msg.isError ? 'error' : ''}`}>
              <div>{msg.content}</div>
              <div className="message-time">{msg.timestamp}</div>
            </div>
            
            {/* Show intent detection for assistant messages */}
            {msg.role === 'assistant' && !msg.isError && showDebug && msg.intent && (
              <div className="debug-panel">
                <div className="debug-item">
                  <span className="debug-label">🎯 Intent:</span>
                  <span className="debug-value">{msg.intent_label}</span>
                </div>
                {formatExtractedData(msg.extractedData) && (
                  <div className="debug-item">
                    <span className="debug-label">📋 Extracted Data:</span>
                    <span className="debug-value">{formatExtractedData(msg.extractedData)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="loading-indicator">
            <div className="loading-dots">
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
              <div className="loading-dot"></div>
            </div>
            <span>Analyzing intent...</span>
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

export default class ChatInterface {
  constructor(container) {
    this.container = container;
    this.chatHistory = [];
    this.initializeUI();
    this.isProcessing = false; // Add flag to prevent multiple sends
  }

  initializeUI() {
    // Create main chat container
    const chatContainer = document.createElement("div");
    chatContainer.className = "chat-interface";

    // Create chat history container
    const historyContainer = document.createElement("div");
    historyContainer.className = "chat-history";

    // Create input area
    const inputContainer = document.createElement("div");
    inputContainer.className = "chat-input-container";

    const input = document.createElement("textarea");
    input.className = "chat-input";
    input.placeholder = "Type your message...";
    input.rows = 1;

    const sendButton = document.createElement("button");
    sendButton.className = "chat-send-button";
    sendButton.innerHTML = "→";

    inputContainer.appendChild(input);
    inputContainer.appendChild(sendButton);

    chatContainer.appendChild(historyContainer);
    chatContainer.appendChild(inputContainer);

    // Add styles
    const styles = document.createElement("style");
    styles.textContent = `
      .chat-interface {
        position: absolute;
        top: 40px;
        left: 20px;
        width: 320px;
        height: 500px;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        border-radius: 15px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 1000;
        animation: chatInterfaceAppear 0.5s ease-out;
      }

      @keyframes chatInterfaceAppear {
        from {
          opacity: 0;
          transform: translateX(-20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .chat-interface::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 15px;
        padding: 2px;
        background: linear-gradient(
          45deg,
          rgba(66, 173, 245, 0.5),
          rgba(245, 66, 167, 0.5),
          rgba(187, 0, 255, 0.5)
        );
        -webkit-mask: 
          linear-gradient(#fff 0 0) content-box, 
          linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
        animation: borderGlow 4s linear infinite;
      }

      @keyframes borderGlow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      .chat-history {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        scroll-behavior: smooth;
        will-change: transform;
      }

      .chat-history::-webkit-scrollbar {
        width: 5px;
      }

      .chat-history::-webkit-scrollbar-track {
        background: rgba(26, 23, 23, 0.1);
      }

      .chat-history::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.02);
        border-radius: 10px;
      }

      .chat-input-container {
        padding: 10px;
        display: flex;
        gap: 8px;
        align-items: center;
        background: rgba(30, 30, 40, 0.5);
        min-height: 50px;
        max-height: 100px;
      }

      .chat-input {
        flex: 1;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 10px;
        padding: 8px 12px;
        color: white;
        font-family: 'Arial', sans-serif;
        font-size: 14px;
        resize: none;
        height: 34px;
        min-height: 34px;
        max-height: 80px;
        transition: all 0.2s ease;
        line-height: 1.2;
        will-change: height;
      }

      .chat-input:focus {
        outline: none;
        background: rgba(255, 255, 255, 0.15);
      }

      .chat-input::placeholder {
        color: rgba(255, 255, 255, 0.5);
      }

      .chat-send-button {
        background: linear-gradient(45deg, #42adf5, #f542a7);
        border: none;
        border-radius: 50%;
        min-width: 34px;
        min-height: 34px;
        width: 34px;
        height: 34px;
        color: white;
        font-size: 18px;
        cursor: pointer;
        transition: transform 0.2s ease, opacity 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        will-change: transform;
      }

      .chat-send-button:hover {
        transform: scale(1.05);
      }

      .chat-send-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
      }

      .chat-message {
        padding: 8px 12px;
        border-radius: 10px;
        max-width: 80%;
        animation: messageAppear 0.3s ease-out;
        will-change: transform, opacity;
      }

      @keyframes messageAppear {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .user-message {
        background: rgba(66, 173, 245, 0.2);
        align-self: flex-end;
      }

      .ai-message {
        background: rgba(245, 66, 167, 0.2);
        align-self: flex-start;
      }

      .message-text {
        color: white;
        font-size: 14px;
        line-height: 1.4;
      }
    `;

    document.head.appendChild(styles);
    this.container.appendChild(chatContainer);

    // Optimized event listeners
    let resizeTimeout;
    input.addEventListener("input", () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const newHeight = Math.min(input.scrollHeight, 80);
        input.style.height = "34px";
        input.style.height = `${newHeight}px`;
      }, 10);
    });

    const handleSend = () => {
      if (!this.isProcessing && input.value.trim()) {
        this.sendMessage(input.value);
      }
    };

    sendButton.addEventListener("click", handleSend);
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Store references
    this.historyContainer = historyContainer;
    this.input = input;
    this.sendButton = sendButton;
  }

  sendMessage(text) {
    if (!text.trim() || this.isProcessing) return;

    this.isProcessing = true;
    this.sendButton.disabled = true;

    this.addMessage(text, "user");
    this.input.value = "";
    this.input.style.height = "34px";

    // Simulate AI response (replace with actual AI integration)
    setTimeout(() => {
      this.addMessage("This is a simulated AI response.", "ai");
      this.isProcessing = false;
      this.sendButton.disabled = false;
    }, 1000);
  }

  addMessage(text, type) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `chat-message ${type}-message`;

    const messageText = document.createElement("div");
    messageText.className = "message-text";
    messageText.textContent = text;

    messageDiv.appendChild(messageText);

    // Use requestAnimationFrame for smooth scrolling
    requestAnimationFrame(() => {
      this.historyContainer.appendChild(messageDiv);
      this.historyContainer.scrollTop = this.historyContainer.scrollHeight;
    });

    this.chatHistory.push({ text, type });
  }
}

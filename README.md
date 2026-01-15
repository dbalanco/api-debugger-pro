# API Debugger Pro ⚡️

<div align="center">

![Version](https://img.shields.io/badge/version-2.6.0-blue.svg?style=for-the-badge)
![React](https://img.shields.io/badge/React-19.1.0-61DAFB.svg?style=for-the-badge&logo=react&logoColor=black)
![Gemini](https://img.shields.io/badge/AI-Gemini_2.5-8E75B2.svg?style=for-the-badge&logo=googlebard&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)

**The advanced, AI-powered network inspector that lives inside your React application.**

[Features](#-features) • [Installation](#-installation) • [AI Integration](#-ai-intelligence-engine) • [Roadmap](#-roadmap)

</div>

---

## 🚀 The Vibe
**API Debugger Pro** isn't just a network logger; it's your co-pilot for "vibe coding." When you are iterating fast, you don't want to switch context to the browser DevTools network tab constantly. You want a beautiful, integrated overlay that tells you exactly what's happening, why it failed, and—thanks to **Google Gemini 2.5**—how to fix it.

It is built for the future of development: **Visual**, **Intelligent**, and **Privacy-Focused**.

## ✨ Features

### 🧠 AI-Powered Insights
Stop guessing why an API call failed or is performing poorly.
- **Instant Analysis:** One-click analysis of request/response cycles using Gemini 2.5 Flash.
- **Actionable Advice:** Receives security warnings, performance tips, and best practice recommendations in Markdown format.
- **Context Aware:** Understands standard REST patterns and common error codes.

### 🛡 Security & Privacy First
Built for the security-conscious developer.
- **Auto-Masking:** Automatically detects and masks PII (tokens, passwords, SSNs) in headers and bodies before they hit the logs.
- **Security Scanner:** Real-time heuristic scanning for insecure transport (HTTP), missing security headers (HSTS, CSP), and sensitive data in URLs.
- **Local-Only Storage:** Uses `IndexedDB` to persist session data entirely within the user's browser.

### ⚡️ Developer Experience (DX)
- **Zero-Config Widget:** A floating, collapsible widget that lives on top of your app.
- **Time Travel:** **Replay** any captured request with a single click to test idempotency or debug race conditions.
- **Import/Export:** Full support for **HAR (HTTP Archive)** and JSON import/export. Share logs with your team effortlessly.
- **Custom Simulations:** Built-in tool to mock API responses and test error states (404, 500, 418) without backend changes.

---

## 📦 Installation

*(Future Npm Package Implementation)*

```bash
npx api-debugger-pro@latest init
# or
npm install api-debugger-pro
```

### Quick Setup

Wrap your application root with the Provider and drop the Widget component where you need it.

```tsx
import { ApiDebuggerProvider, ApiDebuggerWidget } from 'api-debugger-pro';

const App = () => (
  <ApiDebuggerProvider initialMaxRequests={500}>
    <YourAppContent />
    {/* The overlay widget */}
    <ApiDebuggerWidget /> 
  </ApiDebuggerProvider>
);
```

---

## 🤖 AI Intelligence Engine

API Debugger Pro leverages `@google/genai` to turn raw JSON into wisdom.

### Configuration
To enable AI features, ensure your environment has the API key accessible. The tool automatically looks for `process.env.API_KEY` or `import.meta.env.VITE_API_KEY`.

**Required Permissions:**
No extra permissions needed. The AI client runs client-side, sending sanitized prompt data to Gemini.

**Model Used:**
- `gemini-2.5-flash-preview` for high-speed, low-latency analysis.

---

## 🛠 Architecture & Tech Stack

- **Framework:** React 19 (utilizing new hooks and Suspense patterns).
- **Styling:** Tailwind CSS for a modern, responsive UI.
- **Persistence:** `IndexedDB` (via raw IDB API) for handling large request bodies without blocking the main thread.
- **Icons:** Lucide React.
- **Bundler:** Vite.

### Key Components

| Component | Description |
| :--- | :--- |
| `ApiDebuggerProvider` | The context brain. Handles request interception, storage, and state management. |
| `ApiDebuggerWidget` | The floating UI. Fully accessible, keyboard navigable (Cmd+K support). |
| `SecurityScanner` | A utility that runs heuristic checks against every incoming request object. |
| `MaskingEngine` | Regex-based sanitization layer to prevent sensitive data leaks in logs. |

---

## 🔮 Roadmap

We are building the ultimate debugging experience. Here is what is coming next:

- [ ] **GraphQL Support:** First-class support for GQL queries and mutations (parsing operation names).
- [ ] **WebSocket Inspector:** Real-time frame monitoring for WS/WSS connections.
- [ ] **Network Throttling:** Simulate slow 3G/4G connections directly from the widget.
- [ ] **Headless Mode:** Run the debugger in CI/CD pipelines to capture failing request logs.
- [ ] **Team Sync:** Optional encrypted peer-to-peer sharing of debugging sessions.

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Cmd/Ctrl` + `.` | Toggle Widget Expand/Collapse |
| `Cmd/Ctrl` + `K` | Focus Search Bar |
| `Cmd/Ctrl` + `Shift` + `K` | Clear All Requests |
| `Cmd/Ctrl` + `1-4` | Switch Tabs (Requests, Security, Analytics, Settings) |

---

## 🤝 Contributing

We love "vibe coding." If you have an idea that makes the developer experience smoother, prettier, or smarter:

1.  Fork the repo.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes.
4.  Open a Pull Request.

---

<div align="center">

**Built with ❤️ for developers who care about details.**

</div>

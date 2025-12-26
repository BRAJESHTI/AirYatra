import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/performance.css";  // Performance optimizations
import App from "@/App";
import { Toaster } from 'sonner';

// Performance: Preconnect to API
const preconnect = document.createElement('link');
preconnect.rel = 'preconnect';
preconnect.href = process.env.REACT_APP_BACKEND_URL;
document.head.appendChild(preconnect);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
    <Toaster position="top-right" theme="dark" richColors />
  </React.StrictMode>,
);

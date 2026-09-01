import React from "react";
import ReactDOM from "react-dom/client";
import "./auth/amplifyConfig.js"; 
import App from "./App.jsx";
import "./App.css"; // <-- ensure this exists

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
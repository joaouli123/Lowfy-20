import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initSecurity, initAntiDebug } from "./lib/security";

initSecurity();

createRoot(document.getElementById("root")!).render(<App />);

setTimeout(() => {
  initAntiDebug();
}, 2000);

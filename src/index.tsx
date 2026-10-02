/* @refresh reload */
import "virtual:uno.css";
import "./index.css";
import { render } from "solid-js/web";
import App from "./App";
import { PrivacyPage } from "./ui/PrivacyPage";

// ページは2つだけなのでルーターは使わない（Workers 側は SPA として全パスで index.html を返す）
render(
  () => (location.pathname === "/privacy" ? <PrivacyPage /> : <App />),
  document.getElementById("root")!,
);

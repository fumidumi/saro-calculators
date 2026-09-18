import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider, createRouter, createHashHistory } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";

import { routeTree } from "./routeTree.gen";
import "./styles.css";

// Настольная версия открывается из локального файла/сервера — используем hash-навигацию,
// чтобы маршруты работали без серверного роутинга.
const router = createRouter({
  routeTree,
  history: createHashHistory(),
  context: { queryClient: new QueryClient() },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");

if (rootElement) {
  // Окна сторонних компонентов могут аварийно оставить страницу недоступной
  // для мыши и клавиатуры. Настольная версия всегда начинает с чистого UI.
  document.body.style.removeProperty("pointer-events");
  document.body.removeAttribute("inert");
  rootElement.removeAttribute("inert");
  rootElement.removeAttribute("aria-hidden");

  createRoot(rootElement).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
}

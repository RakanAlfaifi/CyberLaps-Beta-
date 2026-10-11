import { RouterProvider } from "react-router-dom";
import { AudioProvider } from "@/app/providers/AudioProvider";
import { router } from "@/app/router";
import { useDocumentLanguage } from "@/i18n";

export function App() {
  useDocumentLanguage();
  return (
    <AudioProvider>
      <RouterProvider router={router} future={{ v7_startTransition: true }} />
    </AudioProvider>
  );
}

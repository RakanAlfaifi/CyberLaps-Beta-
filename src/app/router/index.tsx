import { Navigate, createBrowserRouter } from "react-router-dom";
import { LandingPage } from "@/pages/LandingPage";
import { LabRoute } from "./LabRoute";

/**
 * Route map:
 *   "/"              -> Landing page & dashboard (profile, settings, Domain Hub)
 *   "/lab"           -> resume the current Recon level
 *   "/lab/:levelId"  -> a specific Recon level (all playable levels are open)
 */
export const router = createBrowserRouter(
  [
    { path: "/", element: <LandingPage /> },
    { path: "/lab", element: <LabRoute /> },
    { path: "/lab/:levelId", element: <LabRoute /> },
    { path: "*", element: <Navigate to="/" replace /> },
  ],
  {
    future: {
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_relativeSplatPath: true,
      v7_skipActionErrorRevalidation: true,
    },
  },
);

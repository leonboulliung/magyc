"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors={false}
      closeButton
      toastOptions={{
        duration: 4800,
        classNames: {
          toast: "magyc-toast",
          title: "magyc-toast-title",
          description: "magyc-toast-description",
          actionButton: "magyc-toast-action",
          cancelButton: "magyc-toast-cancel",
          closeButton: "magyc-toast-close",
        },
      }}
    />
  );
}

// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConfirmSubmitButton } from "@/components/forms/confirm-submit-button";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const originalConsoleError = console.error;

function getButtonByLabel(label: string): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll("button"));
  return (buttons.find((button) => button.textContent?.includes(label)) as HTMLButtonElement | undefined) ?? null;
}

describe("ConfirmSubmitButton", () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((message: unknown, ...args: unknown[]) => {
      if (typeof message === "string" && message.includes("not wrapped in act")) {
        return;
      }

      originalConsoleError(message, ...args);
    });
  });

  afterEach(() => {
    root?.unmount();
    container?.remove();
    consoleErrorSpy?.mockRestore();
    root = null;
    container = null;
  });

  it("submits the target form when confirm is clicked", async () => {
    const form = document.createElement("form");
    form.id = "delete-Tour-form";
    document.body.appendChild(form);

    const requestSubmitSpy = vi.spyOn(form, "requestSubmit").mockImplementation(() => undefined);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    if (!root) {
      throw new Error("React root not initialized");
    }
    const mountedRoot = root;

    await act(async () => {
      mountedRoot.render(
        <ConfirmSubmitButton
          formId="delete-Tour-form"
          triggerLabel="Delete Tour"
          title="Delete Tour?"
          description="This action cannot be undone."
          confirmLabel="Delete now"
        />,
      );
    });

    const triggerButton = getButtonByLabel("Delete Tour");
    expect(triggerButton).toBeTruthy();

    await act(async () => {
      triggerButton?.click();
    });

    const confirmButton = getButtonByLabel("Delete now");
    expect(confirmButton).toBeTruthy();

    await act(async () => {
      confirmButton?.click();
    });

    expect(requestSubmitSpy).toHaveBeenCalledTimes(1);

    requestSubmitSpy.mockRestore();
    form.remove();
  });
});

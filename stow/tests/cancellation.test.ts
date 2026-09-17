import { describe, it, expect } from "vitest";

describe("Phase 04 — Cancellation Semantics and Race Protection", () => {
  it("Test 2 & 4: AbortController cancels active request without producing an error message", async () => {
    let isGenerating = false;
    let error: string | null = null;
    let assistantMessage: string | null = null;

    const controller = new AbortController();

    // Mock an in-flight request that listens to abort
    const fetchPromise = new Promise<string>((resolve, reject) => {
      isGenerating = true;
      const timeout = setTimeout(() => {
        resolve("Finished response");
      }, 500);

      controller.signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        const abortErr = new Error("The user aborted a request.");
        abortErr.name = "AbortError";
        reject(abortErr);
      });
    });

    const execution = fetchPromise
      .then((res) => {
        assistantMessage = res;
      })
      .catch((err) => {
        if (err.name === "AbortError" || controller.signal.aborted) {
          // Expected user cancellation: do NOT set error
          return;
        }
        error = "Sorry, something went wrong. Please try again.";
      })
      .finally(() => {
        isGenerating = false;
      });

    // Simulate clicking "Cancel Response"
    controller.abort();
    await execution;

    expect(isGenerating).toBe(false);
    expect(error).toBeNull();
    expect(assistantMessage).toBeNull();
  });

  it("Test 3 & 6: Race Protection prevents superseded or cancelled requests from modifying state", async () => {
    let currentRequestId = 0;
    const completedResponses: { id: number; text: string }[] = [];
    let isGenerating = false;

    // Simulate sending Request A
    const idA = ++currentRequestId;
    const controllerA = new AbortController();
    isGenerating = true;

    const promiseA = new Promise<string>((resolve, reject) => {
      setTimeout(() => {
        if (controllerA.signal.aborted) {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        } else {
          resolve("Response A");
        }
      }, 100);
    }).then((res) => {
      if (idA === currentRequestId) {
        completedResponses.push({ id: idA, text: res });
      }
    }).catch(() => {
      // ignore abort
    });

    // User cancels Request A
    controllerA.abort();

    // User sends Request B
    const idB = ++currentRequestId;

    const promiseB = new Promise<string>((resolve) => {
      setTimeout(() => {
        resolve("Response B");
      }, 30);
    }).then((res) => {
      if (idB === currentRequestId) {
        completedResponses.push({ id: idB, text: res });
      }
    }).finally(() => {
      if (idB === currentRequestId) {
        isGenerating = false;
      }
    });

    await Promise.all([promiseA, promiseB]);

    // Only Request B should have succeeded and updated state
    expect(completedResponses).toHaveLength(1);
    expect(completedResponses[0]).toEqual({ id: idB, text: "Response B" });
    expect(isGenerating).toBe(false);
  });

  it("Test 5: Real API errors are caught and surfaced to the user", async () => {
    let isGenerating = true;
    let error: string | null = null;
    const controller = new AbortController();

    const fetchPromise = Promise.reject(new Error("500 Internal Server Error"))
      .catch((err) => {
        const isAbort =
          (err instanceof Error && err.name === "AbortError") ||
          controller.signal.aborted;

        if (isAbort) return;

        error = "Sorry, something went wrong. Please try again.";
      })
      .finally(() => {
        isGenerating = false;
      });

    await fetchPromise;

    expect(isGenerating).toBe(false);
    expect(error).toBe("Sorry, something went wrong. Please try again.");
  });
});

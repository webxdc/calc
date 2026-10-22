import { type Page } from "@playwright/test";

// Mirrors the payload in App.tsx: a diff unless `kind` says otherwise.
export type Payload = {
  data: string;
  sender: string;
  kind?: "snapshot";
};

// A file handed to the host by `sendToChat`, with the blob read back as
// base64 so it survives the trip out of the page.
export type SentFile = { name: string; base64: string };

declare global {
  interface Window {
    // The file the stubbed file picker returns on the next importFiles call.
    __nextImportFile?: { name: string; base64: string };
  }
}

/**
 * Stages the file the next `importFiles` call returns.
 *
 * The file is fetched from the dev server inside the page: this tsconfig has
 * no node types, so the test process cannot read it from disk.
 */
export async function stageImportFile(page: Page, url: string, name: string) {
  await page.evaluate(
    async ({ url, name }) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not fetch ${url}: ${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      let binary = "";
      for (const byte of bytes) {
        binary += String.fromCharCode(byte);
      }
      window.__nextImportFile = { name, base64: btoa(binary) };
    },
    { url, name },
  );
}

// The host owns this log independently of the app's localStorage and lifetime.
// Replay synchronously to exercise updates arriving before React/WASM is ready.
//
// `echo` mirrors outgoing updates straight back to the listener, the way the
// real host does. Turning it off simulates the app being closed before its own
// updates come back, which leaves a saved workbook next to an unadvanced cursor.
//
// `sendUpdateMaxSize` and `sendUpdateInterval` are what the real host
// advertises; a small max size makes an ordinary edit too large to send.
export async function installHost(
  page: Page,
  history: Payload[],
  {
    echo = true,
    sentFiles,
    sendUpdateMaxSize = 0,
    sendUpdateInterval = 0,
  }: {
    echo?: boolean;
    sentFiles?: SentFile[];
    sendUpdateMaxSize?: number;
    sendUpdateInterval?: number;
  } = {},
) {
  await page.exposeFunction("recordUpdate", (payload: Payload) => {
    history.push(payload);
  });
  await page.exposeFunction("recordSentFile", (file: SentFile) => {
    sentFiles?.push(file);
  });
  await page.route("**/webxdc.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `
      const history = ${JSON.stringify(history)};
      const echo = ${echo};
      let listener;
      let serial = history.length;
      window.webxdc = {
        selfAddr: 'same-account@example.org',
        selfName: 'Same account',
        // 0 stands for the app's "host reports nothing" case.
        sendUpdateMaxSize: ${sendUpdateMaxSize},
        sendUpdateInterval: ${sendUpdateInterval},
        setUpdateListener(cb, start = 0) {
          if (listener) throw new Error('Listener registered twice');
          listener = cb;
          history.forEach((payload, index) => {
            if (index + 1 > start) cb({ payload, serial: index + 1, max_serial: serial });
          });
          return Promise.resolve();
        },
        sendUpdate({ payload }) {
          window.recordUpdate(payload);
          serial += 1;
          if (echo) {
            listener({ payload, serial, max_serial: serial });
          }
        },
        // The real host shows a file picker. Tests stage the file the picker
        // is to return in window.__nextImportFile; an empty slot stands for
        // the user cancelling out of the picker.
        //
        // Cancelling never settles, which is what Delta Chat does: it builds
        // the picker from an <input type=file> and only listens for its
        // \`change\` event, which a cancelled dialog never fires.
        async importFiles() {
          const staged = window.__nextImportFile;
          if (!staged) {
            return new Promise(() => {});
          }
          window.__nextImportFile = undefined;
          const bin = atob(staged.base64);
          const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
          return [new File([bytes], staged.name)];
        },
        // The real host shows a chat picker and resolves once the user has
        // chosen. Reading the blob here also asserts that what the app passed
        // is still readable, rather than a view on freed WASM memory.
        async sendToChat({ file }) {
          if (file) {
            const buffer = await file.blob.arrayBuffer();
            let binary = '';
            for (const byte of new Uint8Array(buffer)) {
              binary += String.fromCharCode(byte);
            }
            await window.recordSentFile({ name: file.name, base64: btoa(binary) });
          }
        },
      };
    `,
    }),
  );
}

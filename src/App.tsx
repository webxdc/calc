import "./App.css";
import styled from "@emotion/styled";
import { useEffect, useRef, useState } from "react";
import {
  createNewModel,
  loadSelectedModelFromStorage,
  saveSelectedModelInStorage,
} from "./components/storage";

// From IronCalc
import { IronCalc, IronCalcIcon, Model, init } from "@ironcalc/workbook";
import "@ironcalc/workbook/style.css";

import { Webxdc } from "@webxdc/types";
import { encode as base64Encode, decode as base64Decode } from "base64-arraybuffer";

// Concurrent WASM initialization can replace the instance backing existing
// models. Share the pending initialization across StrictMode effect runs.
let initialization: ReturnType<typeof init> | undefined;

declare global {
  interface Window {
    webxdc: Webxdc<{ data: string, sender: string }>;
    // We expose the current model so Playwright tests can access the IronCalc model.
    // This is only set in dev mode.
    __model?: Model;
  }
}

function App() {
  const [model, setModel] = useState<Model | null>(null);

  // Bumped whenever we apply a remote diff to the model. We pass this to
  // IronCalc so it repaints the canvas without resetting the workbook
  // interaction state (the in-progress cell edit, selection, focus).
  const [externalRevision, setExternalRevision] = useState(0);

  // We keep a reference to the model. This way we can register callbacks that
  // accesss this without having to re-register them when the model is replaced.
  const modelRef = useRef<Model | null>(null);

  // We keep the model in sync with the model ref. We also make sure it's
  // exposed on the window for tests in dev mode.
  useEffect(() => {
    modelRef.current = model;
    if (import.meta.env.DEV && model) {
      window.__model = model;
    }
  }, [model]);


  // a unique identifier for this client.
  const uuid = get_or_create_uuid();

  useEffect(() => {
    // because React StrictMode runs useEffect twice in dev, we want to make
    // sure we don't actually 
    let cancelled = false;
    async function start() {
      initialization ??= init();
      await initialization;
      // the first time around in StrictMode, we have been cancelled so
      // we don't attempt to set the model.
      if (cancelled) {
        return;
      }
      // the second time in StrictMode (or the first time outside of StrictMode) is the real one
      // so we load the model from storage or create a new one and set it in state.
      const storedModel = loadSelectedModelFromStorage();
      if (!storedModel) {
        // A replay cursor is only valid together with the workbook it describes.
        localStorage.removeItem("last_serial");
        // With no cached local edits, historical updates from this device
        // must also be replayed instead of being mistaken for live echoes.
        localStorage.removeItem("uuid");
      }
      const newModel = storedModel ?? createNewModel();
      setModel(newModel);
    }
    // we start the async here, not waiting for its completion
    start();
    return () => {
      // if this gets torn down (which happens in StrictMode), we don't try to set the model twice.
      cancelled = true;
    };
  }, []);


  // Outgoing: flush local edits to peers on an interval.
  useEffect(() => {
    const int = setInterval(() => {
      const model = modelRef.current;
      if (!model) {
        return
      }
      let diff = model.flushSendQueue();
      // length 1 encoded is the empty vec, which is a no-op.
      if (diff.length <= 1) {
        return
      }
      saveSelectedModelInStorage(model);
      // send the webxdc update message
      const diffBase64 = base64Encode(diff.buffer as ArrayBuffer);
      const payload = { data: diffBase64, sender: uuid };
      if (import.meta.env.DEV) {
        console.log("[calc:diff]", payload);
      }
      window.webxdc.sendUpdate({ payload }, "");
    }, 1000)
    return () => {
      clearInterval(int)
    }
  }, [uuid])

  // React by default uses StrictMode in dev to flush out bugs. This invokes
  // useEffect twice. But webxdc expects a single update listener registration. 
  // This ref is to make sure it's registered only once.
  const listenerRegistered = useRef(false);

  // Incoming: apply remote diffs to the model.
  useEffect(() => {
    // Register only after WASM and the workbook are ready.
    // Delta Chat retains updates and replays them when we register.
    if (!model || listenerRegistered.current) {
      return
    }
    listenerRegistered.current = true
    window.webxdc.setUpdateListener((update) => {
      const model = modelRef.current;
      const payload = update.payload;
      if (!model) {
        console.warn("Received external diffs but model is not initialized yet");
        return
      }
      if (payload.sender === uuid) {
        localStorage.setItem("last_serial", update.serial.toString());
        return
      }
      // Decode base64 back to binary and convert to Uint8Array
      const diffBuffer = base64Decode(payload.data);
      const diff = new Uint8Array(diffBuffer);
      model.applyExternalDiffs(diff);
      saveSelectedModelInStorage(model);
      // Never acknowledge an update before its changes have been saved.
      localStorage.setItem("last_serial", update.serial.toString());
      // The model is mutated in place; bump the revision so IronCalc repaints
      // the canvas without disturbing an in-progress edit.
      setExternalRevision((revision) => revision + 1);
    }, get_last_serial())
  }, [model, uuid])


  if (!model) {
    return (
      <Loading>
        <IronCalcIcon style={{ width: 24, height: 24, marginBottom: 16 }} />
        <div>Loading IronCalc</div>
      </Loading>
    );
  }


  // We could use context for model, but the problem is that it should initialized to null.
  // Passing the property down makes sure it is always defined.

  return (
    <Wrapper>
      <IronCalc model={model} externalRevision={externalRevision} />
    </Wrapper>
  );
}

const Wrapper = styled("div")`
  margin: 0px;
  padding: 0px;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: absolute;
`;

const Loading = styled("div")`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-family: "Inter";
  font-size: 14px;
`;

export default App;

function get_last_serial(): number {
  const last_serial = localStorage.getItem("last_serial");
  if (last_serial === null) {
    localStorage.setItem("last_serial", "0");
    return 0;
  }
  return parseInt(last_serial, 10) || 0;
}

function get_or_create_uuid(): string {
  const uuid = localStorage.getItem("uuid");
  if (uuid) {
    return uuid
  }
  const newUuid = crypto.randomUUID();
  localStorage.setItem("uuid", newUuid);
  return newUuid
}


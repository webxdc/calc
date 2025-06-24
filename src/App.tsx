import "./App.css";
import styled from "@emotion/styled";
import { useEffect, useState } from "react";
import {
  get_documentation_model,
  get_model,
} from "./components/rpc";
import {
  loadModelFromStorageOrCreate,
  saveSelectedModelInStorage,
} from "./components/storage";

// From IronCalc
import { IronCalc, IronCalcIcon, Model, init } from "@ironcalc/workbook";

import { Webxdc } from "@webxdc/types";
import { encode as base64Encode, decode as base64Decode } from "base64-arraybuffer";

declare global {
  interface Window {
    webxdc: Webxdc<{ data: string, sender: string }>;
  }
}

function App() {
  const [model, setModel] = useState<Model | null>(null);
  const uuid = get_or_create_uuid();
  useEffect(() => {
    async function start() {
      await init();
      const queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      const modelHash = urlParams.get("model");
      const exampleFilename = urlParams.get("example");
      // If there is a model name ?model=modelHash we try to load it
      // if there is not, or the loading failed we load an empty model
      if (modelHash) {
        // Get a remote model
        try {
          const model_bytes = await get_model(modelHash);
          const importedModel = Model.from_bytes(model_bytes);
          localStorage.removeItem("selected");
          setModel(importedModel);
        } catch (e) {
          alert("Model not found, or failed to load");
        }
      } else if (exampleFilename) {
        try {
          const model_bytes = await get_documentation_model(exampleFilename);
          const importedModel = Model.from_bytes(model_bytes);
          localStorage.removeItem("selected");
          setModel(importedModel);
        } catch (e) {
          alert("Example file not found, or failed to load");
        }
      } else {
        // try to load from local storage
        const newModel = loadModelFromStorageOrCreate();
        setModel(newModel);
      }
    }
    start();
  }, []);

  let max_serial = get_last_serial()

  useEffect(() => {
    if (!model) {
      return
    }
    const int = setInterval(() => {

      let diff = model.flushSendQueue();
      if (diff.length <= 1) {
        return
      }
      saveSelectedModelInStorage(model);
      const diffBase64 = base64Encode(diff);
      console.log("Sending external diffs with length", diffBase64.length);
      window.webxdc.sendUpdate({ payload: { data: diffBase64, sender: uuid } }, "");
    }, 1000)

    window.webxdc.setUpdateListener((update) => {
      const payload = update.payload;
      localStorage.setItem("last_serial", update.serial.toString());
      console.log("Received external diffs with length ", payload.data.length);
      if (!model) {
        console.warn("Received external diffs but model is not initialized yet");
        return
      }
      if (payload.sender === uuid) {
        return
      }
      // Decode base64 back to binary and convert to Uint8Array
      const diffBuffer = base64Decode(payload.data);
      const diff = new Uint8Array(diffBuffer);
      model.applyExternalDiffs(diff);
      saveSelectedModelInStorage(model);
      const newModel = Model.from_bytes(model.toBytes());
      setModel(newModel);
    }, max_serial)
    return () => {
      clearInterval(int)
    }
  })


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
      <IronCalc model={model} />
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


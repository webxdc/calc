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

declare global {
  interface Window {
    webxdc: Webxdc<any>;
  }
}

function App() {
  const [model, setModel] = useState<Model | null>(null);

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

  useEffect(() => {
    const channel = window.webxdc.joinRealtimeChannel()
    const int = setInterval(() => {
      if (!model) {
        return
      }
      let diff = model.flushSendQueue();
      if (diff.length <= 1) {
        return
      }
      saveSelectedModelInStorage(model);
      console.log("Sending external diffs", diff);
      channel.send(diff)
    }, 1000)
    channel.setListener((payload) => {
      console.log("Received external diffs", payload);
      if (!model) {
        console.warn("Received external diffs but model is not initialized yet");
        return
      }
      model.applyExternalDiffs(payload);
      const newModel = Model.from_bytes(model.toBytes());
      setModel(newModel);
    })
    return () => {
      channel.leave()
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

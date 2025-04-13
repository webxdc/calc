import "./App.css";
import styled from "@emotion/styled";
import { useEffect, useState } from "react";
import {
  loadModelFromStorageOrCreate,
  saveSelectedModelInStorage,
} from "./components/storage";

// From IronCalc
import { IronCalc, IronCalcIcon } from "@ironcalc/workbook";
import {Model} from "@ironcalc/wasm";
function App() {
  const [model, setModel] = useState<Model | null>(null);

  useEffect(() => {
      const newModel = loadModelFromStorageOrCreate();
      setModel(newModel);
  }, []);

  if (!model) {
    return (
      <Loading>
        <IronCalcIcon style={{ width: 24, height: 24, marginBottom: 16 }} />
        <div>Loading IronCalc</div>
      </Loading>
    );
  }

  // We try to save the model every second
  setInterval(() => {
    const queue = model.flushSendQueue();
    if (queue.length !== 1) {
      saveSelectedModelInStorage(model);
    }
  }, 1000);

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

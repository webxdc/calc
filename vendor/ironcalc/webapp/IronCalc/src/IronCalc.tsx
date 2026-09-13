import type { Model } from "@ironcalc/wasm";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { I18nextProvider } from "react-i18next";
import Workbook from "./components/Workbook/Workbook.tsx";
import { WorkbookState } from "./components/workbookState.ts";
import i18n from "./i18n";
import "./theme/theme.css";
import "./index.css";
import {
  type PartialIronCalcThemeVariables,
  setThemeVariables,
  unsetThemeVariables,
} from "./theme";

interface IronCalcProperties {
  model: Model;
  themeVariables?: PartialIronCalcThemeVariables;
  rootContainer?: HTMLElement | null;
  /** When false, renders without the toolbar, the formula bar is read-only and all edits are blocked. */
  canEdit?: boolean;
  // If we apply a mutation to the model from outside React
  // (e.g. applying a remote diff), we want to update the
  // canvas without throwing away the editing state. This can
  // be done by incrementing the externalRevision prop.
  externalRevision?: number;
}

export interface IronCalcHandle {
  setLanguage: (language: string) => void;
}

const IronCalc = forwardRef<IronCalcHandle, IronCalcProperties>(
  (
    {
      themeVariables,
      model,
      rootContainer,
      canEdit = true,
      externalRevision = 0,
    },
    ref,
  ) => {
    const root = rootContainer ?? document.body;
    useEffect(() => {
      if (root.classList.contains("ic-root")) {
        console.warn("rootContainer already in use:", root);
      }
      root.classList.add("ic-root");
      return () => root.classList.remove("ic-root");
    }, [root]);

    // We keep WorkbookState and the model as a ref, so that
    // it survives re-rendering this component.
    // We build a new WorkbookState whenever the model identity changes.
    const workbook = useRef<{ state: WorkbookState; model: Model } | null>(
      null,
    );
    if (workbook.current === null || workbook.current.model !== model) {
      workbook.current = { state: new WorkbookState(), model };
    }
    const workbookState = workbook.current.state;

    useEffect(() => {
      if (themeVariables) {
        setThemeVariables(themeVariables, root);
        return () => unsetThemeVariables(root);
      }
    }, [root, themeVariables]);

    useImperativeHandle(ref, () => ({
      setLanguage(language: string) {
        if (i18n.language !== language) {
          i18n.changeLanguage(language);
          const lang = language.split("-")[0];
          model.setLanguage(lang);
        }
      },
    }));

    return (
      <div className="ic-widget">
        <I18nextProvider i18n={i18n}>
          <Workbook
            model={model}
            workbookState={workbookState}
            canEdit={canEdit}
            externalRevision={externalRevision}
          />
        </I18nextProvider>
      </div>
    );
  },
);

IronCalc.displayName = "IronCalc";

export default IronCalc;

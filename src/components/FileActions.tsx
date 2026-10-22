import styled from "@emotion/styled";
import { Model } from "@ironcalc/workbook";
import ExportButton from "./ExportButton";
import ImportButton from "./ImportButton";

/**
 * The import and export buttons, laid over the empty right
 * end of IronCalc's sheet tab bar.
 */
function FileActions({
  model,
  onImported,
}: {
  model: Model;
  onImported: (model: Model) => void;
}) {
  return (
    <Row>
      <ImportButton onImported={onImported} />
      <ExportButton model={model} />
    </Row>
  );
}

const Row = styled("div")`
  position: absolute;
  right: 8px;
  bottom: 0;
  height: var(--navigation-height, 40px);
  display: flex;
  align-items: center;
  z-index: 2;
`;

export default FileActions;

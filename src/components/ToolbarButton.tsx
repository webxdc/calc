import styled from "@emotion/styled";

/**
 * An icon button for the file actions in the sheet tab bar.
 *
 * Positioning belongs to `FileActions`, which lays the buttons out as a row,
 * so this only carries the look and the hit area. 44px wide against a 40px
 * tall tab bar keeps the touch target usable on a phone.
 */
export const ToolbarButton = styled("button")`
  height: 100%;
  width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--palette-grey-700, #333);
  font-family: var(--typography-font-family);

  &:hover:not(:disabled) {
    color: var(--palette-primary-main, #f2994a);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
`;

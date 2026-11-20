import { fireEvent, screen, within } from "@testing-library/react";

/** Responde ao diálogo de confirmação do produto (`useConfirm`). */
export async function answerConfirm(accept: boolean): Promise<void> {
  const dialog = await screen.findByRole("alertdialog");
  const testId = accept ? "confirm-dialog-confirm" : "confirm-dialog-cancel";
  fireEvent.click(within(dialog).getByTestId(testId));
}

export type DraftReviewAction = "create" | "revise" | "cancel" | "invalid";

export function parseDraftReviewAction(input: string): DraftReviewAction {
  switch (input.trim().toLowerCase()) {
    case "y":
    case "yes":
      return "create";
    case "r":
    case "revise":
      return "revise";
    case "":
    case "n":
    case "no":
    case "cancel":
      return "cancel";
    default:
      return "invalid";
  }
}

import type { Dictionary } from "./de";

/** English dictionary. Typed as the German shape — a missing/extra key fails
 *  `tsc`, so the two locales can never silently drift. */
export const en: Dictionary = {
  common: {
    save: "Save",
    cancel: "Cancel",
    add: "Add",
    remove: "Remove",
    delete: "Delete",
    edit: "Edit",
    close: "Close",
    back: "Back",
    next: "Next",
    open: "Open",
    loading: "Loading …",
    saving: "Saving …",
    saved: "Saved",
    error: "Error",
    retry: "Try again",
    confirm: "Confirm",
    yes: "Yes",
    no: "No",
    optional: "optional",
    fullscreen: "Fullscreen",
  },
  language: {
    label: "Language",
    german: "German",
    english: "English",
    switchTo: "Switch to German",
  },
};

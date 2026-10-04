import { useContext } from "react"
import { LanguageContext } from "./LanguageContext"

/** Access the active language and its setters from anywhere in the tree. */
export function useLanguage() {
  return useContext(LanguageContext)
}

import { createContext } from "preact";
import { useContext } from "preact/hooks";
import { MESSAGES, type Messages } from "../i18n";

export const I18n = createContext<Messages>(MESSAGES.en);
export const useT = () => useContext(I18n);

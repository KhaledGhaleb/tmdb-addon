import { useContext } from "react";
import { ConfigContext } from "./config";

export const useConfig = () => useContext(ConfigContext);

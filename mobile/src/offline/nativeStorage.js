import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Keychain from "react-native-keychain";
import { SecureStore } from "./secureStore";

const sessionService = "communedigit.active-session.v1";
const options = (service) => ({
  service,
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
export const vault = {
  async get(service) {
    const result = await Keychain.getGenericPassword(options(service));
    return result ? result.password : null;
  },
  async set(service, value) {
    const result = await Keychain.setGenericPassword(
      "communedigit",
      value,
      options(service),
    );
    if (!result) throw new Error("Trousseau sécurisé indisponible");
  },
  async remove(service) {
    await Keychain.resetGenericPassword(options(service));
  },
};
export const accountStore = (backend, id) =>
  new SecureStore(AsyncStorage, vault, backend, id);
export const saveSession = (session) =>
  vault.set(sessionService, JSON.stringify(session));
export const readSession = async () => {
  const value = await vault.get(sessionService);
  return value ? JSON.parse(value) : null;
};
export const clearSession = () => vault.remove(sessionService);

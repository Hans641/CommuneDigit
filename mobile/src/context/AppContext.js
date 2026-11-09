import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { darkTheme, lightTheme } from "../theme";
import { translations } from "./i18n";
import {
  authAPI,
  createSyncAPI,
  setBackendUrl,
  getBackendUrl,
} from "../services/api";
import { OfflineEngine } from "../offline/engine";
import {
  accountStore,
  readSession,
  saveSession,
  clearSession,
} from "../offline/nativeStorage";
import { tokenValid } from "../offline/crypto";

const ThemeContext = createContext(null),
  LangContext = createContext(null),
  AuthContext = createContext(null),
  SyncContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);
export const useLang = () => useContext(LangContext);
export const useAuth = () => useContext(AuthContext);
export const useSync = () => useContext(SyncContext);
const initialSync = {
  ready: false,
  pending: 0,
  issues: [],
  citizens: [],
  actes: [],
  busy: false,
  online: false,
  error: "",
  notice: "",
};
const profile = (user) => ({
  ...user,
  name: [user.nom, user.prenom].filter(Boolean).join(" "),
});

export function AppProvider({ children }) {
  const [isDark, setIsDark] = useState(true),
    [lang, setLang] = useState("mg");
  const [user, setUser] = useState(null),
    [authError, setAuthError] = useState(""),
    [restoring, setRestoring] = useState(true);
  const [backendUrl, changeBackend] = useState(getBackendUrl());
  const [sync, setSync] = useState(initialSync);
  const engine = useRef(null),
    activeSession = useRef(null),
    connection = useRef(false),
    authQueue = useRef(Promise.resolve());
  const mounted = useRef(true),
    foregroundActive = useRef(AppState.currentState !== "background");
  const serialize = (action) => {
    const result = authQueue.current.then(action);
    authQueue.current = result.catch(() => {});
    return result;
  };
  const lock = async (message) => {
    const previous = engine.current;
    engine.current = null;
    await previous?.dispose();
    authAPI.logout();
    if (activeSession.current) {
      activeSession.current = { ...activeSession.current, token: null };
      try {
        await saveSession(activeSession.current);
      } catch {
        await clearSession().catch(() => {});
      }
    }
    if (mounted.current) {
      setUser(null);
      setSync(initialSync);
      setAuthError(message);
    }
  };
  const attach = async (session, freshLogin = false) => {
    setBackendUrl(session.backend);
    authAPI.setToken(session.token);
    const client = new OfflineEngine({
      store: accountStore(session.backend, session.user.id),
      api: createSyncAPI(session.backend, session.token),
      user: session.user,
      onChange: (value) => {
        if (engine.current === client && mounted.current) setSync(value);
      },
      onAuth: (message) =>
        serialize(() =>
          engine.current === client ? lock(message) : undefined,
        ),
      onProfile: (value) => {
        if (engine.current === client && mounted.current)
          setUser((previous) =>
            JSON.stringify(previous) === JSON.stringify(profile(value))
              ? previous
              : profile(value),
          );
        serialize(async () => {
          if (engine.current !== client || !activeSession.current) return;
          if (
            JSON.stringify(activeSession.current.user) === JSON.stringify(value)
          )
            return;
          activeSession.current = { ...activeSession.current, user: value };
          await saveSession(activeSession.current);
        }).catch(() => {
          if (mounted.current)
            setSync((value) => ({
              ...value,
              error:
                "Session sécurisée non actualisée ; reconnectez-vous avant de fermer l’application.",
            }));
        });
      },
    });
    engine.current = client;
    await client.init();
    if (freshLogin) {
      await client.setOnline(true);
      if (!client.verified || client.authBlocked)
        throw new Error(
          client.error ||
            "Vérification du périmètre impossible ; reconnectez-vous en ligne",
        );
    }
    if (!mounted.current) {
      await client.dispose();
      return;
    }
    activeSession.current = { ...session, user: client.user };
    if (mounted.current) {
      setUser(profile(client.user));
      changeBackend(session.backend);
      setAuthError("");
    }
    if (!freshLogin) client.setOnline(connection.current);
  };
  useEffect(() => {
    mounted.current = true;
    serialize(async () => {
      try {
        const session = await readSession();
        if (session) {
          activeSession.current = session;
          changeBackend(session.backend);
          if (tokenValid(session.token)) await attach(session);
          else
            setAuthError(
              "Session expirée. Reconnectez-vous en ligne ; les saisies locales sont conservées.",
            );
        }
      } catch {
        await lock(
          "Stockage sécurisé indisponible. Les données locales ont été conservées.",
        );
      } finally {
        if (mounted.current) setRestoring(false);
      }
    });
    const network = NetInfo.addEventListener((state) => {
      // A LAN backend can be reachable even when the Internet probe fails.
      connection.current = !!state.isConnected;
      const client = engine.current;
      if (client) {
        if (foregroundActive.current) client.setOnline(connection.current);
        else {
          client.online = connection.current;
          client.emit();
        }
      }
    });
    const foreground = AppState.addEventListener("change", (state) => {
      foregroundActive.current = state === "active";
      if (state === "active") {
        const session = activeSession.current;
        if (session && !tokenValid(session.token))
          serialize(() =>
            lock(
              "Session expirée ; reconnectez-vous. Les saisies sont conservées.",
            ),
          );
        else engine.current?.synchronize();
      }
    });
    const timer = setInterval(() => {
      if (!foregroundActive.current) return;
      const session = activeSession.current;
      if (session && !tokenValid(session.token)) {
        if (engine.current)
          serialize(() =>
            lock(
              "Session expirée ; reconnectez-vous. Les saisies sont conservées.",
            ),
          );
      } else engine.current?.synchronize();
    }, 30000);
    return () => {
      mounted.current = false;
      network();
      foreground.remove();
      clearInterval(timer);
      engine.current?.dispose();
    };
  }, []);
  const login = useCallback(
    (username, password) =>
      serialize(async () => {
        setAuthError("");
        try {
          setBackendUrl(backendUrl);
          const data = await authAPI.login(username, password);
          const session = {
            backend: getBackendUrl(),
            token: data.access_token,
            user: data.user,
          };
          await engine.current?.dispose();
          await attach(session, true);
          await saveSession(activeSession.current);
          return { success: true };
        } catch (error) {
          await lock(
            error.status === 401
              ? "Identifiants incorrects"
              : error.message || "Connexion impossible",
          );
          return {
            success: false,
            error:
              error.status === 401 ? "Identifiants incorrects" : error.message,
          };
        }
      }),
    [backendUrl],
  );
  const logout = () =>
    serialize(async () => {
      setRestoring(true);
      const previous = engine.current;
      engine.current = null;
      try {
        await previous?.dispose({ purge: true });
        await clearSession();
        setAuthError("");
      } catch {
        await clearSession().catch(() => {});
        setAuthError(
          "Session fermée ; effacement local incomplet, vérifiez le stockage de cet appareil.",
        );
      } finally {
        activeSession.current = null;
        authAPI.logout();
        setUser(null);
        setSync(initialSync);
        setRestoring(false);
      }
    });
  const save = async (type, data, id = null, options = {}) => {
    if (!activeSession.current || !tokenValid(activeSession.current.token)) {
      await serialize(() => lock("Session expirée ; reconnectez-vous."));
      throw new Error("Session expirée");
    }
    const client = engine.current;
    if (!client) throw new Error("Session verrouillée");
    const result = await client.enqueue(type, data, id, options);
    client.synchronize();
    return result;
  };
  const tr = useCallback(
    (section, key) =>
      translations[section]?.[lang]?.[key] ??
      translations[section]?.fr?.[key] ??
      key,
    [lang],
  );
  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        authError,
        restoring,
        backendUrl,
        setBackendUrl: changeBackend,
      }}
    >
      <ThemeContext.Provider
        value={{
          theme: isDark ? darkTheme : lightTheme,
          isDark,
          toggleTheme: () => setIsDark((d) => !d),
        }}
      >
        <LangContext.Provider
          value={{
            lang,
            setLang,
            toggleLang: () => setLang((l) => (l === "fr" ? "mg" : "fr")),
            tr,
          }}
        >
          <SyncContext.Provider
            value={{
              ...sync,
              save,
              synchronize: () => engine.current?.synchronize(),
              discard: (type, id) =>
                engine.current
                  ? engine.current.discard(type, id)
                  : Promise.reject(new Error("Session fermée")),
              retry: (type, id) =>
                engine.current
                  ? engine.current.retry(type, id)
                  : Promise.reject(new Error("Session fermée")),
            }}
          >
            {children}
          </SyncContext.Provider>
        </LangContext.Provider>
      </ThemeContext.Provider>
    </AuthContext.Provider>
  );
}

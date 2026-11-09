import React from "react";
import { Text } from "react-native";
import renderer, { act } from "react-test-renderer";
import { AppProvider, useAuth, useSync } from "../src/context/AppContext";
import {
  readSession,
  accountStore,
  saveSession,
} from "../src/offline/nativeStorage";
import { createSyncAPI } from "../src/services/api";
import { encode } from "base-64";

jest.mock("../src/offline/nativeStorage", () => ({
  readSession: jest.fn(),
  saveSession: jest.fn(async () => {}),
  clearSession: jest.fn(async () => {}),
  accountStore: jest.fn(),
}));
jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(() => () => {}),
}));
jest.mock("../src/services/api", () => ({
  authAPI: { setToken: jest.fn(), logout: jest.fn(), login: jest.fn() },
  createSyncAPI: jest.fn(),
  setBackendUrl: jest.fn(),
  getBackendUrl: () => "https://example.com/api",
}));
const liveTrees = new Set();
function trackRender(node) {
  const tree = renderer.create(node);
  liveTrees.add(tree);
  return tree;
}
afterEach(() => {
  act(() => { for (const tree of liveTrees) tree.unmount(); });
  liveTrees.clear();
});
let currentAuth, currentSync;
function Probe() {
  currentAuth = useAuth();
  currentSync = useSync();
  return <Text>{currentAuth.user?.id || "locked"}</Text>;
}
function session(expires) {
  return {
    backend: "https://example.com/api",
    user: { id: 1, role: "Agent Fokontany" },
    token: "header." + encode(JSON.stringify({ exp: expires })) + ".signature",
  };
}
beforeEach(() => {
  jest.clearAllMocks();
  readSession.mockResolvedValue(null);
});

test("an expired persisted session never unlocks the cache offline", async () => {
  readSession.mockResolvedValue(session(Date.now() / 1000 - 1));
  let tree;
  await act(async () => {
    tree = trackRender(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  });
  expect(currentAuth.user).toBeNull();
  expect(currentAuth.authError).toContain("expirée");
  expect(accountStore).not.toHaveBeenCalled();
  tree.unmount();
});
test("valid offline sessions restore only their own encrypted data", async () => {
  readSession.mockResolvedValue(session(Date.now() / 1000 + 3600));
  const store = {
    init: jest.fn(async () => {}),
    read: jest.fn(async () => ({
      v: 1,
      scope: "a".repeat(64),
      device: "test",
      outbox: [],
      remote: {
        citoyen: { one: { data: { nom: "Local" }, metadata: {}, version: 1 } },
        acte: {},
      },
      cursors: { citoyen: null, acte: null },
    })),
    write: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  };
  accountStore.mockReturnValue(store);
  createSyncAPI.mockReturnValue({});
  let tree;
  await act(async () => {
    tree = trackRender(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  });
  expect(currentAuth.user.id).toBe(1);
  expect(currentSync.citizens[0].nom).toBe("Local");
  expect(accountStore).toHaveBeenCalledWith("https://example.com/api", 1);
  await act(async () => {
    await currentAuth.logout();
  });
  expect(store.clear).toHaveBeenCalledTimes(1);
  expect(currentAuth.user).toBeNull();
  tree.unmount();
});

test("server rejection locks the UI but preserves unsent encrypted work", async () => {
  const NetInfo = require("@react-native-community/netinfo");
  readSession.mockResolvedValue(session(Date.now() / 1000 + 3600));
  const store = {
    init: jest.fn(async () => {}),
    read: jest.fn(async () => ({
      v: 1,
      scope: "a".repeat(64),
      device: "test",
      outbox: [
        {
          id: "operation",
          record: {
            entity_id: "local",
            entity_type: "citoyen",
            data: { nom: "Local" },
          },
        },
      ],
      remote: { citoyen: {}, acte: {} },
      cursors: { citoyen: null, acte: null },
    })),
    write: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  };
  accountStore.mockReturnValue(store);
  createSyncAPI.mockReturnValue({
    me: jest.fn(async () => {
      throw Object.assign(new Error("Expired"), { status: 401 });
    }),
  });
  let tree;
  await act(async () => {
    tree = trackRender(
      <AppProvider>
        <Probe />
      </AppProvider>,
    );
  });
  const callback = NetInfo.addEventListener.mock.calls.at(-1)[0];
  await act(async () => {
    callback({ isConnected: true, isInternetReachable: true });
    await new Promise(setImmediate);
  });
  expect(currentAuth.user).toBeNull();
  expect(store.clear).not.toHaveBeenCalled();
  expect(store.write).not.toHaveBeenCalled();
  expect(saveSession.mock.calls.at(-1)[0].token).toBeNull();
  tree.unmount();
});

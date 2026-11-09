import React from "react";
import renderer, { act } from "react-test-renderer";
import { darkTheme } from "../src/theme";
import {
  CitoyensScreen,
  RecordEditor,
  SyncPanel,
} from "../src/screens/OfflineRecords";
import HomeScreen from "../src/screens/HomeScreen";
import { PaiementsScreen } from "../src/screens/OtherScreens";
import { Button, Input } from "../src/components/UIKit";
import { useSync } from "../src/context/AppContext";

jest.mock("../src/context/AppContext", () => ({
  useTheme: () => ({
    theme: require("../src/theme").darkTheme,
    isDark: true,
    toggleTheme: jest.fn(),
  }),
  useLang: () => ({ lang: "fr", tr: (_, key) => key, setLang: jest.fn() }),
  useAuth: () => ({
    user: { id: 1, role: "Agent Fokontany", name: "Test", fokontany: "Test" },
    logout: jest.fn(),
  }),
  useSync: jest.fn(),
}));
jest.mock("../src/services/api", () => ({
  dashboardAPI: { stats: jest.fn(async () => ({})) },
  transactionsAPI: { list: jest.fn(async () => []) },
}));
const data = () => ({
  generation: 0,
  ready: true,
  busy: false,
  online: false,
  pending: 0,
  issues: [],
  citizens: [],
  actes: [],
  fokontany: [],
  save: jest.fn(async () => {}),
  synchronize: jest.fn(),
  discard: jest.fn(),
  retry: jest.fn(),
});
beforeEach(() => useSync.mockReturnValue(data()));

test("citizen creation button opens a form and persists through the shared queue", async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(<CitoyensScreen />);
  });
  act(() =>
    tree.root
      .findAllByType(Button)
      .find((b) => b.props.label === "Nouveau")
      .props.onPress(),
  );
  for (const [label, value] of [
    ["Nom", "RAKOTO"],
    ["Prénom", "Jean"],
    ["Téléphone", "0340000000"],
  ]) {
    act(() =>
      tree.root
        .findAllByType(Input)
        .find((i) => i.props.label === label)
        .props.onChangeText(value),
    );
  }
  await act(async () =>
    tree.root
      .findAllByType(Button)
      .find((b) => b.props.label === "Enregistrer sur cet appareil")
      .props.onPress(),
  );
  expect(useSync().save).toHaveBeenCalledWith(
    "citoyen",
    expect.objectContaining({ nom: "RAKOTO", telephone: "0340000000" }),
    null,
    { replace: false },
  );
  expect(useSync().save.mock.calls[0][1]).not.toHaveProperty("fokontany_id");
  tree.unmount();
});
test("failed local writes keep the editor open with an error", async () => {
  const state = data();
  state.save.mockRejectedValue(new Error("Stockage plein"));
  useSync.mockReturnValue(state);
  const close = jest.fn();
  let tree;
  await act(async () => {
    tree = renderer.create(<RecordEditor type="citoyen" onClose={close} />);
  });
  await act(async () =>
    tree.root
      .findAllByType(Button)
      .find((b) => b.props.label === "Enregistrer sur cet appareil")
      .props.onPress(),
  );
  expect(close).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain("Stockage plein");
  tree.unmount();
});
test("home, payments and sync status render without placeholder-variable crashes", async () => {
  for (const component of [
    <HomeScreen onNavigate={jest.fn()} />,
    <PaiementsScreen />,
    <SyncPanel details />,
  ]) {
    let tree;
    await act(async () => {
      tree = renderer.create(component);
    });
    expect(tree.toJSON()).toBeTruthy();
    tree.unmount();
  }
});

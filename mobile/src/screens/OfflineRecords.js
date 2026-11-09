import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useSync, useTheme, useAuth, useLang } from "../context/AppContext";
import { Button, Input, Card } from "../components/UIKit";

const labels = {
  nom: "Nom",
  prenom: "Prénom",
  telephone: "Téléphone",
  cin: "CIN",
  adresse: "Adresse",
  nom_concerne: "Nom concerné",
  date_evenement: "Date (AAAA-MM-JJ)",
  lieu_evenement: "Lieu",
  details_json: "Informations complémentaires",
};
const fields = {
  citoyen: ["nom", "prenom", "telephone", "cin", "adresse"],
  acte: ["nom_concerne", "date_evenement", "lieu_evenement", "details_json"],
};
export function RecordEditor({ type, initial = null, server = null, onClose }) {
  const sync = useSync(),
    { theme } = useTheme(),
    { user } = useAuth();
  const generation = useRef(sync.generation);
  useEffect(() => {
    if (sync.generation !== generation.current || !sync.ready) onClose();
  }, [sync.generation, sync.ready]);
  const keys = fields[type];
  const seed = Object.fromEntries(
    keys.map((k) => [
      k,
      k === "date_evenement"
        ? (initial?.[k] || "").slice(0, 10)
        : initial?.[k] || "",
    ]),
  );
  seed.type_acte = initial?.type_acte || "Naissance";
  seed.citoyen_id = initial?.citoyen_id || null;
  seed.fokontany_id = initial?.fokontany_id ?? null;
  const [form, setForm] = useState(seed),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [citizenSearch, setCitizenSearch] = useState(""),
    [fokSearch, setFokSearch] = useState("");
  async function submit() {
    setSaving(true);
    setError("");
    try {
      let payload = Object.fromEntries(
        [
          ...keys,
          ...(type === "acte" ? ["type_acte", "citoyen_id"] : []),
          "fokontany_id",
        ].map((k) => [k, form[k] === "" ? null : form[k]]),
      );
      if (user?.role === "Agent Fokontany" && payload.fokontany_id === null)
        delete payload.fokontany_id;
      if (initial && !initial._issue)
        payload = Object.fromEntries(
          Object.entries(payload).filter(
            ([k, v]) => (seed[k] || null) !== (v || null),
          ),
        );
      if (!initial || initial._issue || Object.keys(payload).length)
        await sync.save(type, payload, initial?.id || null, {
          replace: !!initial?._issue,
        });
      onClose();
    } catch (e) {
      setError(e.message || "Enregistrement local impossible");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingTop: 50, gap: 14 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={{ fontSize: 22, color: theme.textPrimary }}>
            {initial ? "Modifier" : "Nouveau"}{" "}
            {type === "citoyen" ? "citoyen" : "acte"}
          </Text>
          <Text style={{ color: theme.textMuted }}>
            La saisie est enregistrée sur cet appareil avant tout envoi.
          </Text>
          {server?.data && (
            <Card>
              <Text style={{ color: theme.textPrimary }}>
                Version serveur reçue — comparez avant de renvoyer :
              </Text>
              {keys.map((k) => (
                <Text key={k} style={{ color: theme.textSecondary }}>
                  {labels[k]} : {String(server.data[k] ?? "—")}
                </Text>
              ))}
            </Card>
          )}
          {type === "acte" && (
            <View style={{ flexDirection: "row", gap: 8 }}>
              {["Naissance", "Mariage", "Décès"].map((value) => (
                <Button
                  key={value}
                  label={value}
                  variant={form.type_acte === value ? "primary" : "ghost"}
                  onPress={() => setForm((f) => ({ ...f, type_acte: value }))}
                />
              ))}
            </View>
          )}
          {keys.map((key) => (
            <Input
              key={key}
              label={labels[key]}
              value={form[key]}
              onChangeText={(value) => setForm((f) => ({ ...f, [key]: value }))}
              multiline={["adresse", "details_json"].includes(key)}
            />
          ))}
          {type === "acte" && (
            <View>
              <Text style={{ color: theme.textPrimary }}>
                Citoyen lié (facultatif)
              </Text>
              <Input
                label="Rechercher une fiche locale"
                value={citizenSearch}
                onChangeText={setCitizenSearch}
              />
              <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                <Button
                  label="Sans fiche liée"
                  variant={!form.citoyen_id ? "primary" : "ghost"}
                  onPress={() => setForm((f) => ({ ...f, citoyen_id: null }))}
                />
                {sync.citizens
                  .filter((c) =>
                    `${c.nom} ${c.prenom} ${c.cin || ""}`
                      .toLowerCase()
                      .includes(citizenSearch.toLowerCase()),
                  )
                  .slice(0, 50)
                  .map((c) => (
                    <Button
                      key={c.id}
                      label={`${c.nom} ${c.prenom}`}
                      variant={form.citoyen_id === c.id ? "primary" : "ghost"}
                      onPress={() =>
                        setForm((f) => ({
                          ...f,
                          citoyen_id: c.id,
                          fokontany_id: c.fokontany_id ?? f.fokontany_id,
                        }))
                      }
                    />
                  ))}
              </ScrollView>
            </View>
          )}
          {["Administrateur", "Superviseur"].includes(user?.role) && (
            <View>
              <Text style={{ color: theme.textPrimary }}>Fokontany</Text>
              <Input
                label="Rechercher un fokontany"
                value={fokSearch}
                onChangeText={setFokSearch}
              />
              <ScrollView style={{ maxHeight: 150 }} nestedScrollEnabled>
                <Button
                  label="Non affecté"
                  variant={!form.fokontany_id ? "primary" : "ghost"}
                  onPress={() => setForm((f) => ({ ...f, fokontany_id: null }))}
                />
                {sync.fokontany
                  ?.filter((f) =>
                    f.nom.toLowerCase().includes(fokSearch.toLowerCase()),
                  )
                  .slice(0, 50)
                  .map((f) => (
                    <Button
                      key={f.id}
                      label={f.nom}
                      variant={form.fokontany_id === f.id ? "primary" : "ghost"}
                      onPress={() =>
                        setForm((v) => ({ ...v, fokontany_id: f.id }))
                      }
                    />
                  ))}
              </ScrollView>
            </View>
          )}
          {error ? (
            <Text accessibilityRole="alert" style={{ color: theme.danger }}>
              {error}
            </Text>
          ) : null}
          <Button
            label={
              initial?._issue
                ? "Enregistrer et renvoyer ma version"
                : "Enregistrer sur cet appareil"
            }
            loading={saving}
            onPress={submit}
          />
          <Button
            label="Annuler"
            variant="ghost"
            onPress={onClose}
            disabled={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const codeLabels = {
  server_newer: "Le serveur contient une modification plus récente",
  timestamp_collision: "Deux versions ont la même date",
  record_locked: "Le dossier a été validé ou verrouillé",
  invalid_reference: "Une fiche liée est absente",
  integrity_error: "Une donnée existe déjà (CIN ou référence)",
  future_timestamp: "Vérifiez la date et l’heure du téléphone",
  invalid_data: "La saisie doit être corrigée",
  inconsistent_territory: "Le fokontany ne correspond pas à la fiche liée",
};
export function SyncPanel({ details = false }) {
  const sync = useSync(),
    { theme } = useTheme(),
    [editing, setEditing] = useState(null);
  useEffect(() => setEditing(null), [sync.generation]);
  const message = sync.busy
    ? "Synchronisation en cours…"
    : sync.error
      ? "Synchronisation interrompue"
      : !sync.online
        ? "Hors connexion — données locales"
        : sync.pending || sync.issues.length
          ? "Modifications à transmettre ou à vérifier"
          : sync.ready
            ? "À jour"
            : "Première synchronisation requise";
  function discard(op) {
    Alert.alert(
      "Abandonner cette saisie ?",
      "Les modifications locales de ce dossier seront retirées. La version serveur sera conservée.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Abandonner",
          style: "destructive",
          onPress: () =>
            sync
              .discard(op.record.entity_type, op.record.entity_id)
              .catch((e) => Alert.alert("Impossible", e.message)),
        },
      ],
    );
  }
  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Text
        accessibilityLiveRegion="polite"
        accessibilityRole="text"
        style={{ color: theme.textPrimary }}
      >
        {message} · {sync.pending} en attente · {sync.issues.length} à vérifier
      </Text>
      {sync.error ? (
        <Text style={{ color: theme.danger }}>{sync.error}</Text>
      ) : null}
      {sync.notice ? (
        <Text style={{ color: theme.warning || theme.textSecondary }}>
          {sync.notice}
        </Text>
      ) : null}
      {sync.lastSync && details ? (
        <Text style={{ color: theme.textMuted }}>
          Dernière synchronisation :{" "}
          {new Date(sync.lastSync).toLocaleString("fr-FR")}
        </Text>
      ) : null}
      <Button
        label="Synchroniser maintenant"
        onPress={sync.synchronize}
        disabled={!sync.online || sync.busy}
      />
      {details &&
        sync.issues.map((op) => (
          <Card key={op.id}>
            <Text style={{ color: theme.textPrimary }}>
              {op.record.data.nom ||
                op.record.data.nom_concerne ||
                op.record.entity_id}
            </Text>
            <Text style={{ color: theme.danger }}>
              {codeLabels[op.issue] ||
                "Saisie refusée ; vérifiez les données avant de réessayer"}
            </Text>
            {!["record_locked", "forbidden"].includes(op.issue) && (
              <Button
                label="Comparer et modifier"
                disabled={sync.busy}
                onPress={() => setEditing(op)}
              />
            )}
            <Button
              label="Conserver la version serveur"
              variant="ghost"
              disabled={sync.busy}
              onPress={() => discard(op)}
            />
          </Card>
        ))}
      {editing && (
        <RecordEditor
          type={editing.record.entity_type}
          initial={{
            ...sync[
              editing.record.entity_type === "citoyen" ? "citizens" : "actes"
            ].find((row) => row.id === editing.record.entity_id),
            id: editing.record.entity_id,
            _issue: editing.issue,
          }}
          server={editing.server}
          onClose={() => setEditing(null)}
        />
      )}
    </View>
  );
}
function RecordsScreen({ type }) {
  const { theme } = useTheme(),
    { user } = useAuth(),
    sync = useSync(),
    { lang } = useLang();
  const [search, setSearch] = useState(""),
    [editor, setEditor] = useState(undefined);
  useEffect(() => setEditor(undefined), [sync.generation]);
  const write = ["Administrateur", "Superviseur", "Agent Fokontany"].includes(
    user?.role,
  );
  const rows = (type === "citoyen" ? sync.citizens : sync.actes).filter((row) =>
    `${row.nom || row.nom_concerne} ${row.prenom || ""} ${row.cin || ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingTop: 45 }}>
      <View
        style={{
          paddingHorizontal: 20,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text style={{ color: theme.textPrimary, fontSize: 22 }}>
          {type === "citoyen"
            ? lang === "mg"
              ? "Olom-pirenena"
              : "Citoyens"
            : lang === "mg"
              ? "Dossiers"
              : "Actes"}
        </Text>
        <Button
          label="Nouveau"
          disabled={!write || !sync.ready}
          onPress={() => setEditor(null)}
        />
      </View>
      <SyncPanel />
      <TextInput
        accessibilityLabel="Rechercher dans le cache"
        placeholder="Rechercher dans les données locales"
        placeholderTextColor={theme.textMuted}
        value={search}
        onChangeText={setSearch}
        style={{
          marginHorizontal: 20,
          padding: 12,
          color: theme.textPrimary,
          borderWidth: 1,
          borderColor: theme.border,
          borderRadius: 12,
        }}
      />
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 10 }}
        ListEmptyComponent={
          <Text style={{ color: theme.textMuted }}>
            Aucun dossier local. Connectez-vous pour récupérer les données
            autorisées.
          </Text>
        }
        renderItem={({ item }) => (
          <Card>
            <Text style={{ color: theme.textPrimary, fontWeight: "700" }}>
              {item.nom || item.nom_concerne} {item.prenom || ""}
            </Text>
            <Text style={{ color: theme.textMuted }}>
              {type === "citoyen"
                ? item.telephone
                : `${item.type_acte} · ${(item.date_evenement || "").slice(0, 10)}`}
            </Text>
            <Text
              style={{
                color: item._issue ? theme.danger : theme.textSecondary,
              }}
            >
              {item._issue
                ? "À vérifier dans Paramètres"
                : item._pending
                  ? "Enregistré localement — en attente"
                  : item._provisional
                    ? "Envoyé — lecture serveur en attente"
                    : item.statut || "Synchronisé"}
            </Text>
            <Button
              label="Modifier"
              variant="ghost"
              disabled={
                !write ||
                !!item._issue ||
                item.is_validated ||
                ["Validé", "Rejeté"].includes(item.statut)
              }
              onPress={() => setEditor(item)}
            />
          </Card>
        )}
      />
      {editor !== undefined && (
        <RecordEditor
          type={type}
          initial={editor}
          onClose={() => setEditor(undefined)}
        />
      )}
    </View>
  );
}
export const CitoyensScreen = () => <RecordsScreen type="citoyen" />;
export const DossiersScreen = () => <RecordsScreen type="acte" />;

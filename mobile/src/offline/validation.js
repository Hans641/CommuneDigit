export function validateRecord(type, input) {
  const data = { ...input };
  for (const key of Object.keys(data))
    if (typeof data[key] === "string") data[key] = data[key].trim();
  const required =
    type === "citoyen"
      ? ["nom", "prenom", "telephone"]
      : ["type_acte", "nom_concerne", "date_evenement"];
  for (const key of required)
    if (!data[key]) throw new Error("Remplissez tous les champs obligatoires");
  if (type === "citoyen") {
    if (data.nom.length > 100 || data.prenom.length > 200)
      throw new Error("Nom ou prénom trop long");
    if (data.telephone.length < 8 || data.telephone.length > 20)
      throw new Error("Téléphone : 8 à 20 caractères");
    if (data.cin?.length > 30) throw new Error("CIN trop long");
    data.cin = data.cin || null;
  } else {
    if (!["Naissance", "Mariage", "Décès"].includes(data.type_acte))
      throw new Error("Type d’acte invalide");
    if (data.nom_concerne.length > 300) throw new Error("Nom trop long");
    const date = data.date_evenement.slice(0, 10);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date
    )
      throw new Error("Date invalide : utilisez AAAA-MM-JJ");
    data.date_evenement = date + "T00:00:00Z";
    data.citoyen_id = data.citoyen_id || null;
  }
  if (
    data.fokontany_id !== null &&
    data.fokontany_id !== undefined &&
    (!Number.isInteger(data.fokontany_id) || data.fokontany_id <= 0)
  )
    throw new Error("Fokontany invalide");
  return data;
}

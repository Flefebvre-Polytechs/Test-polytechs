-- Les prix sont saisis en centimes d'euro HT, sans valeur inventée pour les références existantes.
ALTER TABLE epi_products ADD COLUMN unit_cost_cents INTEGER;
-- Photo immuable des prix au moment de chaque mouvement: anciens mouvements non valorisés (NULL).
ALTER TABLE epi_movements ADD COLUMN unit_cost_cents INTEGER;

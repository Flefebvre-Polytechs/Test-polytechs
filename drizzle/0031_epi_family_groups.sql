-- Reclassify existing references only; product codes, stocks and histories are preserved.
UPDATE epi_products
SET family='TÊTE', revision=revision+1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE upper(replace(replace(replace(replace(replace(replace(trim(family),'ê','e'),'Ê','E'),'/',''),' ',''),'-',''),'&','ET')) IN ('YEUX','YEUXVISAGE','YEUXETVISAGE','TETE') AND family<>'TÊTE';

-- Imported hand protection already uses MAIN; remove the duplicate plural category.
UPDATE epi_products
SET family='MAIN', revision=revision+1, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE upper(trim(family))='MAINS';

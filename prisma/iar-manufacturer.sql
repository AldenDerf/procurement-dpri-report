ALTER TABLE iar
ADD COLUMN IF NOT EXISTS manufacturer VARCHAR(255) NULL AFTER brand;

UPDATE iar AS i
JOIN procured_meds AS p
  ON p.po_number = i.po_number
 AND p.item_no = i.item_number
SET i.manufacturer = p.manufacturer
WHERE i.manufacturer IS NULL;

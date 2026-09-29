"""
Process the new guest list Excel (invitadosbodaprimo2.xlsx)
into guest_list.json matching the Supabase 'guests' table schema.

Schema per row:
  codigo          TEXT   – e.g. "AJ04" (primary) or "AJ04-C1" (companion)
  nombre          TEXT   – person name
  grupo           TEXT   – e.g. "Familia Novio"
  cupos           INT    – total slots for the invitation (0 for companions)
  es_acompanante  BOOL   – true for companions
  acompanante_de  TEXT   – primary person's name (null for primaries)
  estado          TEXT   – "Pendiente" (default)
  restricciones   TEXT   – null
  confirmado_en   TEXT   – null
"""

import openpyxl
import json
import re
import sys

# ── Hoja 2 expansion map: when the primary name matches a family label,
#    expand into the named members listed in Hoja 2 ──────────────────────
FAMILY_EXPANSION = {
    "Familia Pizarro Charris": ["Vilma Charris", "Gualdo Pizarro"],
    "Familia Romero": ["Roberto Romero", "Ledys De Romero", "Karla Romero", "Marla Romero"],
    "Familia Retamozo": ["Marla Retamozo", "Gonzalo Conrado", "Gonzalo Jr. Conrado", "Rafael Conrado", "Lia Conrado"],
}


def process_excel(xlsx_path: str, output_path: str = "guest_list_new.json"):
    wb = openpyxl.load_workbook(xlsx_path)
    ws = wb["Hoja 1"]

    guests = []
    total_personas = 0

    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, values_only=True):
        cod, nombre, personas, grupo = row[0], row[1], row[2], row[3]

        # Skip empty / total rows
        if cod is None or nombre is None:
            continue
        cod = str(cod).strip()
        nombre = str(nombre).strip()
        if nombre in ("TOTAL INVITADOS", "NOMBRE / FAMILIA") or cod in ("COD",):
            continue

        personas = int(personas) if personas else 1
        grupo = str(grupo).strip() if grupo else ""
        total_personas += personas

        # ── Check for family expansion from Hoja 2 ──
        if nombre in FAMILY_EXPANSION:
            members = FAMILY_EXPANSION[nombre]
            primary_name = members[0]

            guests.append({
                "codigo": cod,
                "nombre": primary_name,
                "grupo": grupo,
                "cupos": personas,
                "es_acompanante": False,
                "acompanante_de": None,
                "estado": "Pendiente",
                "restricciones": None,
                "confirmado_en": None,
            })

            for idx, member in enumerate(members[1:]):
                guests.append({
                    "codigo": f"{cod}-C{idx+1}",
                    "nombre": member,
                    "grupo": grupo,
                    "cupos": 0,
                    "es_acompanante": True,
                    "acompanante_de": primary_name,
                    "estado": "Pendiente",
                    "restricciones": None,
                    "confirmado_en": None,
                })

            # If personas > named members, add unnamed slots
            if personas > len(members):
                for extra in range(personas - len(members)):
                    guests.append({
                        "codigo": f"{cod}-X{extra+1}",
                        "nombre": f"Miembro de {nombre} #{extra+1}",
                        "grupo": grupo,
                        "cupos": 0,
                        "es_acompanante": True,
                        "acompanante_de": primary_name,
                        "estado": "Pendiente",
                        "restricciones": None,
                        "confirmado_en": None,
                    })
            continue

        # ── Detect splitting patterns: " & ", " y ", " - " ──
        has_ampersand = " & " in nombre
        has_dash = " - " in nombre

        if has_ampersand:
            parts = [p.strip() for p in nombre.split(" & ")]
        elif has_dash:
            parts = [p.strip() for p in nombre.split(" - ")]
        elif re.search(r"\s+y\s+", nombre):
            parts = [p.strip() for p in re.split(r"\s+y\s+", nombre)]
        else:
            parts = [nombre]

        # ── CASE 1: Single person ──
        if personas == 1:
            guests.append({
                "codigo": cod,
                "nombre": nombre,
                "grupo": grupo,
                "cupos": 1,
                "es_acompanante": False,
                "acompanante_de": None,
                "estado": "Pendiente",
                "restricciones": None,
                "confirmado_en": None,
            })

        # ── CASE 2: Multiple named people we can split ──
        elif len(parts) >= 2 and personas >= 2:
            primary = parts[0]
            guests.append({
                "codigo": cod,
                "nombre": primary,
                "grupo": grupo,
                "cupos": personas,
                "es_acompanante": False,
                "acompanante_de": None,
                "estado": "Pendiente",
                "restricciones": None,
                "confirmado_en": None,
            })
            for idx, comp in enumerate(parts[1:]):
                guests.append({
                    "codigo": f"{cod}-C{idx+1}",
                    "nombre": comp,
                    "grupo": grupo,
                    "cupos": 0,
                    "es_acompanante": True,
                    "acompanante_de": primary,
                    "estado": "Pendiente",
                    "restricciones": None,
                    "confirmado_en": None,
                })

            # Fill remaining unnamed slots
            named_count = len(parts)
            if personas > named_count:
                for extra in range(personas - named_count):
                    guests.append({
                        "codigo": f"{cod}-X{extra+1}",
                        "nombre": f"Acompañante de {primary} #{extra+1}",
                        "grupo": grupo,
                        "cupos": 0,
                        "es_acompanante": True,
                        "acompanante_de": primary,
                        "estado": "Pendiente",
                        "restricciones": None,
                        "confirmado_en": None,
                    })

        # ── CASE 3: Group/family name without splittable names ──
        elif len(parts) == 1 and personas >= 2:
            primary_name = parts[0]
            guests.append({
                "codigo": cod,
                "nombre": primary_name,
                "grupo": grupo,
                "cupos": personas,
                "es_acompanante": False,
                "acompanante_de": None,
                "estado": "Pendiente",
                "restricciones": None,
                "confirmado_en": None,
            })
            for slot in range(personas - 1):
                guests.append({
                    "codigo": f"{cod}-M{slot+1}",
                    "nombre": f"Miembro de {primary_name} #{slot+1}",
                    "grupo": grupo,
                    "cupos": 0,
                    "es_acompanante": True,
                    "acompanante_de": primary_name,
                    "estado": "Pendiente",
                    "restricciones": None,
                    "confirmado_en": None,
                })

        # ── Fallback ──
        else:
            guests.append({
                "codigo": cod,
                "nombre": nombre,
                "grupo": grupo,
                "cupos": personas,
                "es_acompanante": False,
                "acompanante_de": None,
                "estado": "Pendiente",
                "restricciones": None,
                "confirmado_en": None,
            })

    # ── Save JSON ──
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(guests, f, indent=4, ensure_ascii=False)

    # ── Summary ──
    unique_codes = len(set(g["codigo"].split("-")[0] for g in guests))
    print(f"✅ Procesado correctamente!")
    print(f"   Códigos de invitación: {unique_codes}")
    print(f"   Total registros individuales: {len(guests)}")
    print(f"   Total PERSONAS del Excel: {total_personas}")

    if len(guests) == total_personas:
        print(f"   ✔️  MATCH PERFECTO: {len(guests)} registros == {total_personas} personas")
    else:
        print(f"   ⚠️  MISMATCH: {len(guests)} registros vs {total_personas} personas")
        print(f"   Diferencia: {len(guests) - total_personas}")

    from collections import Counter
    groups = Counter(g["grupo"] for g in guests)
    print(f"\n   Por grupo:")
    for grp, count in sorted(groups.items()):
        print(f"      {grp}: {count}")

    return guests


if __name__ == "__main__":
    xlsx = sys.argv[1] if len(sys.argv) > 1 else "invitadosbodaprimo2.xlsx"
    process_excel(xlsx)

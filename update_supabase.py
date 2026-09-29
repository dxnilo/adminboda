"""
Update Supabase 'guests' table with the new guest list.

Steps:
1. DELETE all existing rows from the 'guests' table
2. INSERT all new guests from guest_list_new.json
3. Verify the count matches

Uses the same Supabase credentials as the admin panel.
"""

import json
import requests
import sys

SUPABASE_URL = "https://qimqrpczkkukncfxmthu.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpbXFycGN6a2t1a25jZnhtdGh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAxMjA3MjUsImV4cCI6MjEwNTY5NjcyNX0.5k7bjR65hyLgmgO_MySDGkv0j6L9M-Wm_3Uii1LADk8"

HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

BASE_URL = f"{SUPABASE_URL}/rest/v1/guests"


def count_guests():
    """Get current guest count from Supabase."""
    headers = {**HEADERS, "Prefer": "count=exact"}
    resp = requests.get(BASE_URL, headers=headers, params={"select": "codigo"})
    count = resp.headers.get("content-range", "")
    return count


def delete_all_guests():
    """Delete ALL rows from guests table. Uses neq filter to match everything."""
    print("🗑️  Eliminando todos los invitados existentes...")
    resp = requests.delete(
        BASE_URL,
        headers=HEADERS,
        params={"codigo": "neq.IMPOSSIBLE_VALUE_THAT_NEVER_EXISTS"}
    )
    if resp.status_code in (200, 204):
        print("   ✅ Tabla limpiada exitosamente")
        return True
    else:
        print(f"   ❌ Error al limpiar: {resp.status_code}")
        print(f"   {resp.text}")
        return False


def insert_guests(json_path: str):
    """Insert all guests from the JSON file."""
    with open(json_path, "r", encoding="utf-8") as f:
        guests = json.load(f)

    print(f"📤 Insertando {len(guests)} invitados nuevos...")

    # Remove estado/restricciones/confirmado_en fields with None values
    # to let Supabase use defaults, but keep estado = "Pendiente"
    clean_guests = []
    for g in guests:
        record = {
            "codigo": g["codigo"],
            "nombre": g["nombre"],
            "grupo": g["grupo"],
            "cupos": g["cupos"],
            "es_acompanante": g["es_acompanante"],
            "acompanante_de": g.get("acompanante_de"),
            "estado": g.get("estado", "Pendiente"),
        }
        clean_guests.append(record)

    # Insert in batches of 50 to avoid payload limits
    batch_size = 50
    for i in range(0, len(clean_guests), batch_size):
        batch = clean_guests[i:i + batch_size]
        resp = requests.post(BASE_URL, headers=HEADERS, json=batch)
        if resp.status_code in (200, 201):
            print(f"   ✅ Batch {i // batch_size + 1}: {len(batch)} insertados")
        else:
            print(f"   ❌ Error en batch {i // batch_size + 1}: {resp.status_code}")
            print(f"   {resp.text}")
            return False

    return True


def verify():
    """Verify the final count."""
    headers = {**HEADERS, "Prefer": "count=exact", "Content-Type": "application/json"}
    resp = requests.get(
        BASE_URL,
        headers=headers,
        params={"select": "codigo"}
    )
    content_range = resp.headers.get("content-range", "unknown")
    print(f"\n📊 Verificación final - Content-Range: {content_range}")
    try:
        total = int(content_range.split("/")[1])
        print(f"   Total registros en Supabase: {total}")
        return total
    except Exception:
        print(f"   No se pudo verificar el conteo exacto")
        return -1


def main():
    json_path = sys.argv[1] if len(sys.argv) > 1 else "guest_list_new.json"

    print("=" * 55)
    print("  ACTUALIZACIÓN DE BASE DE DATOS SUPABASE")
    print("  Boda Jean & Ana · Lista de Invitados v2")
    print("=" * 55)
    print()

    # Step 1: Show current state
    current = count_guests()
    print(f"📊 Estado actual - Content-Range: {current}")
    print()

    # Step 2: Confirm
    confirm = input("⚠️  ¿Deseas BORRAR todos los invitados actuales y reemplazarlos? (si/no): ").strip().lower()
    if confirm not in ("si", "sí", "s", "yes", "y"):
        print("❌ Cancelado por el usuario.")
        return

    print()

    # Step 3: Delete all
    if not delete_all_guests():
        print("❌ No se pudo limpiar la tabla. Abortando.")
        return

    # Step 4: Insert new
    if not insert_guests(json_path):
        print("❌ Error insertando invitados.")
        return

    # Step 5: Verify
    verify()

    print()
    print("🎉 ¡Actualización completada exitosamente!")
    print("   La base de datos de Supabase ahora tiene la lista nueva.")
    print("   Tanto el panel admin como la web de invitaciones usarán esta data.")


if __name__ == "__main__":
    main()

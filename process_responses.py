import pandas as pd
import os

def procesar_respuestas(archivo_entrada='respuestas_formulario.csv'):
    if not os.path.exists(archivo_entrada):
        print(f"Error: No se encuentra el archivo '{archivo_entrada}'.")
        print("Asegúrate de haberlo descargado desde el panel de administración.")
        return

    try:
        df = pd.read_csv(archivo_entrada, quotechar='"', encoding='utf-8')
    except UnicodeDecodeError:
        df = pd.read_csv(archivo_entrada, quotechar='"', encoding='latin-1')

    df.fillna('-', inplace=True)
    
    print("\n--- RESUMEN DE RESPUESTAS ---")
    print(df.head())

    nombre_salida = 'gestion_final_nuevo_formulario.xlsx'
    
    try:
        with pd.ExcelWriter(nombre_salida, engine='openpyxl') as writer:
            # Let's sort it by Instrumento si existe
            if 'Instrumento' in df.columns and 'Nombre' in df.columns:
                df = df.sort_values(by=['Instrumento', 'Nombre'])

            df.to_excel(writer, index=False, sheet_name='Respuestas')
            
            worksheet = writer.sheets['Respuestas']
            for idx, col in enumerate(df.columns):
                max_len = max(
                    df[col].astype(str).map(len).max(),
                    len(str(col))
                ) + 2
                worksheet.column_dimensions[chr(65 + idx)].width = max_len

        print(f"\n[ÉXITO] Se ha generado el archivo Excel: '{nombre_salida}'")
    except ImportError:
        print("\n[ERROR] Para exportar a Excel necesitas instalar 'openpyxl'.")
    except Exception as e:
        print(f"\n[ERROR] No se pudo generar el Excel: {e}")

if __name__ == "__main__":
    procesar_respuestas()

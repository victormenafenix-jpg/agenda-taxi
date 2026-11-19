# Cómo regenerar el sitio
cd sitio && python3 ../herramientas-sitio/gen.py && python3 ../herramientas-sitio/en.py .
(gen.py hace las páginas en español; en.py agrega hreflang y crea /en/)

```python
import uuid

# El string desde el cual se generará el UUID
input_string = "salvador.joseluis+tinyflux@gmail.com"

# Espacio de nombres: en este caso, se utiliza el espacio de nombres DNS por defecto
namespace = uuid.NAMESPACE_DNS

# Generación del UUID usando el algoritmo UUID v5
generated_uuid = uuid.uuid5(namespace, input_string)

print(f"UUID generado: {generated_uuid}")
```

```
12c2801b-5b88-529c-92bc-3b7a0e3e1ead
```

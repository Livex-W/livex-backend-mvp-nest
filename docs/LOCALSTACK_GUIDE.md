# Guía de LocalStack (Desarrollo Local)

LocalStack se utiliza en este proyecto para emular el servicio de **Amazon SQS** localmente sin necesidad de conexión a internet o costos de nube.

## 1. ¿Cómo funciona?
LocalStack corre como un contenedor dentro de Docker (`livex_localstack`) y expone un endpoint central en el puerto **4566**.

- **SQS**: Emula colas, mensajes y Dead Letter Queues (DLQ).

## 2. Inicialización Automática
Al arrancar el contenedor, se ejecutan los scripts ubicados en `./scripts/localstack/`.
El script `init-sqs.sh` crea automáticamente todas las colas de SQS necesarias:
- `livex-notifications-*` (high, medium, low, dlq)
- `livex-webhooks-payments` (+ dlq)
- `livex-reconciliation` (+ dlq)

## 3. Configuración en .env
Para que el sistema use LocalStack en lugar de AWS real para las colas, la configuración debe ser:
```env
SQS_ENDPOINT=http://localstack:4566
# Las URLs deben apuntar al formato de LocalStack
SQS_WEBHOOKS_URL=http://localstack:4566/000000000000/livex-webhooks-payments
```
*Nota: `000000000000` es el account ID por defecto de LocalStack.*

## 4. Comandos Útiles
Si tienes el AWS CLI instalado, puedes listar las colas locales para verificar:
```bash
# Listar colas
aws --endpoint-url=http://localhost:4566 sqs list-queues

# Ver mensajes en una cola
aws --endpoint-url=http://localhost:4566 sqs receive-message --queue-url http://localhost:4566/000000000000/livex-webhooks-payments
```

## 5. Ventajas
- **Costo Cero**: No hay cargos por peticiones SQS en dev.
- **Velocidad**: Las colas responden instantáneamente.
- **Aislamiento**: Lo que hagas en local no afecta a producción.

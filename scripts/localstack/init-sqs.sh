#!/bin/bash
echo "Initializing local SQS queues..."

# List of queues to create
queues=(
  "livex-notifications-high"
  "livex-notifications-medium"
  "livex-notifications-low"
  "livex-notifications-dlq"
  "livex-webhooks-payments"
  "livex-webhooks-payments-dlq"
  "livex-reconciliation"
  "livex-reconciliation-dlq"
)

for queue in "${queues[@]}"; do
  awslocal sqs create-queue --queue-name "$queue"
  echo "Created queue: $queue"
done

echo "Local SQS initialization complete."

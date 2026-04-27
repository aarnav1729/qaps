`workflow-smoke-test.mjs` supports two modes:

- `ALLOW_DESTRUCTIVE_QAP_RESET=true node scripts/workflow-smoke-test.mjs --allow-destructive-reset --reset-only`
  Clears transactional data and uploaded request/QAP files while preserving users plus BOM/MQP/Visual masters.
- `ALLOW_DESTRUCTIVE_QAP_RESET=true node scripts/workflow-smoke-test.mjs --allow-destructive-reset`
  Resets data, runs both approval workflow branches (`P4` with Level 3 and `P2` skipping Level 3), then runs a requestor edit-reset scenario that reopens Level 2 after QAP and BOM edits, validates the transitions, and clears the smoke-test data again.

The script is now hard-blocked unless one of those explicit destructive-reset opt-ins is provided, so normal app restarts and regular development commands cannot trigger data wipes.

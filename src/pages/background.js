import { refreshActionBehavior, refreshAlarms } from "./common";

async function init() {
  await Promise.all([
    refreshAlarms(),
    refreshActionBehavior(),
  ])
}

init();

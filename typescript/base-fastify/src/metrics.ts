import promClientModule from "prom-client"

export type PromClient = typeof promClientModule
export const promClient = promClientModule

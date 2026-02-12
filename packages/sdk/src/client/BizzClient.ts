import type { Computer } from '@bitcoin-computer/lib'

export interface BizzClientConfig {
  computer: typeof Computer.prototype
  modules?: {
    quiz?: string
    payment?: string
    attempt?: string
    access?: string
    redemption?: string
    proof?: string
    swap?: string
  }
}

export class BizzClient {
  public computer: typeof Computer.prototype
  public modules?: BizzClientConfig['modules']

  constructor(config: BizzClientConfig) {
    this.computer = config.computer
    this.modules = config.modules
  }
}

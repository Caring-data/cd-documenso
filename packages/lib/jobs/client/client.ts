import type { JobDefinition, TriggerJobOptions } from './_internal/job';
import type { BaseJobProvider as JobClientProvider } from './base';
import { LocalJobProvider } from './local';

export class JobClient<T extends ReadonlyArray<JobDefinition> = []> {
  private _provider: JobClientProvider;

  public constructor(definitions: T) {
    this._provider = LocalJobProvider.getInstance();

    definitions.forEach((definition) => {
      this._provider.defineJob(definition);
    });
  }

  public async triggerJob(options: TriggerJobOptions<T>) {
    return this._provider.triggerJob(options);
  }

  public getApiHandler() {
    return this._provider.getApiHandler();
  }
}

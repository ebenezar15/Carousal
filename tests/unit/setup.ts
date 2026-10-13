import 'fake-indexeddb/auto';

// jsdom has no canvas; text measurement falls back to a deterministic estimate when getContext is null.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];

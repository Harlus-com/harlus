export interface EventSourceClient {
  addEventListener(eventName: string, callback: (data: any) => void): void;
  close(): void;
}

export class WebEventSourceClient implements EventSourceClient {
  private readonly eventSource: EventSource;

  constructor(url: string) {
    this.eventSource = new EventSource(url);
    this.eventSource.onerror = (event) => {
      console.error("Event source error", event);
    };
    this.eventSource.onmessage = (event) => {
      console.log("Event source message", event);
    };
  }

  addEventListener(eventName: string, callback: (data: any) => void): void {
    this.eventSource.addEventListener(eventName, callback);
  }

  close(): void {
    this.eventSource.close();
  }
}

export class ElectronEventSourceClient implements EventSourceClient {
  private readonly eventSourceId: string;
  private readonly electron: ElectronAPI;

  constructor(eventSourceId: string, electron: ElectronAPI) {
    this.eventSourceId = eventSourceId;
    this.electron = electron;
  }

  addEventListener(eventName: string, callback: (data: any) => void): void {
    const channel = eventForwarder.getOrCreateChannel(this.eventSourceId);
    this.electron.addEventListener(this.eventSourceId, eventName);
    channel.addEventListener(eventName, callback);
  }

  close(): void {
    this.electron.closeEventSource(this.eventSourceId);
  }
}

class Channel {
  private readonly eventSourceId: string;
  private readonly callbacks: Map<string, (data: any) => void> = new Map();

  constructor(eventSourceId: string) {
    this.eventSourceId = eventSourceId;
  }

  addEventListener(eventName: string, callback: (data: any) => void): void {
    this.callbacks.set(eventName, callback);
  }

  clear(): void {
    this.callbacks.clear();
  }

  dispatchEvent(event: any): void {
    const callback = this.callbacks.get(event.type);
    if (callback) {
      callback(event);
    }
  }
}

class EventForwarder {
  private readonly channels: Map<string, Channel> = new Map();

  removeChannel(eventSourceId: string): void {
    if (this.channels.has(eventSourceId)) {
      this.channels.get(eventSourceId)?.clear();
      this.channels.delete(eventSourceId);
    }
  }

  forward(event: any): void {
    const channel = this.channels.get(event.eventSourceId);
    if (channel) {
      channel.dispatchEvent(event);
    }
  }

  getOrCreateChannel(eventSourceId: string): Channel {
    if (!this.channels.has(eventSourceId)) {
      this.addChannel(eventSourceId);
    }
    return this.channels.get(eventSourceId)!;
  }

  private addChannel(eventSourceId: string): void {
    this.channels.set(eventSourceId, new Channel(eventSourceId));
  }
}

export const eventForwarder = new EventForwarder();

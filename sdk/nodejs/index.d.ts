interface LogHiveOptions {
  apiKey: string;
  endpoint: string;
}

interface LogOptions {
  tags?: string[];
  metadata?: Record<string, any>;
  timestamp?: string;
}

interface SendResponse {
  status: string;
}

interface BatchResponse {
  count: number;
  status: string;
}

declare class LogHive {
  constructor(options: LogHiveOptions);

  send(level: string, message: string, options?: LogOptions): Promise<SendResponse>;
  debug(message: string, options?: LogOptions): Promise<SendResponse>;
  info(message: string, options?: LogOptions): Promise<SendResponse>;
  warn(message: string, options?: LogOptions): Promise<SendResponse>;
  error(message: string, options?: LogOptions): Promise<SendResponse>;
  fatal(message: string, options?: LogOptions): Promise<SendResponse>;

  queue(level: string, message: string, options?: LogOptions): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export = LogHive;

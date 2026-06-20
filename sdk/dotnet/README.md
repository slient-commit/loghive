# LogHive .NET SDK

.NET Standard 2.0 SDK for LogHive log ingestion. Works on .NET Core, .NET 5+, .NET Framework 4.6.1+, and Mono.

## Installation

```bash
dotnet add package LogHive.SDK
```

Or install from local path:

```bash
dotnet add reference path/to/LogHive/LogHive.csproj
```

## Quick Start

```csharp
using LogHive;

var logger = new LogHiveClient("your-api-key", "https://your-loghive-instance.com");

await logger.InfoAsync("User signed in", tags: new List<string> { "auth" }, metadata: new Dictionary<string, object>
{
    { "userId", 123 },
    { "method", "email" },
});
```

## API

### Constructor

```csharp
// Simple
var logger = new LogHiveClient(apiKey, endpoint);

// With options
var logger = new LogHiveClient(new LogHiveOptions
{
    ApiKey = "your-api-key",
    Endpoint = "https://your-loghive-instance.com",
    BatchSize = 50,
    FlushInterval = TimeSpan.FromSeconds(5),
});
```

### Send Immediately

```csharp
await logger.SendAsync(LogLevel.INFO, "message", tags, metadata);
await logger.DebugAsync("message", tags, metadata);
await logger.InfoAsync("message", tags, metadata);
await logger.WarnAsync("message", tags, metadata);
await logger.ErrorAsync("message", tags, metadata);
await logger.FatalAsync("message", tags, metadata);
```

### Batch Queue

Queue logs locally and send in batches. Auto-flushes every 5 seconds or at 50 logs.

```csharp
logger.Queue(LogLevel.INFO, "Background task started");
logger.Queue(LogLevel.ERROR, "Task failed",
    tags: new List<string> { "worker" },
    metadata: new Dictionary<string, object> { { "taskId", "abc" } });

// Manually flush
await logger.FlushAsync();

// Flush before app exits
await logger.ShutdownAsync();
```

### Dispose

Implements `IDisposable` — flushes remaining logs on dispose.

```csharp
using var logger = new LogHiveClient("api-key", "https://loghive.example.com");
await logger.InfoAsync("Auto-disposed on exit");
```

## Examples

### ASP.NET Core Middleware

```csharp
public class LogHiveMiddleware
{
    private readonly RequestDelegate _next;
    private readonly LogHiveClient _logger;

    public LogHiveMiddleware(RequestDelegate next, LogHiveClient logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        await _next(context);
        sw.Stop();

        _logger.Queue(LogLevel.INFO, $"{context.Request.Method} {context.Request.Path}",
            tags: new List<string> { "http" },
            metadata: new Dictionary<string, object>
            {
                { "status", context.Response.StatusCode },
                { "duration_ms", sw.ElapsedMilliseconds },
                { "ip", context.Connection.RemoteIpAddress?.ToString() },
            });
    }
}

// In Program.cs or Startup.cs
builder.Services.AddSingleton(new LogHiveClient("api-key", "https://loghive.example.com"));
app.UseMiddleware<LogHiveMiddleware>();

// Flush on shutdown
var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
lifetime.ApplicationStopping.Register(() =>
{
    app.Services.GetRequiredService<LogHiveClient>().ShutdownAsync().GetAwaiter().GetResult();
});
```

### Error Tracking

```csharp
try
{
    await RiskyOperationAsync();
}
catch (Exception ex)
{
    await logger.ErrorAsync(ex.Message,
        tags: new List<string> { "exception" },
        metadata: new Dictionary<string, object>
        {
            { "type", ex.GetType().Name },
            { "stackTrace", ex.StackTrace },
        });
}
```

### Worker Service

```csharp
public class MyWorker : BackgroundService
{
    private readonly LogHiveClient _logger;

    public MyWorker(LogHiveClient logger) => _logger = logger;

    protected override async Task ExecuteAsync(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            _logger.Queue(LogLevel.DEBUG, "Worker heartbeat");
            await Task.Delay(60000, token);
        }

        await _logger.ShutdownAsync();
    }
}
```

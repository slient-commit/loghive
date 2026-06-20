using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;

namespace LogHive
{
    public enum LogLevel
    {
        DEBUG,
        INFO,
        WARN,
        ERROR,
        FATAL
    }

    public class LogEntry
    {
        [JsonPropertyName("level")]
        public string Level { get; set; }

        [JsonPropertyName("message")]
        public string Message { get; set; }

        [JsonPropertyName("tags")]
        public List<string> Tags { get; set; } = new List<string>();

        [JsonPropertyName("metadata")]
        public Dictionary<string, object> Metadata { get; set; } = new Dictionary<string, object>();

        [JsonPropertyName("timestamp")]
        public string Timestamp { get; set; }
    }

    public class LogHiveOptions
    {
        public string ApiKey { get; set; }
        public string Endpoint { get; set; }
        public int BatchSize { get; set; } = 50;
        public TimeSpan FlushInterval { get; set; } = TimeSpan.FromSeconds(5);
    }

    public class LogHiveClient : IDisposable
    {
        private readonly HttpClient _http;
        private readonly string _endpoint;
        private readonly ConcurrentQueue<LogEntry> _queue = new ConcurrentQueue<LogEntry>();
        private readonly int _batchSize;
        private Timer _timer;
        private int _flushing;

        public LogHiveClient(LogHiveOptions options)
        {
            if (string.IsNullOrEmpty(options.ApiKey))
                throw new ArgumentException("ApiKey is required");
            if (string.IsNullOrEmpty(options.Endpoint))
                throw new ArgumentException("Endpoint is required");

            _endpoint = options.Endpoint.TrimEnd('/');
            _batchSize = options.BatchSize;

            _http = new HttpClient();
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", options.ApiKey);
            _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            _timer = new Timer(_ => _ = FlushAsync(), null, options.FlushInterval, options.FlushInterval);
        }

        public LogHiveClient(string apiKey, string endpoint) : this(new LogHiveOptions { ApiKey = apiKey, Endpoint = endpoint })
        {
        }

        private async Task<string> PostAsync(string path, object body)
        {
            var json = JsonSerializer.Serialize(body);
            var content = new StringContent(json, Encoding.UTF8, "application/json");
            var response = await _http.PostAsync($"{_endpoint}{path}", content).ConfigureAwait(false);
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync().ConfigureAwait(false);
        }

        /// <summary>Send a log immediately.</summary>
        public Task SendAsync(LogLevel level, string message, List<string> tags = null, Dictionary<string, object> metadata = null, string timestamp = null)
        {
            var entry = new LogEntry
            {
                Level = level.ToString(),
                Message = message,
                Tags = tags ?? new List<string>(),
                Metadata = metadata ?? new Dictionary<string, object>(),
                Timestamp = timestamp ?? DateTimeOffset.UtcNow.ToString("o"),
            };
            return PostAsync("/api/ingest", entry);
        }

        public Task DebugAsync(string message, List<string> tags = null, Dictionary<string, object> metadata = null)
            => SendAsync(LogLevel.DEBUG, message, tags, metadata);

        public Task InfoAsync(string message, List<string> tags = null, Dictionary<string, object> metadata = null)
            => SendAsync(LogLevel.INFO, message, tags, metadata);

        public Task WarnAsync(string message, List<string> tags = null, Dictionary<string, object> metadata = null)
            => SendAsync(LogLevel.WARN, message, tags, metadata);

        public Task ErrorAsync(string message, List<string> tags = null, Dictionary<string, object> metadata = null)
            => SendAsync(LogLevel.ERROR, message, tags, metadata);

        public Task FatalAsync(string message, List<string> tags = null, Dictionary<string, object> metadata = null)
            => SendAsync(LogLevel.FATAL, message, tags, metadata);

        /// <summary>Queue a log for batch sending.</summary>
        public void Queue(LogLevel level, string message, List<string> tags = null, Dictionary<string, object> metadata = null)
        {
            _queue.Enqueue(new LogEntry
            {
                Level = level.ToString(),
                Message = message,
                Tags = tags ?? new List<string>(),
                Metadata = metadata ?? new Dictionary<string, object>(),
                Timestamp = DateTimeOffset.UtcNow.ToString("o"),
            });

            if (_queue.Count >= _batchSize)
                _ = FlushAsync();
        }

        /// <summary>Flush all queued logs.</summary>
        public async Task FlushAsync()
        {
            if (Interlocked.CompareExchange(ref _flushing, 1, 0) != 0)
                return;

            try
            {
                while (!_queue.IsEmpty)
                {
                    var batch = new List<LogEntry>();
                    while (batch.Count < 1000 && _queue.TryDequeue(out var entry))
                        batch.Add(entry);

                    if (batch.Count > 0)
                        await PostAsync("/api/ingest/batch", new { logs = batch }).ConfigureAwait(false);
                }
            }
            finally
            {
                Interlocked.Exchange(ref _flushing, 0);
            }
        }

        /// <summary>Flush remaining logs and release resources.</summary>
        public async Task ShutdownAsync()
        {
            _timer?.Dispose();
            _timer = null;
            await FlushAsync().ConfigureAwait(false);
        }

        public void Dispose()
        {
            _timer?.Dispose();
            _timer = null;
            try { FlushAsync().GetAwaiter().GetResult(); } catch { }
            _http?.Dispose();
        }
    }
}

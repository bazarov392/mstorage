# MStorage formatter benchmark

Run from the repository root after installing the project's Playwright browsers:

```bash
bun run bench:mstorage
```

For Node-only measurements:

```bash
bun run build
node benchmarks/m-storage/run.mjs --node-only
```

Results are written to `benchmarks/m-storage/results.json`, including runtime
versions, every sample, medians, minimum/maximum, and operation counts. The full
run covers Node memory storage and Chromium, Firefox, and WebKit with memory,
native localStorage and native sessionStorage. A failed browser exits with an
error while retaining completed runtime measurements; missing browsers are not
silently counted as successful.

## Method

Both standard formatters use their actual production validation and identical
inputs. `encode` and `decode` are measured separately, as are the complete MStorage
`set`, `get`, and `ttl` paths. Native backends run on an isolated intercepted test
origin; the benchmark removes only its own key.

Inputs contain 0, 16, 1,024, 10,240 and 102,400 UTF-16 code units, with ASCII,
Unicode, or JSON-escaped characters, both without expiration and with expiration.
The last three sizes are often called 1/10/100 KB workloads, but the unit here is
explicitly **UTF-16 code units, not bytes**. `storedCodeUnits` is the encoded
string's `.length`; it does not claim exact browser quota usage or allocated memory.

Two warmup series precede seven measured series. Candidate order alternates.
Each sample runs in batches for at least 10 ms to reduce the effect of coarse
browser timer resolution; samples report microseconds per operation. Return values
contribute to an observable checksum. The fixed operation order and repeated hot
key model are part of the workload, not a simulation of all application usage.

`encode` consumes the output's length; `decode` and `get` consume the string's
length. Engines may retain concatenated/sliced strings lazily. These microbenchmarks
therefore do not measure full materialization, rendering, scanning every character,
or long-lived heap retention. Native storage measurements include more of the real
storage path. Clock, callback, checksum and loop overhead are included for both
candidates, so tiny differences should not be interpreted as precise speedups.

## Choosing a format

JSON remains the default for compatibility and inspectability. Encoding avoids
JSON escaping and parsing of the value tail, which can help larger or heavily
escaped strings, but browser/backend costs can dominate. Expiring Encoding records
also parse a decimal header. Choose based on your payloads and complete application
path, not an isolated encode result. Neither format encrypts data.

Measurements are informational, not an API performance promise. No timing threshold
is used in CI. See [the API guide](../../examples/m-storage/README.md) and
[explicit migration](../../examples/m-storage/migration.md) before changing formats.

## Recorded run

Measured at 2026-09-11T22:10:18.558Z on Ubuntu 24.04 (WSL), with node v24.18.1, chromium 153.0.8010.12, firefox 155.0, webkit 26.6.

The table shows `get` for ASCII without expiration, in microseconds per operation (median; minimum–maximum). All scenarios and seven samples per scenario are in [results.json](results.json).

| Runtime  | Backend | Value length (UTF-16) | JSON                  | Encoding           |
| -------- | ------- | --------------------- | --------------------- | ------------------ |
| node     | memory  | 16                    | 0.183; 0.177–0.199    | 0.084; 0.080–0.091 |
| node     | memory  | 102,400               | 28.993; 28.103–36.918 | 0.092; 0.085–0.109 |
| chromium | local   | 16                    | 0.234; 0.220–0.252    | 0.156; 0.152–0.167 |
| chromium | local   | 102,400               | 23.409; 21.458–25.000 | 1.786; 1.568–1.984 |
| chromium | session | 16                    | 0.227; 0.220–0.245    | 0.168; 0.158–0.176 |
| chromium | session | 102,400               | 22.292; 20.769–26.250 | 1.724; 1.553–2.101 |
| firefox  | local   | 16                    | 0.333; 0.312–0.357    | 0.167; 0.167–0.172 |
| firefox  | local   | 102,400               | 22.727; 20.833–27.778 | 0.182; 0.176–0.213 |
| firefox  | session | 16                    | 0.333; 0.294–0.333    | 0.156; 0.152–0.172 |
| firefox  | session | 102,400               | 25.000; 22.727–27.778 | 0.175; 0.154–0.187 |
| webkit   | local   | 16                    | 0.227; 0.208–0.250    | 0.156; 0.147–0.185 |
| webkit   | local   | 102,400               | 31.250; 27.778–31.250 | 0.168; 0.159–0.181 |
| webkit   | session | 16                    | 0.227; 0.217–0.263    | 0.161; 0.147–0.192 |
| webkit   | session | 102,400               | 31.250; 27.778–35.714 | 0.169; 0.159–0.184 |

These are hot-key measurements on one machine. Read the min/max spread as well as the median; a narrow advantage on short strings is not a universal speedup. JSON remains the default.

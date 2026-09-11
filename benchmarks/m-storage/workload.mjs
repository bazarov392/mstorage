class MemoryStorage
{
    items = new Map();
    get length()
    {
        return this.items.size;
    }
    key(i)
    {
        return [...this.items.keys()][i] ?? null;
    }
    getItem(k)
    {
        return this.items.get(k) ?? null;
    }
    setItem(k, v)
    {
        this.items.set(k, v);
    }
    removeItem(k)
    {
        this.items.delete(k);
    }
    clear()
    {
        this.items.clear();
    }
}

export function run(api, native = {})
{
    const rows = [];
    let checksum = 0;
    const backends = { memory: new MemoryStorage(), ...native };
    const candidates = [api.JsonValueFormatter, api.EncodingValueFormatter];
    for (const size of [0, 16, 1024, 10240, 102400])
    {
        for (
            const [kind, seed] of Object.entries({
                ascii: 'abcdefgh',
                unicode: 'Привет🌍',
                escaped: '"\\\n\t',
            })
        )
        {
            const value = seed.repeat(Math.ceil(size / seed.length)).slice(
                0,
                size,
            );
            for (const expiring of [false, true])
            {
                const record = {
                    value,
                    expiresAt: expiring ? 8000000000000.5 : null,
                };
                const iterations = Math.max(
                    40,
                    Math.min(2000, Math.floor(2_000_000 / Math.max(1, size))),
                );
                const jobs = candidates.map((Formatter) =>
                {
                    const formatter = new Formatter();
                    const raw = formatter.encode(record);
                    const jobs = [
                        {
                            operation: 'encode',
                            backend: 'none',
                            invoke: () => formatter.encode(record).length,
                        },
                        {
                            operation: 'decode',
                            backend: 'none',
                            invoke: () => formatter.decode(raw).value.length,
                        },
                    ];
                    for (const [backend, storage] of Object.entries(backends))
                    {
                        const subject = new api.MStorage({
                            storage,
                            formatter,
                            prefix: 'bench:',
                        });
                        subject.set('k', value, expiring ? 3600 : 0);
                        jobs.push(
                            {
                                operation: 'set',
                                backend,
                                invoke: () =>
                                {
                                    subject.set(
                                        'k',
                                        value,
                                        expiring ? 3600 : 0,
                                    );
                                    return 1;
                                },
                            },
                            {
                                operation: 'get',
                                backend,
                                invoke: () => subject.get('k').length,
                            },
                            {
                                operation: 'ttl',
                                backend,
                                invoke: () =>
                                    Number.isFinite(subject.ttl('k')) ? 1 : 0,
                            },
                        );
                    }
                    return jobs.map((job) => ({
                        ...job,
                        formatter: Formatter.name,
                        storedCodeUnits: raw.length,
                        samples: [],
                        counts: [],
                    }));
                });
                // Each candidate has its own raw value and must seed shared backends before reading.
                for (let series = -2; series < 7; series++)
                {
                    const order = series % 2 === 0 ? [0, 1] : [1, 0];
                    for (const candidate of order)
                    {
                        const formatter = new candidates[candidate]();
                        for (const storage of Object.values(backends))
                            new api.MStorage({
                                storage,
                                formatter,
                                prefix: 'bench:',
                            }).set('k', value, expiring ? 3600 : 0);
                        for (const job of jobs[candidate])
                        {
                            const start = performance.now();
                            let count = 0;
                            let elapsed;
                            do
                            {
                                for (let i = 0; i < iterations; i++)
                                    checksum = (checksum + job.invoke())
                                        % 1_000_000_007;
                                count += iterations;
                                elapsed = performance.now() - start;
                            }
                            while (elapsed < 10);
                            if(series >= 0)
                            {
                                job.samples.push(elapsed * 1000 / count);
                                job.counts.push(count);
                            }
                        }
                    }
                }
                for (const job of jobs.flat())
                {
                    const sorted = [...job.samples].sort((a, b) => a - b);
                    rows.push({
                        size,
                        kind,
                        expiring,
                        formatter: job.formatter,
                        backend: job.backend,
                        operation: job.operation,
                        storedCodeUnits: job.storedCodeUnits,
                        batchIterations: iterations,
                        samplesIterations: job.counts,
                        medianUs: sorted[3],
                        minUs: sorted[0],
                        maxUs: sorted[6],
                        samplesUs: job.samples,
                    });
                }
            }
        }
    }
    for (const storage of Object.values(backends))
        storage.removeItem('bench:k');
    return { checksum, rows };
}

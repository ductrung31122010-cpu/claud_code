import express from 'express';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    // API for code execution
    app.post('/api/execute', async (req, res) => {
        const { code, language, testCases } = req.body;

        if (!code || !language || !testCases) {
            return res.status(400).json({ error: 'Missing code, language, or testCases' });
        }

        const results = [];

        try {
            let judge0LangId = 0;

            if (language === 'python' || language === 'python3') {
                judge0LangId = 100; // Python 3.12.5
            } else if (language === 'cpp' || language === 'c++') {
                judge0LangId = 105; // C++ 14.1.0
            } else {
                return res.status(400).json({ error: 'Unsupported language' });
            }

            for (let i = 0; i < testCases.length; i++) {
                const tc = testCases[i];
                
                const response = await fetch('https://ce.judge0.com/submissions?base64_encoded=true&wait=true', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        language_id: judge0LangId,
                        source_code: Buffer.from(code).toString('base64'),
                        stdin: Buffer.from(tc.input || "").toString('base64'),
                        cpu_time_limit: 3.0,
                        memory_limit: 128000
                    })
                });

                if (!response.ok) {
                    const text = await response.text();
                    throw new Error(`Judge0 API error: ${response.status} ${response.statusText} - ${text}`);
                }

                const data = await response.json();

                if (data.status.id === 6) { // Compilation Error
                    results.push({
                        status: 'Compile Error',
                        actual: '',
                        expected: tc.output,
                        error: data.compile_output ? Buffer.from(data.compile_output, 'base64').toString('utf8') : 'Compilation failed'
                    });
                    continue;
                }

                if (data.status.id === 5) { // Time Limit Exceeded
                    results.push({
                        status: 'TLE',
                        time: data.time || "3.000",
                        actual: data.stdout ? Buffer.from(data.stdout, 'base64').toString('utf8').trim() : "",
                        expected: tc.output.trim(),
                        error: 'Time Limit Exceeded'
                    });
                    continue;
                }
                
                if (data.status.id >= 7 && data.status.id <= 12) { // Runtime Error
                    results.push({
                        status: 'Runtime Error',
                        time: data.time || "0.000",
                        actual: data.stdout ? Buffer.from(data.stdout, 'base64').toString('utf8').trim() : "",
                        expected: tc.output.trim(),
                        error: data.stderr ? Buffer.from(data.stderr, 'base64').toString('utf8') : (data.message ? Buffer.from(data.message, 'base64').toString('utf8') : 'Runtime Error')
                    });
                    continue;
                }

                const actualOutput = data.stdout ? Buffer.from(data.stdout, 'base64').toString('utf8').trim() : "";
                const expectedOutput = tc.output.trim();
                const isCorrect = actualOutput === expectedOutput;

                results.push({
                    status: isCorrect ? 'AC' : 'WA',
                    time: data.time || "0.100", 
                    actual: actualOutput,
                    expected: expectedOutput,
                    stderr: data.stderr ? Buffer.from(data.stderr, 'base64').toString('utf8').trim() : ""
                });
            }

            res.json({ results });
        } catch (err) {
            console.error('Execution error: ', err);
            res.status(500).json({ error: 'Internal server error during execution: ' + (err.message || String(err)) });
        }
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();

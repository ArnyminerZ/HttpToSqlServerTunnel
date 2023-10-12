// @ts-ignore
import data from "./package.json";
import {ReadableStream} from 'stream/web';
import {ConnectionConfig, Connection, Request, ColumnValue} from "tedious";

/**
 * Converts the given stream into a string.
 * @param stream The stream to convert.
 */
async function streamToString(stream: ReadableStream): Promise<string> {
    const chunks: Array<any> = [];
    for await (let chunk of stream) {
        chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks);
    return buffer.toString("utf-8")
}

/**
 * Builds a response object from the given JSON and status code.
 * @param contents The JSON object to send in the response
 * @param status The http status code of the response.
 */
function response(contents: Object, status: number = 200) {
    return new Response(
        JSON.stringify(contents),
        { status }
    )
}

/**
 * Generates an error response from a message.
 * @param message The message to include in the error.
 * @param status The status code of the response.
 * Default: 400
 */
function error(message: string, status: number = 400) {
    return response({ successful: false, error: { message } }, status);
}

/**
 * Initializes the connection with the given configuration asynchronously.
 * @param config The connection configuration object.
 */
function connect(config: ConnectionConfig): Promise<Connection> {
    return new Promise((resolve, reject) => {
        const connection = new Connection(config);
        connection.on('connect', (err: any) => {
            if (err) return reject(err);

            resolve(connection);
        })
        connection.connect();
    });
}

/**
 * Performs a request with the given living connection.
 * @param connection The connection to use.
 * @param statement The SQL statement to run.
 */
function executeSql(connection: Connection, statement: string): Promise<ColumnValue[]> {
    return new Promise((resolve, reject) => {
        const rows: ColumnValue[] = [];
        const request = new Request(statement, (err) => {
            if (err) reject(err);
            else resolve(rows)
        });
        request.on('row', columns => {
            rows.push(...columns);
        });
        connection.execSql(request)
    });
}

const server = Bun.serve({
    port: 3000,
    async fetch(request) {
        const url = new URL(request.url);

        if (url.pathname === '/info') {
            return response({ version: data.version });
        } else if (
            url.pathname === '/query' &&
            request.method === 'POST'
        ) {
            if (!request.headers.has('Content-Type'))
                return error('missing-content-type-header');
            const contentType = request.headers.get('Content-Type');
            if (contentType != 'application/json')
                return error('only-json-body-supported');

            const rawBody: ReadableStream|null = request.body;
            if (rawBody == null)
                return error('empty-body');

            const body = await streamToString(rawBody);
            const jsonBody = JSON.parse(body);

            const server:string|null = jsonBody['server'];
            const port:number = jsonBody['port'] ?? 1433;
            const database:string|null = jsonBody['database'];
            const username:string|null = jsonBody['username'];
            const password:string|null = jsonBody['password'];
            const queries:string[]|null = jsonBody['queries'];

            if (server == null) return error('missing-server');
            if (database == null) return error('missing-database');
            if (username == null) return error('missing-username');
            if (password == null) return error('missing-password');
            if (queries == null) return error('missing-queries');

            try {
                const connectionConfig: ConnectionConfig = {
                    server,
                    options: {
                        port,
                        database,
                        encrypt: false
                    },
                    authentication: {
                        type: 'default',
                        options: {
                            userName: username,
                            password: password
                        }
                    }
                }
                const connection = await connect(connectionConfig);
                const results: ColumnValue[][] = [];
                for (const query of queries) {
                    console.debug(server, '::', query);
                    const rows = await executeSql(connection, query);
                    results.push(rows);
                }
                connection.close()

                return response({ successful: true, results });
            } catch (e) {
                console.error(e);
                return response({ successful: false, error: e }, 500);
            }
        }

        return error('not-found', 404);
    },
});

console.info(`Running server on http://localhost:${server.port}`);

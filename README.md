# HTTP to SQLServer Tunnel

A tunnel for making SQLServer requests through HTTP.

## Security considerations

With the aim of making this project as simple as possible, only http is supported. TLS should be implemented by an
external proxy.

# Development

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.0.5. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.

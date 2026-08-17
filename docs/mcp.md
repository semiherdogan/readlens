# MCP setup

PageNectar runs as a local stdio MCP server. For a published npm release, the launch command is:

```sh
npx -y pagenectar@latest mcp
```

For reproducible installations, replace `latest` with an exact version such as `0.1.0`.

## Codex

```sh
codex mcp add pagenectar -- npx -y pagenectar@latest mcp
```

Run `codex mcp list` to verify the configuration. The ChatGPT desktop app, Codex CLI, and Codex IDE extension share this MCP configuration. See the [official Codex MCP documentation](https://developers.openai.com/codex/mcp).

## Claude Code

```sh
claude mcp add pagenectar -- npx -y pagenectar@latest mcp
```

Run `/mcp` in Claude Code to verify that the server and its tools are available.

## OpenCode

OpenCode provides an interactive setup command:

```sh
opencode mcp add
```

Choose a local server, name it `pagenectar`, and use `npx -y pagenectar@latest mcp` as its command. Alternatively, add PageNectar directly to `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "pagenectar": {
      "type": "local",
      "command": ["npx", "-y", "pagenectar@latest", "mcp"],
      "enabled": true
    }
  }
}
```

Run `opencode mcp list` to check the connection. See the [official OpenCode MCP documentation](https://opencode.ai/docs/mcp-servers/).

## Claude Desktop and JSON-based clients

```json
{
  "mcpServers": {
    "pagenectar": {
      "command": "npx",
      "args": ["-y", "pagenectar@latest", "mcp"]
    }
  }
}
```

Restart the client after changing its configuration.

## Private GitHub repository

For temporary private-repository testing:

```json
{
  "mcpServers": {
    "pagenectar": {
      "command": "npx",
      "args": [
        "-y",
        "--package=git+ssh://git@github.com/semiherdogan/pagenectar.git",
        "pagenectar",
        "mcp"
      ]
    }
  }
}
```

This requires GitHub SSH authentication to be available to the MCP client process. A published npm package avoids that requirement and starts faster from the npm cache.

## Custom Lightpanda path

If Lightpanda is installed outside `PATH`, append `--lightpanda /custom/path/lightpanda` after `mcp` in the command or argument list.

Return to the [README](../README.md).

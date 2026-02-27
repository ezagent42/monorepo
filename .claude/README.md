# .claude/ — Claude Code Project Config

```
.claude/
├── skills/              ← Project-specific skills (.md files)
├── plugins/             ← Project-specific plugin configs
├── settings.json        ← Shared project settings (committed)
├── settings.local.json  ← Local session settings (gitignored)
└── README.md            ← This file
```

## Skills

Place `.md` skill files in `skills/`. These are available to all team members via the `Skill` tool.

## Plugins

Place plugin configuration in `plugins/`. The `cache/` subdirectory is gitignored (downloaded at runtime).

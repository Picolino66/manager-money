# Skill: atualizar a knowledge layer (healing localizado)

1. Consultar `docs/.ai/index.json` → localizar a feature pelo ID em `features.json`.
2. Abrir só o doc da feature e os arquivos de `code:`/`symbols:` dela.
3. Divergência doc × código: **o código vence**. Corrigir o corpo e o frontmatter do doc; atualizar `last_verified_commit`.
4. `npm run docs:index` (regenera os índices e os hashes por símbolo) → `npm run docs:check`.
5. Nunca editar `docs/.ai/*.json` manualmente.

# Provider Studio

Opt-in Linux-side launcher and entrypoint scaffold for future Provider Studio
integration.

This feature intentionally does not own provider behavior. Provider discovery,
configuration, presets, health checks, and model runtime behavior belong to
later Provider Studio work outside this Linux feature scaffold.

Enable it locally with:

```json
{
  "enabled": [
    "provider-studio"
  ]
}
```

Run the feature tests with:

```bash
node --test linux-features/provider-studio/test.js
```

Wave 1 does not add Settings UI patches, launcher behavior, runtime hooks,
packaging hooks, staged resources, or hashed/minified bundle patches.
